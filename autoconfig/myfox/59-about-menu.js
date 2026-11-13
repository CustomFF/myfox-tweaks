// "About MyFox tweaks" in the Help menu, after "About Firefox": opens
// about:myfox (15-about-page.js). The app menu's Help view is built from the
// Help menu each time it opens, items it doesn't group going to its end:
// there the copy is moved next to "About Firefox" as well.
(function (MyFox) {
  const { t, runOnDOMContentLoaded } = MyFox;
  const ID = "myfox-aboutTweaks";

  function initWindow(win) {
    const doc = win.document;
    const about = doc.getElementById("aboutName");
    if (!about || doc.getElementById(ID)) return;

    const open = () => win.switchToTabHavingURI("about:myfox", true);
    let item = doc.createXULElement("menuitem");
    item.id = ID;
    item.setAttribute("label", t("aboutpage.menu"));
    item.addEventListener("command", open);
    about.after(item);

    // The view is made from a template the first time the app menu opens,
    // and its copy takes the item's attributes only, not its listener: both
    // are caught on the document. The copy is moved once Firefox has filled
    // the view.
    doc.addEventListener("command", e => {
      if (e.target.id === "appMenu_" + ID) open();
    });
    doc.addEventListener("ViewShowing", e => {
      if (e.target.id !== "PanelUI-helpView") return;
      win.queueMicrotask(() => {
        let copy = doc.getElementById("appMenu_" + ID);
        if (copy) doc.getElementById("appMenu_aboutName")?.after(copy);
      });
    });
  }
  MyFox.windowInits.push(initWindow);

  // about:preferences: "MyFox settings" at the end of the side navigation,
  // under a line after "Firefox Support", opening about:myfox's Settings.
  MyFox.documentHooks.push(win => {
    if (!/^about:(preferences|settings)\b/.test(win.location.href)) return;
    runOnDOMContentLoaded(win, () => {
      let doc = win.document;
      let help = doc.getElementById("helpButton");
      if (!help || doc.getElementById("myfox-settingsButton")) return;
      let line = doc.createElement("hr");
      line.className = "nav-separator";
      line.slot = "secondary-nav";
      line.setAttribute("role", "presentation");
      let link = doc.createElement("moz-page-nav-button");
      link.id = "myfox-settingsButton";
      link.slot = "secondary-nav";
      link.setAttribute("iconsrc", "resource://myfox/about/favicon.svg");
      link.setAttribute("href", "about:myfox#settings");
      link.textContent = t("prefs.myfoxSettings");
      // Its link opens a new tab that stays blank (a settings page can't
      // open about:myfox), so it goes to about:myfox's tab, as the Help
      // menu's item does.
      link.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        win.browsingContext.topChromeWindow?.switchToTabHavingURI("about:myfox#settings", true, {
          ignoreFragment: "whenComparingAndReplace",
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
      }, true);
      help.after(line, link);
    });
  });
})(globalThis.MyFox);
