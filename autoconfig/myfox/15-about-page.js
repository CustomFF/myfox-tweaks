// about:myfox: the project's own page (about it, the changelog), served from
// myfox/about/ in the install. It loads in the parent process with the
// browser's rights, as about:config does, so it can read and set prefs.
(function (MyFox) {
  const { Ci, ios } = MyFox;

  const CONTRACT = "@mozilla.org/network/protocol/about;1?what=myfox";
  const PAGE = "resource://myfox/about/about.html";

  const aboutModule = {
    QueryInterface: ChromeUtils.generateQI(["nsIAboutModule"]),
    newChannel(uri, loadInfo) {
      let channel = ios.newChannelFromURIWithLoadInfo(ios.newURI(PAGE), loadInfo);
      // The address bar keeps about:myfox; the page gets the browser's
      // rights (a resource:// page would have none).
      channel.originalURI = uri;
      channel.owner = Services.scriptSecurityManager.getSystemPrincipal();
      return channel;
    },
    getURIFlags() {
      return Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.IS_SECURE_CHROME_UI;
    },
    getChromeURI() {
      return ios.newURI(PAGE);
    },
  };
  const factory = {
    QueryInterface: ChromeUtils.generateQI(["nsIFactory"]),
    createInstance(iid) {
      return aboutModule.QueryInterface(iid);
    },
  };

  let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
  if (!registrar.isContractIDRegistered(CONTRACT)) {
    registrar.registerFactory(Components.ID("{0de3c56f-11fb-4bdd-9bc0-59528d13917e}"),
      "about:myfox", CONTRACT, factory);
  }
})(globalThis.MyFox);
