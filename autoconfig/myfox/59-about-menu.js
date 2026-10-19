// "About MyFox tweaks" in the Help menu, after "About Firefox": opens
// about:myfox (15-about-page.js). The app menu's Help view is built from the
// Help menu each time it opens, items it doesn't group going to its end:
// there the copy is moved next to "About Firefox" as well.
(function (MyFox) {
  const { t } = MyFox;
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
})(globalThis.MyFox);
