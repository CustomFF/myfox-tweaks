// Downloads sidebar: about:downloads has no header or footer of its own in a
// sidebar, so build them. Styled by chrome/agent/20-downloads-sidebar.css.
(function (MyFox) {
  const { t, wrapSearchWithClear, createPanelTitleRow } = MyFox;

  // Builds the downloads sidebar's own header (title, close button,
  // search box) and footer ("Clear downloads") — about:downloads has none
  // in a sidebar. Styled by chrome/agent/20-downloads-sidebar.css.
  function injectSearch(sidebarDoc, sbCtrl, doc) {
    if (!sidebarDoc || sidebarDoc.location.href !== "about:downloads") return;
    if (sidebarDoc.getElementById("downloads-sidebar-header")) return;

    let rootEl = sidebarDoc.documentElement;
    let header = sidebarDoc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    header.id = "downloads-sidebar-header";

    header.appendChild(createPanelTitleRow(sidebarDoc, sbCtrl, t("panel.downloads.title")));

    // Search input inside the header
    let searchContainer = sidebarDoc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    searchContainer.id = "downloads-sidebar-search-container";

    // The same search box the history and bookmarks panels use.
    try {
      sidebarDoc.defaultView.ChromeUtils.importESModule(
        "chrome://global/content/elements/moz-input-search.mjs", { global: "current" });
    } catch(e) {}
    let searchInput = sidebarDoc.createElementNS("http://www.w3.org/1999/xhtml", "moz-input-search");
    searchInput.id = "downloads-sidebar-search";
    searchInput.setAttribute("placeholder", t("downloads.search"));
    searchContainer.appendChild(wrapSearchWithClear(sidebarDoc, searchInput, t("common.clear")));
    header.appendChild(searchContainer);

    const filterDownloads = () => {
      try {
        let query = searchInput.value.toLowerCase().trim();
        let list = sidebarDoc.getElementById("downloadsListBox");
        if (!list) return;
        for (let item of list.children) {
          if (item.tagName.toLowerCase() === "richlistitem" && item.classList.contains("download")) {
            let target = item.querySelector(".downloadTarget");
            let text = target ? (target.value || target.textContent) : "";
            if (text.toLowerCase().includes(query)) {
              item.style.setProperty("display", "", "important");
            } else {
              item.style.setProperty("display", "none", "important");
            }
          }
        }
      } catch(e) {}
    };

    searchInput.addEventListener("input", filterDownloads);

    rootEl.insertBefore(header, rootEl.firstChild);
    syncPanelColors(sidebarDoc, doc);
    // Like the built-in panels: the search box is ready for typing.
    sidebarDoc.defaultView.setTimeout(() => { try { searchInput.focus(); } catch(e) {} }, 0);

    // Keep the filter applied as downloads come and go, and show the search
    // box only while there is something to search.
    let list = sidebarDoc.getElementById("downloadsListBox");
    const updateSearchVisibility = () => {
      let any = !!(list && list.querySelector("richlistitem.download"));
      searchContainer.hidden = !any;
      if (!any && searchInput.value) {
        // A stale filter would hide the next download that shows up.
        searchInput.value = "";
        searchInput.dispatchEvent(new sidebarDoc.defaultView.Event("input", { bubbles: true }));
      }
    };
    updateSearchVisibility();
    if (list) {
      let listObserver = new sidebarDoc.defaultView.MutationObserver(() => {
        filterDownloads();
        updateSearchVisibility();
      });
      listObserver.observe(list, { childList: true });
      list.addEventListener("keydown", e => tabThroughDownloads(e, list), true);
      list.addEventListener("mousedown", () => list.removeAttribute("myfox-keyboard"), true);
    }

    // Footer at the bottom
    let footer = sidebarDoc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    footer.id = "downloads-sidebar-footer";

    let clearBtn = sidebarDoc.createElementNS("http://www.w3.org/1999/xhtml", "button");
    clearBtn.id = "downloads-sidebar-clear-btn";

    if (sidebarDoc.l10n) {
      sidebarDoc.l10n.formatMessages([{
        id: "downloads-cmd-clear-downloads",
        args: null
      }]).then(msgs => {
        if (msgs && msgs[0] && msgs[0].attributes) {
          let labelAttr = msgs[0].attributes.find(a => a.name === "label");
          if (labelAttr) {
            clearBtn.textContent = labelAttr.value;
          }
        }
      }).catch(e => {
        clearBtn.textContent = t("downloads.clear");
      });
    } else {
      clearBtn.textContent = t("downloads.clear");
    }

    clearBtn.addEventListener("click", function() {
      try {
        let cmd = sidebarDoc.getElementById("downloadsCmd_clearDownloads");
        if (cmd) {
          cmd.doCommand();
        }
      } catch(ex) {}
    });
    footer.appendChild(clearBtn);
    rootEl.appendChild(footer);
  }

  // The page's menus (the downloads' context menu) in the theme's panel
  // colors, as the window's menus (chrome/user/82-menu-rows.css): the page
  // has only its own; copy them, and again when the theme is switched.
  function syncPanelColors(sidebarDoc, doc) {
    const win = doc.defaultView;
    const apply = () => {
      try {
        let rootStyle = win.getComputedStyle(doc.documentElement);
        for (let [from, to] of [["--panel-background-color", "--myfox-panel-bg"],
                                ["--panel-text-color", "--myfox-panel-text"],
                                ["--panel-border-color", "--myfox-panel-border"]]) {
          let val = rootStyle.getPropertyValue(from).trim();
          if (val) sidebarDoc.documentElement.style.setProperty(to, val);
        }
      } catch(e) {}
    };
    apply();
    let timer = null;
    let observer = new win.MutationObserver(() => {
      if (timer) win.clearTimeout(timer);
      // The theme's colors land on the window over a few mutations.
      timer = win.setTimeout(apply, 150);
    });
    observer.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ["lwtheme", "lwt-sidebar", "lwt-toolbar", "style"],
    });
    sidebarDoc.defaultView.addEventListener("unload", () => {
      try { observer.disconnect(); } catch(e) {}
    }, { once: true });
  }

  // Tab and Shift+Tab step through the downloads, not over the whole list at
  // once; past the first or the last one they leave the list as usual. The
  // list is marked for the focus ring: a list focused with the mouse stays
  // out of :focus-visible when Tab is pressed in it.
  function tabThroughDownloads(e, list) {
    if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.metaKey) return;
    let items = [...list.querySelectorAll(":scope > richlistitem.download")]
      .filter(item => item.getBoundingClientRect().height > 0);
    let next = items[items.indexOf(list.selectedItem) + (e.shiftKey ? -1 : 1)];
    if (!next || !list.selectedItem) return;
    e.preventDefault();
    e.stopPropagation();
    list.setAttribute("myfox-keyboard", "true");
    list.selectedItem = next;
    list.ensureElementIsVisible(next);
  }

  // The downloads panel's "Show all downloads" opens this sidebar panel, not
  // the Library window (Ctrl+Shift+Y and the menus still open that).
  function initWindow(win) {
    const panel = win.DownloadsPanel;
    if (!panel) return;
    const showLibrary = panel.showDownloadsHistory;
    panel.showDownloadsHistory = function () {
      if (!win.SidebarController?.sidebars?.has("viewDownloadsSidebar")) {
        return showLibrary.call(this);
      }
      this.hidePanel();
      win.SidebarController.show("viewDownloadsSidebar");
    };
  }
  MyFox.windowInits.push(initWindow);

  MyFox.sidebarHooks.push(({ sbCtrl, sidebar, doc }) => injectSearch(sidebar.contentDocument, sbCtrl, doc));
})(globalThis.MyFox);
