// English strings: the base catalog, used for any key a translation lacks.
// Add a language by copying this file to i18n/<language-code>.js (for example
// de.js or pt-br.js) and translating the values; it is picked when the
// browser's language matches. {0}, {1} are placeholders.
(function (MyFox) {
  MyFox.messages.en = {
    "common.clear": "Clear",

    "panel.downloads.title": "Downloads",
    "panel.addons.title": "Extensions",
    "panel.translations.title": "Firefox Translations",

    "downloads.search": "Search downloads",
    "downloads.clear": "Clear Downloads",

    "addons.search": "Search add-ons",
    "addons.manage": "Manage extensions",
    "addons.openInSidebar": "Open in Sidebar",
    "addons.more": "More",
    "addons.menu.preferences": "Preferences",
    "addons.menu.manage": "Manage",
    "addons.menu.remove": "Remove",
    "addons.removed": "removed",
    "addons.undo": "Undo",
    "addons.tip.disable": "Disable extension",
    "addons.tip.enable": "Enable extension",
    "addons.empty.title": "Even a few extensions can make a big difference",
    "addons.empty.text": "We have recommendations to help you improve focus, privacy, and more.",
    "addons.empty.button": "Find your first extension",
    "addons.amo": "Search “{0}” on addons.mozilla.org",

    "customize.launcherAbove": "Tools bar above the sidebar",

    "bookmarks.advanced": "Advanced settings",
    "bookmarks.gallery": "Add bookmarklets",

    "toolbar.bookmarks.label": "Bookmarks Toolbar",

    "tabs.unpin": "Unpin Tab",

    "aboutpage.title": "MyFox tweaks",
    "aboutpage.menu": "About MyFox tweaks",
    "aboutpage.nav.about": "About",
    "aboutpage.nav.changelog": "Changelog",
    "aboutpage.about.version": "Version {0}",
    "aboutpage.about.versionDev": "A development copy, not a release",
    "aboutpage.about.text": "MyFox tweaks is a set of user styles and settings for Firefox that changes how it looks and works: it brings back what Mozilla took out, adds what Firefox never had, and keeps the interface the way it is comfortable to use every day.",
    "aboutpage.links.heading": "Links",
    "aboutpage.links.tweaks": "The tweaks on GitHub",
    "aboutpage.links.myfox": "The MyFox installer on GitHub",
    "aboutpage.links.bookmarklets": "The bookmarklets on GitHub",
    "aboutpage.links.userscripts": "The userscripts on GitHub",
    "aboutpage.changelog.missing": "The changelog comes with releases; read it on GitHub",
    "aboutpage.nav.settings": "Settings",
    "aboutpage.appearance.label": "Appearance",
    "aboutpage.appearance.desc": "The browser's theme and the websites' appearance",
    "aboutpage.appearance.light": "Light",
    "aboutpage.appearance.dark": "Dark",
    "aboutpage.command.label": "Shell integration",
    "aboutpage.command.desc": "The {0} command in a terminal and in scripts opens the Firefox MyFox installed",
    "aboutpage.command.blocked": "Can't be switched on: {0} isn't MyFox's, and {1} is already there. Move one of them away first.",
    "aboutpage.command.savedBackup": "There was a file at {0}. It has been kept as {1}.",
    "aboutpage.command.restore": "Found {0}, the backup made when the integration was switched on. Restore it?",
    "aboutpage.command.restoreButton": "Restore",
    "aboutpage.command.keepButton": "Don't restore",
    "aboutpage.command.pathHint": "Checked against the PATH this browser was started with; a terminal's may differ",
    "aboutpage.command.shadowed": "Not working yet: {0} comes first in PATH",
    "aboutpage.command.notInPath": "Not working yet: {0} is not in PATH",
    "aboutpage.command.failed": "MyFox could not run the command (code {0})",
  };
})(globalThis.MyFox);
