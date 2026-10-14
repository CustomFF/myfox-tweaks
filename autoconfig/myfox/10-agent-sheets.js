// Registers chrome/agent/*.css as agent sheets and chrome/author/*.css as
// author sheets.
(function (MyFox) {
  const { Ci, ios, sss, profileDir } = MyFox;

  // Every chrome/<dir>/*.css, in file-name order (the numeric prefixes fix
  // the cascade order), as sheets of the given origin.
  function registerDir(dir, type) {
    let d = profileDir.clone();
    d.append("chrome");
    d.append(dir);
    if (!d.exists() || !d.isDirectory()) return;
    let files = [];
    let entries = d.directoryEntries;
    while (entries.hasMoreElements()) {
      let f = entries.getNext().QueryInterface(Ci.nsIFile);
      if (f.leafName.endsWith(".css")) files.push(f);
    }
    files.sort((a, b) => (a.leafName < b.leafName ? -1 : a.leafName > b.leafName ? 1 : 0));
    for (let f of files) {
      let fileURI = ios.newFileURI(f);
      if (!sss.sheetRegistered(fileURI, type)) {
        sss.loadAndRegisterSheet(fileURI, type);
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
})(globalThis.MyFox);
