// Run by css-report.py inside Firefox's parent process (the debugger's
// console), with `params` set: which of our CSS rules apply to what, in every
// document of the parent process (browser windows with their shadow DOM,
// panels and menus, the sidebar, about:myfox). Returns a JSON string.
//
// "Ours" is every sheet under <profile>/chrome/ (userChrome.css and its
// imports, agent/, author/, themed/, ddblm's blm_panel.css), the <style>
// 50-layout.js puts into the launcher's shadow DOM and the sheet
// 76-window-colors.js adopts. Inline styles scripts set aren't rules and
// aren't counted.
//
// A snapshot: a rule for :hover, an open menu or a selected tab counts only
// if that is so right now.
//
// params.views: also open the pages and sidebar panels the tweaks style
// (see scanViews).
// params.selector: only the elements matching it (in any of those
// documents, shadow DOM included), to see what of ours applies to them.
(async () => {
  const chromeDir = Services.io.newFileURI(Services.dirsvc.get("ProfD", Ci.nsIFile)).spec + "chrome/";
  const PSEUDOS = [null, "::before", "::after", "::-moz-search-clear-button", "::-moz-progress-bar"];
  const LAYOUT_STYLE_ID = "custom-horizontal-styles";

  // Where a rule comes from, as a path under chrome/, or null if not ours.
  function sourceOf(rule, win) {
    let sheet = rule.parentStyleSheet;
    while (sheet && sheet.parentStyleSheet) sheet = sheet.parentStyleSheet;
    let href = rule.parentStyleSheet?.href || "";
    if (href.startsWith(chromeDir)) return href.slice(chromeDir.length);
    if (sheet?.ownerNode?.id === LAYOUT_STYLE_ID) return "50-layout.js <style#" + LAYOUT_STYLE_ID + ">";
    if (sheet && win && sheet === win.myfoxColorsSheet) return "76-window-colors.js (adopted sheet)";
    return null;
  }

  // The rule's full selector: its nesting chain, outermost first.
  function chainOf(rule) {
    let parts = [];
    for (let r = rule; r; r = r.parentRule) {
      if (r.selectorText !== undefined) parts.unshift(r.selectorText);
      else if (r.conditionText !== undefined) parts.unshift("@" + (r.constructor.name.replace(/^CSS|Rule$/g, "").toLowerCase()) + " " + r.conditionText);
    }
    return parts.join(" ⟶ ");
  }

  const rules = new Map();   // key -> entry
  const seenFiles = new Set();
  function entryOf(rule, win, fileOverride) {
    let file = fileOverride || sourceOf(rule, win);
    if (!file) return null;
    seenFiles.add(file);
    let line = InspectorUtils.getRelativeRuleLine(rule);
    let chain = chainOf(rule);
    let key = file + ":" + line + ":" + chain;
    let e = rules.get(key);
    if (!e) {
      let props = [...rule.style];
      e = {
        file, line, selector: chain,
        selectors: rule.selectorCount > 1 ? Array.from({ length: rule.selectorCount }, (_, i) => rule.selectorTextAt?.(i) ?? null) : null,
        props: props.map(p => p + (rule.style.getPropertyPriority(p) ? " !" : "")),
        matches: {},
        perSelector: rule.selectorCount > 1 ? new Array(rule.selectorCount).fill(0) : null,
      };
      rules.set(key, e);
    }
    return e;
  }

  // Every style rule of a sheet, nested and imported ones too.
  function collectSheet(sheet, win, fileOverride) {
    if ((sheet.href || "").startsWith(chromeDir)) seenFiles.add(sheet.href.slice(chromeDir.length));
    let rulesList;
    try { rulesList = sheet.cssRules; } catch(e) { return; }
    const walk = (list) => {
      for (let r of list) {
        if (r.styleSheet) { collectSheet(r.styleSheet, win); continue; }
        if (r.selectorText !== undefined) entryOf(r, win, fileOverride);
        if (r.cssRules) walk(r.cssRules);
      }
    };
    walk(rulesList);
  }

  // A short name for an element: where it is, its tag, id and classes.
  function describe(el, docLabel, pseudo) {
    let hosts = [];
    for (let root = el.getRootNode(); root.host; root = root.host.getRootNode()) {
      hosts.unshift(root.host.localName + (root.host.id ? "#" + root.host.id : ""));
    }
    let s = el.localName + (el.id ? "#" + el.id : "");
    let cls = [...(el.classList || [])].slice(0, 3);
    if (cls.length) s += "." + cls.join(".");
    return docLabel + " | " + (hosts.length ? hosts.join(" ▸ ") + " ▸ " : "") + s + (pseudo || "");
  }

  function* elementsOf(root) {
    for (let el of root.querySelectorAll("*")) {
      yield el;
      let shadow = el.openOrClosedShadowRoot;
      if (shadow) yield* elementsOf(shadow);
    }
  }

  // The parent process's documents: every window, and inside them every
  // frame whose document is here too (the sidebar, about:myfox,
  // about:preferences). A frame in a content process isn't reachable.
  function docsNow(roots) {
    return docsUnder((roots || [...Services.wm.getEnumerator(null)]).map(w => w.document));
  }
  function docsUnder(tops) {
    const docs = [];
    const add = (doc) => {
      if (!doc || docs.includes(doc)) return;
      docs.push(doc);
      for (let f of elementsOf(doc)) {
        if (!/^(browser|iframe)$/.test(f.localName)) continue;
        let inner = null;
        try { inner = f.contentDocument; } catch(e) {}
        if (inner) add(inner);
      }
    };
    for (let doc of tops) add(doc);
    return docs;
  }

  const labelOf = (doc) => {
    let u = doc.documentURI;
    return u === "chrome://browser/content/browser.xhtml" ? "browser" : u.replace(/^chrome:\/\/[^/]+\/content\//, "");
  };
  const seenDocs = new Set();
  let scanned = 0;

  // One snapshot of these documents: what matches now. A rule's count for
  // an element kind is the most it had in any snapshot.
  function scan(docs) {
    for (let doc of docs) {
      let win = doc.defaultView;
      for (let sheet of InspectorUtils.getAllStyleSheets(doc, false)) collectSheet(sheet, win);
      let label = labelOf(doc);
      seenDocs.add(label);
      let pass = new Map();   // entry -> {descriptor: count}
      for (let el of [doc.documentElement, ...elementsOf(doc)]) {
        if (params.selector) {
          try { if (!el.matches(params.selector)) continue; } catch(e) { throw new Error("bad selector: " + params.selector); }
        }
        scanned++;
        for (let pseudo of PSEUDOS) {
          let matched;
          try { matched = InspectorUtils.getMatchingCSSRules(el, pseudo || ""); } catch(e) { continue; }
          for (let r of matched) {
            let e = entryOf(r, win);
            if (!e) continue;
            let d = describe(el, label, pseudo);
            let m = pass.get(e) || pass.set(e, {}).get(e);
            m[d] = (m[d] || 0) + 1;
            if (e.perSelector) {
              for (let i = 0; i < e.perSelector.length; i++) {
                try { if (r.selectorMatchesElement(i, el, pseudo || "", false)) e.perSelector[i]++; } catch(ex) {}
              }
            }
          }
        }
      }
      for (let [e, m] of pass) {
        for (let d in m) e.matches[d] = Math.max(e.matches[d] || 0, m[d]);
      }
    }
  }

  const unreachable = [];
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // params.views: also a window of its own with the pages the tweaks style,
  // and every sidebar panel opened in it in turn; closed afterwards.
  async function scanViews() {
    const PAGES = ["about:preferences", "about:addons", "about:config", "about:myfox",
                   "about:downloads", "about:processes", "about:support", "about:profiles",
                   "about:logins", "about:translations", "about:newtab"];
    let opener = Services.wm.getMostRecentWindow("navigator:browser");
    let win = opener.OpenBrowserWindow();
    await new Promise(r => win.addEventListener("load", r, { once: true }));
    await wait(2000);
    try {
      const P = Services.scriptSecurityManager.getSystemPrincipal();
      for (let url of PAGES) {
        let tab = win.gBrowser.addTab(url, { triggeringPrincipal: P });
        win.gBrowser.selectedTab = tab;
        await wait(1500);
        if (!tab.linkedBrowser.contentDocument) unreachable.push(url + " (content process)");
      }
      // Every page selected in turn: a background tab's layout may lag.
      for (let tab of win.gBrowser.tabs) {
        win.gBrowser.selectedTab = tab;
        await wait(300);
        scan(docsUnder([tab.linkedBrowser.contentDocument]).filter(Boolean));
      }
      // The window itself with all of them open.
      scan([win.document]);
      let sb = win.SidebarController;
      if (sb) {
        for (let id of sb.sidebars.keys()) {
          try {
            await sb.show(id);
            await wait(1500);
            scan([win.document, ...docsUnder([sb.browser?.contentDocument]).filter(Boolean)]);
          } catch(e) {
            unreachable.push("sidebar " + id + ": " + e);
          }
        }
        sb.hide();
      }
    } finally {
      win.close();
    }
  }

  scan(docsNow());
  if (params.views) await scanViews();

  // Files no document has (author sheets aren't listed with a document's
  // sheets; a file may also not be registered at all): their rules read
  // from disk, so they are in the report even when they match nothing.
  const notRegistered = [];
  const chromeFile = Services.dirsvc.get("ProfD", Ci.nsIFile);
  chromeFile.append("chrome");
  const cssFiles = (dir, prefix) => {
    let out = [];
    if (!dir.exists()) return out;
    for (let f of dir.directoryEntries) {
      if (f.isDirectory()) out.push(...cssFiles(f, prefix + f.leafName + "/"));
      else if (f.leafName.endsWith(".css")) out.push([prefix + f.leafName, f]);
    }
    return out;
  };
  let host = Services.wm.getMostRecentWindow("navigator:browser");
  for (let [name, f] of cssFiles(chromeFile, "")) {
    if (seenFiles.has(name) || name.startsWith("panel-icons/")) continue;
    notRegistered.push(name);
    let sheet = new host.CSSStyleSheet();
    sheet.replaceSync(await IOUtils.readUTF8(f.path));
    collectSheet(sheet, host, name);
  }


  return JSON.stringify({
    firefox: Services.appinfo.version,
    os: Services.appinfo.OS,
    time: new Date().toISOString(),
    theme: Services.prefs.getStringPref("extensions.activeThemeID", ""),
    docs: [...seenDocs],
    unreachable,
    readFromDisk: notRegistered,
    elements: scanned,
    rules: [...rules.values()],
  });
})()
