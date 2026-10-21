// Firefox's own tooltip (the one it makes for tooltiptext and title) inherits
// none of the window's variables, so it can't take the theme's colors as the
// other tooltips do (chrome/agent/90-popups-tab-preview.css). It takes the
// system's tooltip colors, which prefs can set: they follow the theme's
// sidebar colors, and go back to the system's under a theme that has none.
// Set on the default branch: nothing is written into the profile.
(function (MyFox) {
  const defaults = Services.prefs.getDefaultBranch("");

  function sync(win) {
    try {
      let style = win.document.documentElement.style;
      let background = style.getPropertyValue("--sidebar-background-color");
      let text = style.getPropertyValue("--sidebar-text-color");
      if (background && text) {
        defaults.setStringPref("ui.infobackground", background);
        defaults.setStringPref("ui.infotext", text);
      } else {
        defaults.deleteBranch("ui.infobackground");
        defaults.deleteBranch("ui.infotext");
      }
    } catch(e) {}
  }

  MyFox.windowInits.push(win => {
    sync(win);
    win.addEventListener("windowlwthemeupdate", () => sync(win));
  });
})(globalThis.MyFox);
