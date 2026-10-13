// Split view: the toolbars above the two pages are colored half and half,
// each half in the color of its page's tab (75-split-view.css). Where the
// halves meet depends on the splitter, which the user drags, and CSS can't
// see where it is; this keeps its position in --myfox-split-x on the window's
// root (from the window's left edge). Without the variable the toolbars take
// the color of the selected half as a whole.
(function (MyFox) {
  function initWindow(win) {
    const doc = win.document;
    const root = doc.documentElement;
    const panels = doc.getElementById("tabbrowser-tabpanels");
    if (!panels) return;
    let scheduled = false;

    function update() {
      scheduled = false;
      try {
        let splitter = panels.hasAttribute("splitview")
          && panels.querySelector(":scope > .split-view-splitter");
        let box = splitter && splitter.getBoundingClientRect();
        if (!box || !box.width) {
          root.style.removeProperty("--myfox-split-x");
          return;
        }
        root.style.setProperty("--myfox-split-x", (box.left + box.width / 2) + "px");
      } catch(e) {}
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      win.requestAnimationFrame(update);
    }

    // The splitter moves when either page is resized (dragging it, the
    // window, the sidebar) and when another pair, or none, is shown.
    const resizes = new win.ResizeObserver(schedule);
    resizes.observe(panels);
    function watchPanels() {
      for (let panel of panels.querySelectorAll(":scope > .split-view-panel")) {
        resizes.observe(panel);
      }
      schedule();
    }
    new win.MutationObserver(watchPanels).observe(panels, {
      childList: true,
      attributes: true,
      attributeFilter: ["splitview", "class", "column"],
      subtree: true,
    });
    win.addEventListener("TabSelect", schedule);
    watchPanels();
  }

  MyFox.windowInits.push(initWindow);
})(globalThis.MyFox);
