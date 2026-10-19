// Registers chrome/agent/*.css as agent sheets and chrome/author/*.css as
// author sheets, and chrome/themed/*.css as agent sheets while a MyFox theme
// is on.
(function (MyFox) {
  const { Ci, ios, sss, prefs, profileDir } = MyFox;

  // Every chrome/<dir>/*.css, in file-name order (the numeric prefixes fix
  // the cascade order).
  function sheetsOf(dir) {
    let d = profileDir.clone();
    d.append("chrome");
    d.append(dir);
    if (!d.exists() || !d.isDirectory()) return [];
    let files = [];
    let entries = d.directoryEntries;
    while (entries.hasMoreElements()) {
      let f = entries.getNext().QueryInterface(Ci.nsIFile);
      if (f.leafName.endsWith(".css")) files.push(f);
    }
    files.sort((a, b) => (a.leafName < b.leafName ? -1 : a.leafName > b.leafName ? 1 : 0));
    return files.map(f => ios.newFileURI(f));
  }

  // Every chrome/<dir>/*.css as sheets of the given origin.
  function registerDir(dir, type) {
    for (let uri of sheetsOf(dir)) {
      if (!sss.sheetRegistered(uri, type)) {
        sss.loadAndRegisterSheet(uri, type);
      }
    }
  }

  // Agent origin is what reaches into shadow DOM and beats the documents'
  // own styles; userChrome.css can't.
  registerDir("agent", sss.AGENT_SHEET);
  // Author origin is the only one ::part() works from: what a component
  // exposes of its shadow DOM (the pinned tabs' grid, say) only Firefox's
  // own styles and these can reach. They apply to every document, web pages
  // too, so every rule starts from the browser window's root.
  registerDir("author", sss.AUTHOR_SHEET);

  // The controls' look (themed/) belongs to the MyFox themes: the pages and
  // sidebars don't know the theme, so the sheets come and go with it. Taken
  // off, they leave every open page; put back, they come after agent/.
  const THEME_PREF = "extensions.activeThemeID";
  const themed = sheetsOf("themed");
  function syncThemed() {
    let on = prefs.getStringPref(THEME_PREF, "").startsWith("myfox-");
    for (let uri of themed) {
      let registered = sss.sheetRegistered(uri, sss.AGENT_SHEET);
      if (on && !registered) sss.loadAndRegisterSheet(uri, sss.AGENT_SHEET);
      else if (!on && registered) sss.unregisterSheet(uri, sss.AGENT_SHEET);
    }
  }
  syncThemed();
  prefs.addObserver(THEME_PREF, syncThemed);
})(globalThis.MyFox);
