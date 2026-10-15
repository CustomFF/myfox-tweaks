// The extensions (puzzle) panel: next to its "Manage extensions" footer
// button, a small button that opens our add-ons sidebar panel instead of
// about:addons (41-addons-panel.js), drawn like the "..." button of an
// extension's row.
(function (MyFox) {
  const { t } = MyFox;

  function addButton(win) {
    const doc = win.document;
    const manage = doc.getElementById("unified-extensions-manage-extensions");
    if (!manage || doc.getElementById("myfox-unified-extensions-sidebar")) return;

    let row = doc.createXULElement("hbox");
    row.id = "myfox-unified-extensions-manage-row";
    row.setAttribute("align", "center");
    manage.before(row);
    row.appendChild(manage);
    manage.setAttribute("flex", "1");

    let button = doc.createXULElement("toolbarbutton");
    button.id = "myfox-unified-extensions-sidebar";
    button.className = "unified-extensions-item-menu-button subviewbutton subviewbutton-iconic";
    button.setAttribute("tooltiptext", t("addons.openInSidebar"));
    button.setAttribute("aria-label", t("addons.openInSidebar"));
    button.addEventListener("command", () => {
      win.PanelMultiView.hidePopup(doc.getElementById("unified-extensions-panel"));
      win.SidebarController.show("viewAddonsSidebar");
    });
    row.appendChild(button);
  }

  // The panel is built from a template the first time it opens.
  function initWindow(win) {
    addButton(win);
    win.document.addEventListener("popupshowing", e => {
      if (e.target.id === "unified-extensions-panel") addButton(win);
    }, true);
  }
  MyFox.windowInits.push(initWindow);
})(globalThis.MyFox);
