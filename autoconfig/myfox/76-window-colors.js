// The Library and Page Info: the browser theme's colors. Firefox gives a
// theme to the browser windows only (it sets the theme's colors as variables
// on the window's root); these older windows kept the system's. The
// variables are copied over from a browser window, and again whenever the
// theme changes. chrome/themed/36-window-colors.css paints with them.
(function (MyFox) {
  const { wm, runOnDOMContentLoaded } = MyFox;

  const URLS = [
    "chrome://browser/content/places/places.xhtml",
    "chrome://browser/content/pageinfo/pageInfo.xhtml",
  ];

  // Into a sheet of the window's own, not its root's style attribute: Page
  // Info localizes that attribute (its width), which wiped them.
  function copyColors(browser, win) {
    let from = browser.document.documentElement.style;
    let doc = win.document;
    let vars = [];
    for (let i = 0; i < from.length; i++) {
      if (from[i].startsWith("--")) vars.push(from[i] + ": " + from.getPropertyValue(from[i]) + ";");
    }
    if (!win.myfoxColorsSheet) {
      win.myfoxColorsSheet = new win.CSSStyleSheet();
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, win.myfoxColorsSheet];
    }
    win.myfoxColorsSheet.replaceSync(":root { " + vars.join(" ") + " }");
    // Only a theme sets them: under the default theme there is nothing to paint with.
    doc.documentElement.toggleAttribute("myfox-theme-colors", !!from.getPropertyValue("--toolbar-background-color"));
  }

  MyFox.documentHooks.push(win => {
    if (!URLS.includes(win.location.href)) return;
    runOnDOMContentLoaded(win, () => {
      let browser = wm.getMostRecentWindow("navigator:browser");
      if (!browser) return;
      let update = () => {
        try { copyColors(browser, win); } catch(e) {}
      };
      update();
      browser.addEventListener("windowlwthemeupdate", update);
      win.addEventListener("unload", () => {
        browser.removeEventListener("windowlwthemeupdate", update);
      }, { once: true });
    });
  });
})(globalThis.MyFox);
