// Password manager sidebar (megalist).
(function (MyFox) {
  const { t, Cc, Ci } = MyFox;

  // Password-card height the megalist virtual list assumes; must match the
  // card step in chrome/agent/60-password-manager.css: a 72px card (three
  // 22px rows, 3px in from its top and bottom) and 3px above and below it.
  const MEGALIST_CARD_HEIGHT = 78;
  const MEGALIST_ALERT_EXTRA_HEIGHT = 51;
  // The edit pencil's 18px and a gap on each side.
  const PENCIL_ROOM = 20;

  // The password manager sidebar (megalist) is a virtual list: it doesn't
  // measure cards, it sizes the not-yet-rendered chunks from constants
  // hardcoded in its script (215+13px per card). Our CSS makes the card
  // more compact (chrome/agent/60-password-manager.css), so keep the
  // constants in sync — otherwise scrolling jumps on long lists. Done once,
  // when the first card is made ours (Firefox's cards keep Firefox's).
  function patchMegalistHeights(PC) {
    if (PC.myfoxHeights) return;
    PC.myfoxHeights = true;
    PC.DEFAULT_PASSWORD_CARD_HEIGHT = MEGALIST_CARD_HEIGHT;
    PC.WITH_ALERT_PASSWORD_CARD_HEIGHT = MEGALIST_CARD_HEIGHT + MEGALIST_ALERT_EXTRA_HEIGHT;
  }

  // A card's rows are labeled with short words of ours, shown by
  // chrome/agent/60-password-manager.css in place of Firefox's (there are
  // no short ones in Firefox's strings): handed over as CSS strings.
  function setLabels(sbWin) {
    try {
      if (!sbWin || !/megalist/.test(sbWin.document.documentURI)) return;
      let doc = sbWin.document;
      let root = doc.documentElement;
      // Measured as the labels are drawn: 12px in the panel's own font.
      let probe = doc.createElement("span");
      probe.style.cssText = "position: absolute; visibility: hidden; white-space: nowrap; font-size: 12px";
      (doc.body || root).appendChild(probe);
      let widest = 0;
      for (let [name, key] of [["site", "passwords.site"], ["username", "passwords.username"], ["password", "passwords.password"]]) {
        root.style.setProperty("--myfox-pw-" + name, JSON.stringify(t(key)));
        probe.textContent = t(key) + ":";
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      }
      probe.textContent = t("passwords.site") + ":";
      let site = probe.getBoundingClientRect().width;
      probe.remove();
      // The labels' column is as wide as the widest of them, and in the
      // site's row (its label is the shortest) narrower by the room for the
      // edit pencil before the row: wider still if the site's label doesn't
      // fit in what is left.
      widest = Math.max(widest, site + PENCIL_ROOM);
      root.style.setProperty("--myfox-pw-label-width", Math.ceil(widest) + "px");
      root.style.setProperty("--myfox-pw-pencil-room", PENCIL_ROOM + "px");
    } catch(e) {}
  }

  // A card's rows are no buttons any more: each has buttons of its own at
  // its end, in two columns. The site: open it, copy its address. The
  // username: copy it. The password: show it (Firefox's own button, moved
  // into the inner column), copy it. Copying the username and the password,
  // and opening the site, are still done by Firefox's own handler (it asks
  // for the primary password first), triggered from the button; a click or
  // Enter on the row itself does nothing. The site's tooltip ("Visit …")
  // goes to its open button; every copy button just says "Copy". Styled by
  // chrome/agent/60-password-manager.css.
  const HTML = "http://www.w3.org/1999/xhtml";
  const COPY_ICON = "chrome://global/skin/icons/edit-copy.svg";
  const VISIT_ICON = "chrome://global/skin/icons/open-in-new.svg";

  function makeButton(doc, kind, icon, label) {
    let button = doc.createElementNS(HTML, "button");
    if (label) {
      button.title = label;
      button.setAttribute("aria-label", label);
    }
    button.className = "myfox-pw-btn myfox-pw-" + kind;
    let img = doc.createElementNS(HTML, "img");
    img.src = icon;
    img.alt = "";
    button.appendChild(img);
    // Enter on it is the button's, not the row's around it.
    button.addEventListener("keypress", e => e.stopPropagation());
    return button;
  }

  // The row's tooltip and accessible name off it, kept off as Firefox
  // localizes them again (on every change of the login shown); on the
  // button instead, unless it has its own.
  function moveTitle(row, button) {
    const move = () => {
      for (let name of ["title", "aria-label"]) {
        let value = row.getAttribute(name);
        if (value) {
          if (button) button.setAttribute(name, value);
          row.removeAttribute(name);
        }
      }
    };
    move();
    new row.ownerDocument.defaultView.MutationObserver(move).observe(row, { attributes: true, attributeFilter: ["title", "aria-label"] });
  }

  // After a copy the button shows a check mark and Firefox's "Copied"
  // (the word its rows show after a label) for a while, as about:logins'
  // copy buttons do. Firefox marks only a row clicked itself, not one whose
  // handler a button calls.
  function showCopied(button, word) {
    let win = button.ownerDocument.defaultView;
    win.clearTimeout(button.myfoxCopiedTimer);
    button.setAttribute("data-copied", word || "");
    button.classList.add("copied");
    button.myfoxCopiedTimer = win.setTimeout(() => button.classList.remove("copied"), 2000);
  }

  // A card is made ours only if every part of Firefox's we rely on is
  // there; then it and those parts are marked myfox-card, and all our
  // styles for it go by that mark. If Firefox changes the card, it stays
  // Firefox's own, whole and working, instead of half ours.
  function decorateCard(card, copyLabel) {
    let root = card.shadowRoot;
    if (!root || card.myfoxButtons) return;
    card.myfoxButtons = true;
    let origin = root.querySelector('login-line[linetype="origin"]');
    let username = root.querySelector('login-line[linetype="username"]');
    let concealed = root.querySelector("concealed-login-line");
    let password = concealed && concealed.shadowRoot && concealed.shadowRoot.querySelector("login-line");
    let reveal = concealed && concealed.shadowRoot && concealed.shadowRoot.querySelector(".reveal-button-container");
    let editLine = root.querySelector(".edit-line-container");
    let lineOf = row => row && row.shadowRoot && row.shadowRoot.querySelector(".line-container");
    let lines = [origin, username, password].map(lineOf);
    let labelOf = (line, name) => line && line.querySelector(`label[data-l10n-id="contextual-manager-passwords-${name}-label"]`);
    if (lines.some(l => !l) || !reveal || !reveal.querySelector(".reveal-button") ||
        !editLine || !editLine.querySelector(".edit-button") ||
        !labelOf(lines[0], "origin") || !labelOf(lines[1], "username") || !labelOf(lines[2], "password") ||
        !lines[0].querySelector(".fav-icon") ||
        [origin, username, concealed].some(row => typeof row.onLineClick != "function") ||
        !card.origin || typeof card.origin.href != "string") {
      return;
    }
    let doc = card.ownerDocument;
    let added = [];
    try {
      decorateParts();
    } catch(e) {
      for (let el of added) el.remove();
      return;
    }
    for (let el of [card, origin, username, concealed, password, ...lines, reveal, editLine]) {
      el.setAttribute("myfox-card", "");
    }
    patchMegalistHeights(card.constructor);

    function decorateParts() {
      // Each button calls the handler Firefox gives its row (the card's: it
      // asks for the primary password first where it has to), and goes no
      // further: the row would take the click as its own.
      const onClick = (button, fn) => button.addEventListener("click", e => {
        e.stopPropagation();
        fn();
      });

      let usernameLabel = labelOf(lines[1], "username");
      const copiedWord = () => usernameLabel.getAttribute("data-after");
      let visit = makeButton(doc, "visit", VISIT_ICON);
      onClick(visit, () => origin.onLineClick());
      let copySite = makeButton(doc, "copy", COPY_ICON, copyLabel);
      onClick(copySite, () => {
        try {
          let address = (card.origin && card.origin.href) || origin.value;
          Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(address);
          showCopied(copySite, copiedWord());
        } catch(ex) {}
      });
      lineOf(origin).append(visit, copySite);
      added.push(visit, copySite);
      moveTitle(origin, visit);

      let copyUser = makeButton(doc, "copy", COPY_ICON, copyLabel);
      // The handlers settle on whether they copied (not when the primary
      // password isn't given), as Firefox's rows take them.
      onClick(copyUser, () => Promise.resolve(username.onLineClick()).then(copied => {
        if (copied) showCopied(copyUser, copiedWord());
      }));
      lineOf(username).append(copyUser);
      added.push(copyUser);
      moveTitle(username, null);

      let copyPassword = makeButton(doc, "copy", COPY_ICON, copyLabel);
      onClick(copyPassword, () => Promise.resolve(concealed.onLineClick()).then(copied => {
        if (copied) showCopied(copyPassword, copiedWord());
      }));
      reveal.after(copyPassword);
      added.push(copyPassword);
      moveTitle(password, null);

      // The pencil's tooltip is its own label ("Edit"), not "Edit password":
      // the card is all about the one password. Kept so as Firefox localizes
      // the button again.
      let edit = root.querySelector(".edit-button");
      if (edit) {
        const retitle = () => {
          let label = edit.textContent.trim();
          if (label && edit.getAttribute("tooltiptext") !== label) edit.setAttribute("tooltiptext", label);
        };
        retitle();
        new doc.defaultView.MutationObserver(retitle).observe(edit, { attributes: true, attributeFilter: ["tooltiptext"], childList: true, characterData: true, subtree: true });
      }

      // Clicks and Enter on a row itself go nowhere; the buttons' go through.
      const block = e => {
        if (e.type === "keypress" && e.code !== "Enter" && e.code !== "Space") return;
        let path = e.composedPath();
        if (path.some(n => n.classList && (n.classList.contains("myfox-pw-btn") || n.classList.contains("reveal-button") || n.classList.contains("edit-button")))) return;
        if (path.some(n => n.localName === "login-line")) {
          e.stopPropagation();
          e.preventDefault();
        }
      };
      root.addEventListener("click", block, true);
      root.addEventListener("keypress", block, true);

      // The buttons show with the focus from the keyboard in their row (and
      // the pencil with it anywhere in the card): the card and the row it's in
      // are marked myfox-focus. Not :focus-within, which a click leaves on
      // (nor :focus-visible, which a clicked value's field has as well).
      const win = doc.defaultView;
      let byPointer = false;
      doc.addEventListener("pointerdown", () => byPointer = true, true);
      doc.addEventListener("keydown", () => byPointer = false, true);
      const markFocus = () => {
        let focused = doc.activeElement;
        while (focused && focused.shadowRoot && focused.shadowRoot.activeElement) {
          focused = focused.shadowRoot.activeElement;
        }
        let chain = [];
        if (focused && !byPointer) {
          for (let n = focused; n; n = n.getRootNode().host) chain.push(n);
        }
        for (let el of [card, origin, username, concealed]) {
          el.toggleAttribute("myfox-focus", chain.includes(el));
        }
      };
      root.addEventListener("focusin", markFocus);
      root.addEventListener("focusout", () => win.setTimeout(markFocus, 0));
    }
  }

  function decorateCards(sbWin) {
    try {
      if (!sbWin || !/megalist/.test(sbWin.document.documentURI)) return;
      let doc = sbWin.document;
      sbWin.customElements.whenDefined("megalist-alpha").then(async () => {
        let copyLabel = "";
        try {
          let [msg] = await doc.l10n.formatMessages([{ id: "contextual-manager-copy-icon" }]);
          copyLabel = (msg.attributes.find(a => a.name === "alt") || {}).value || "";
        } catch(e) {}
        let attach = () => {
          let megalist = doc.querySelector("megalist-alpha");
          let root = megalist && megalist.shadowRoot;
          if (!root) return false;
          const scan = () => {
            for (let card of root.querySelectorAll("password-card")) {
              if (card.myfoxButtons) continue;
              Promise.resolve(card.updateComplete).then(() => {
                let rows = [...card.shadowRoot.querySelectorAll("login-line, concealed-login-line")];
                return Promise.all(rows.map(r => r.updateComplete));
              }).then(() => {
                let c = card.shadowRoot.querySelector("concealed-login-line");
                return c && c.shadowRoot && Promise.resolve(c.shadowRoot.querySelector("login-line")?.updateComplete);
              }).then(() => decorateCard(card, copyLabel)).catch(() => {});
            }
          };
          scan();
          new sbWin.MutationObserver(scan).observe(root, { childList: true, subtree: true });
          return true;
        };
        if (!attach()) {
          let tries = 0;
          let timer = sbWin.setInterval(() => {
            if (attach() || ++tries > 50) sbWin.clearInterval(timer);
          }, 100);
        }
      });
    } catch(e) {}
  }

  MyFox.sidebarHooks.push(({ sidebar }) => {
    setLabels(sidebar.contentWindow);
    decorateCards(sidebar.contentWindow);
  });
})(globalThis.MyFox);
