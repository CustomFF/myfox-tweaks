// A pinned tab's pin mark is a button that unpins it: a small pin at its
// icon's corner (drawn by ../chrome/user/20-tabs.css, on pinned tabs only).
// Every tab gets the element, as it opens; the stylesheet shows it once the
// tab is pinned.
(function (MyFox) {
  const { t } = MyFox;

  function initWindow(win) {
    const doc = win.document;
    const gBrowser = win.gBrowser;
    if (!gBrowser) return;

    function addButton(tab) {
      let stack = tab.querySelector(".tab-icon-stack");
      if (!stack || stack.querySelector(":scope > .myfox-unpin-button")) return;
      let button = doc.createXULElement("image");
      button.className = "myfox-unpin-button";
      button.setAttribute("role", "button");
      button.setAttribute("tooltiptext", t("tabs.unpin"));
      button.setAttribute("aria-label", t("tabs.unpin"));
      // The tab would take the press as its own: select itself, start a drag.
      button.addEventListener("mousedown", e => {
        e.stopPropagation();
        e.preventDefault();
      });
      button.addEventListener("click", e => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button === 0 && tab.pinned) gBrowser.unpinTab(tab);
      });
      stack.appendChild(button);
    }

    for (let tab of gBrowser.tabs) addButton(tab);
    gBrowser.tabContainer.addEventListener("TabOpen", e => addButton(e.target));
  }

  MyFox.windowInits.push(initWindow);
})(globalThis.MyFox);
