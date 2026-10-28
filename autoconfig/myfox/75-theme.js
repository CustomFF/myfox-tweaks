// Theme: enables the theme add-on the installer picked, once per profile, or
// whenever MyFox asks for it with <profile>/.myfox-theme.
(function (MyFox) {
  const { prefs, wm, whenPlacesReady, profileDir } = MyFox;

  // Theme add-on IDs — our own fork (themes/, signed through AMO's unlisted
  // channel; see themes/README.md), not a third-party AMO listing anymore.
  // The installer puts both .xpi files into <profile>/extensions/ (see
  // lib/addons.sh's addons_install_themes) — must match MYFOX_THEME_DARK_ID/
  // MYFOX_THEME_LIGHT_ID there.
  const THEME_IDS = {
    dark: "myfox-dark-theme@daydve.github.io",
    light: "myfox-light-theme@daydve.github.io",
  };

  // The theme add-on, once Firefox knows it. In a fresh profile it does by
  // now; a profile MyFox imported brought the other Firefox's add-on list
  // along, and the .xpi files put next to it are found only later in the
  // first run, so it asks again for up to a minute.
  async function findTheme(win, am, id) {
    for (let i = 0; i < 30; i++) {
      let addon = await am.getAddonByID(id);
      if (addon) return addon;
      await new Promise(resolve => win.setTimeout(resolve, 2000));
      if (win.closed) return null;
    }
    return null;
  }

  function applyTheme() {
    let win = wm.getMostRecentWindow("navigator:browser");
    if (!win) { return; }

    // Both theme add-ons are installed into the profile regardless of
    // choice (<profile>/extensions/*.xpi — instant switching later);
    // myfox.theme (from user.js, see apply_theme_pref) picks which one
    // gets enabled here. Firefox stores a sideloaded theme in
    // extensions.json with userDisabled=true until addon.enable() is
    // called explicitly — so we enable AND activate. Only ONCE
    // (myfox.themeApplied) and only if the user hasn't since picked a
    // different theme themselves: theme choice is a setting, never
    // overwritten on later startups.
    // <profile>/.myfox-theme: MyFox imported this profile from another
    // Firefox, which brought its own theme along. It asks for the MyFox
    // theme (myfox.theme, matched to the old one's light or dark) over
    // whatever is on, once: the file goes when it's done.
    let marker = profileDir.clone();
    marker.append(".myfox-theme");
    let force = marker.exists();
    let themeId = THEME_IDS[prefs.getCharPref("myfox.theme", "dark")] || THEME_IDS.dark;
    try {
      let am = win.AddonManager;
      if (am && (force || !prefs.getBoolPref("myfox.themeApplied", false))) {
        findTheme(win, am, themeId).then(async (addon) => {
          if (addon && addon.type === "theme") {
            let current = prefs.getStringPref("extensions.activeThemeID", "default-theme@mozilla.org");
            if (force || current === "default-theme@mozilla.org" || current === themeId) {
              try {
                if (addon.userDisabled) { await addon.enable(); }
              } catch(e) {}
              prefs.setStringPref("extensions.activeThemeID", themeId);
              try { prefs.clearUserPref("extensions.lastSelectedThemeID"); } catch(e) {}
            }
            prefs.setBoolPref("myfox.themeApplied", true);
            if (force) { try { marker.remove(false); } catch(e) {} }
          }
        }).catch(() => {});
      }
    } catch(e) {}
  }

  MyFox.windowInits.push(() => whenPlacesReady(applyTheme));
})(globalThis.MyFox);
