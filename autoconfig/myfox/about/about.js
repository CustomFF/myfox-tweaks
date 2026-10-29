// about:myfox (see ../15-about-page.js): texts, sections, the changelog.
"use strict";

// The modules' string catalogs (../i18n/), picked as 00-common.js picks
// them: the browser's language, then English.
const MyFox = { messages: {} };
const langChain = [];
{
  const load = (code) => {
    try {
      Services.scriptloader.loadSubScript("resource://myfox/i18n/" + code + ".js", { MyFox, globalThis: { MyFox } });
    } catch(e) {}
    return !!MyFox.messages[code];
  };
  load("en");
  let tag = String(Services.locale.appLocaleAsBCP47 || "en").toLowerCase();
  for (let code of [tag, tag.split("-")[0]]) {
    if (code !== "en" && !langChain.includes(code) && load(code)) langChain.push(code);
  }
  langChain.push("en");
}
function t(key, ...args) {
  let msg;
  for (let code of langChain) {
    msg = (MyFox.messages[code] || {})[key];
    if (msg !== undefined) break;
  }
  if (msg === undefined) msg = key;
  return msg.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? args[i] : m));
}

// Released versions, newest first: changelog.json, put next to this page
// by scripts/build-tweaks-dist.sh. Not there (a copy from the repository):
// null.
async function loadChangelog() {
  try {
    let res = await fetch("resource://myfox/about/changelog.json");
    if (!res.ok) return null;
    return (await res.json()).versions;
  } catch(e) {
    return null;
  }
}

// "The firefox command" (MyFox >= 1.1.18): `firefox` on the command line
// runs this Firefox. MyFox does all of it; the page asks its launcher, named
// in <install>/myfox.json, for the state and to switch it, and shows what it
// answers. Tweaks put in by hand have no such file, and MyFox may since have
// been removed: no file, no "command" among its features, or no runnable
// launcher, and there is no setting at all.
async function loadMyfox() {
  try {
    let install = Services.dirsvc.get("GreD", Ci.nsIFile).path;
    let info = await IOUtils.readJSON(PathUtils.join(install, "myfox.json"));
    if (!info.launcher) return null;
    info.features ??= [];
    let { type, permissions } = await IOUtils.stat(info.launcher);
    return type === "regular" && (permissions & 0o111) ? info : null;
  } catch(e) {
    return null;
  }
}

// One `<launcher> ... --json` run: its JSON answer, or {error}. The child
// gets Firefox's environment (HOME, PATH, LANG: the paths and the language
// of its notes depend on it).
async function runMyfox(launcher, args) {
  try {
    const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
    let proc = await Subprocess.call({
      command: launcher,
      arguments: [...args, "--json"],
      environmentAppend: true,
      stderr: "pipe",
    });
    let out = "", chunk;
    while ((chunk = await proc.stdout.readString())) out += chunk;
    let err = "";
    while ((chunk = await proc.stderr.readString())) err += chunk;
    let { exitCode } = await proc.wait();
    try {
      return JSON.parse(out.trim());
    } catch(e) {
      return { error: (err || out).trim() || t("aboutpage.command.failed", exitCode) };
    }
  } catch(e) {
    return { error: String(e.message || e) };
  }
}
const runCommand = (launcher, args) => runMyfox(launcher, ["command", ...args]);

// A `<launcher> ...` run that answers in plain text, waited for: its exit
// code and what it said on stderr (MyFox's reason when it didn't do it).
async function runMyfoxPlain(launcher, args) {
  try {
    const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
    let proc = await Subprocess.call({ command: launcher, arguments: args, environmentAppend: true, stderr: "pipe" });
    let err = "", chunk;
    while ((chunk = await proc.stdout.readString())) {}
    while ((chunk = await proc.stderr.readString())) err += chunk;
    let { exitCode } = await proc.wait();
    return { ok: exitCode === 0, error: err.trim() || t("aboutpage.command.failed", exitCode) };
  } catch(e) {
    return { ok: false, error: String(e.message || e) };
  }
}

// A `<launcher> ...` run left to itself: MyFox closes this Firefox and shows
// its own window for the rest, so no answer comes back to the page.
function launchMyfox(launcher, args) {
  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(launcher);
  let proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
  proc.init(file);
  proc.runwAsync(args, args.length);
}

async function initCommandSetting(myfox) {
  if (!myfox?.features.includes("command")) return;
  document.getElementById("command-box").hidden = false;
  let toggle = document.getElementById("command-toggle");
  let status = document.getElementById("command-status");
  let title = t("aboutpage.command.label");
  toggle.ariaLabel = title;
  let [before, after] = t("aboutpage.command.desc", "\0").split("\0");
  let code = document.createElement("code");
  code.textContent = "firefox";
  document.getElementById("command-desc").append(before, code, after ?? "");

  // A MyFox with "command-backup" says where the backup of another
  // `firefox` is and can switch off without restoring it. Then another
  // `firefox` where the command goes while the backup's place is taken
  // too leaves MyFox nowhere to put it: it won't switch on.
  let canKeep = myfox.features.includes("command-backup");
  let blocked = (state) => canKeep && !state.on && !!state.replaces && !!state.backup;

  // One line at most under the setting: an error, why it can't be
  // switched on, or why, switched on, the command doesn't reach this
  // Firefox yet. MyFox's own notes are for its command line.
  let show = (state) => {
    let text = "", title = "";
    if (state.error) {
      text = state.error;
    } else {
      toggle.pressed = !!state.on;
      if (blocked(state)) {
        text = t("aboutpage.command.blocked", state.replaces, state.backup);
      } else if (state.on && state.path === "shadowed" && state.found_first) {
        text = t("aboutpage.command.shadowed", state.found_first);
      } else if (state.on && state.path === "not_in_path") {
        text = t("aboutpage.command.notInPath", PathUtils.parent(state.link));
      }
      // The PATH checked is the one Firefox was started with (the desktop
      // session's when started from a menu), not a terminal's.
      if (text && !blocked(state)) title = t("aboutpage.command.pathHint");
    }
    status.textContent = text;
    status.title = title;
    status.classList.toggle("error", !!state.error);
    status.hidden = !text;
    // The attribute, not the property: the property doesn't take it off,
    // and a form control with it gets no events.
    toggle.toggleAttribute("disabled", !!state.error || blocked(state));
  };

  // Without a first state there is nothing to switch: the setting stays
  // off and greyed, with the reason under it.
  let state = await runCommand(myfox.launcher, []);
  show(state);
  if (state.error) return;

  // Another `firefox` where the command goes is the user's: switching on,
  // MyFox keeps it aside as a backup, and the page says so afterwards.
  // Switching off, the user is asked whether to restore it (an older
  // MyFox always restores it).
  toggle.addEventListener("toggle", async () => {
    let on = toggle.pressed;
    let args = [on ? "on" : "off"];
    if (!on && canKeep && state.backup) {
      let ps = Services.prompt;
      let choice = ps.confirmEx(window, title, t("aboutpage.command.restore", state.backup),
        ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL +
          ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING,
        t("aboutpage.command.restoreButton"), null, t("aboutpage.command.keepButton"), null, {});
      if (choice === 1) {
        toggle.pressed = true;
        return;
      }
      if (choice === 2) args.push("--keep-backup");
    }
    let replaced = on ? state.replaces : null;
    toggle.toggleAttribute("disabled", true);
    let next = await runCommand(myfox.launcher, args);
    if (next.error) {
      toggle.pressed = !on;
      toggle.toggleAttribute("disabled", false);
    } else {
      state = next;
    }
    show(next);
    if (next.error) toggle.toggleAttribute("disabled", false);
    if (replaced && !next.error) {
      let backup = next.backup || replaced + ".myfox-backup";
      Services.prompt.alert(window, title, t("aboutpage.command.savedBackup", replaced, backup));
    }
  });
}

// Appearance: a MyFox theme and the websites' appearance (the setting in
// Firefox's own preferences) in the same light or dark. The card of the
// theme that is on is the chosen one; under any other theme, neither is.
const THEMES = [
  { key: "light", id: "myfox-light-theme@daydve.github.io", content: 1 },
  { key: "dark", id: "myfox-dark-theme@daydve.github.io", content: 0 },
];
const ACTIVE_THEME_PREF = "extensions.activeThemeID";
const CONTENT_SCHEME_PREF = "layout.css.prefers-color-scheme.content-override";

function mockWindow(key) {
  let mock = document.createElement("div");
  mock.className = "mock " + key;
  let tabs = document.createElement("div");
  tabs.className = "mock-tabs";
  for (let selected of [true, false, false]) {
    let tab = document.createElement("span");
    tab.className = "mock-tab" + (selected ? " selected" : "");
    tabs.appendChild(tab);
  }
  let toolbar = document.createElement("div");
  toolbar.className = "mock-toolbar";
  let url = document.createElement("span");
  url.className = "mock-url";
  toolbar.appendChild(url);
  let page = document.createElement("div");
  page.className = "mock-page";
  for (let cls of ["mock-line", "mock-line", "mock-line short"]) {
    let line = document.createElement("span");
    line.className = cls;
    page.appendChild(line);
  }
  mock.append(tabs, toolbar, page);
  return mock;
}

async function initAppearance() {
  const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
  // The themes come with MyFox or from the releases; put in by hand
  // without them, a card has nothing to switch to.
  let addons = await Promise.all(THEMES.map(th => AddonManager.getAddonByID(th.id).catch(() => null)));
  if (!addons.some(Boolean)) return;
  let box = document.getElementById("appearance-box");
  let group = box.querySelector(".theme-cards");
  group.ariaLabel = t("aboutpage.appearance.label");
  let cards = THEMES.map((th, i) => {
    let card = document.createElement("button");
    card.className = "theme-card";
    card.setAttribute("role", "radio");
    card.disabled = !addons[i];
    let name = document.createElement("span");
    name.textContent = t("aboutpage.appearance." + th.key);
    card.append(mockWindow(th.key), name);
    card.addEventListener("click", async () => {
      let addon = await AddonManager.getAddonByID(th.id);
      if (!addon) return;
      await addon.enable();
      Services.prefs.setIntPref(CONTENT_SCHEME_PREF, th.content);
    });
    group.appendChild(card);
    return card;
  });
  let sync = () => {
    let active = Services.prefs.getStringPref(ACTIVE_THEME_PREF, "");
    THEMES.forEach((th, i) => cards[i].setAttribute("aria-checked", th.id === active));
  };
  sync();
  Services.prefs.addObserver(ACTIVE_THEME_PREF, sync);
  window.addEventListener("unload", () => Services.prefs.removeObserver(ACTIVE_THEME_PREF, sync));
  box.hidden = false;
}

// Profiles (MyFox >= 1.2.1, "profiles" among its features): the profiles
// MyFox knows of, asked from it each time the section is shown (they change
// behind its back too, through firefox -P). What can be done while this
// Firefox runs is done here: open a profile in a window of its own, put
// the tweaks into one. Making another one the default, making a new one,
// importing one from another Firefox change profiles.ini, which this
// Firefox rewrites when it quits: those are a command to run with Firefox
// closed. Removing a profile isn't offered here at all.
const PROFILE_OWNERS = ["myfox", "ours", "unused", "foreign"];

function shellQuote(word) {
  return /^[A-Za-z0-9._@%+=:,\/-]+$/.test(word) ? word : "'" + word.replace(/'/g, "'\\''") + "'";
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat(langChain[0], { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch(e) {
    return iso;
  }
}

async function initProfiles(myfox) {
  if (!myfox?.features.includes("profiles")) return;
  document.querySelector('.nav-item[data-section="profiles"]').hidden = false;
  showSection();
  let list = document.getElementById("profiles-list");
  let status = document.getElementById("profiles-status");
  let commandBox = document.getElementById("profiles-command");
  let foreignBox = document.getElementById("profiles-foreign");
  let busy = false;
  // MyFox with "profiles-import" imports and switches profiles itself: it
  // closes this Firefox, does it in its own window and starts Firefox
  // again. An older one leaves both as commands for the terminal.
  let canImport = myfox.features.includes("profiles-import");
  let names = new Map();
  if (canImport) {
    let desc = document.getElementById("profiles-foreign-desc");
    desc.dataset.l10n = "aboutpage.profiles.foreignDescImport";
    desc.textContent = t(desc.dataset.l10n);
  }

  const button = (label, onClick) => {
    let b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  };
  const showStatus = (text, error) => {
    status.textContent = text || "";
    status.classList.toggle("error", !!error);
    status.hidden = !text;
  };
  // A command for the terminal, with Firefox closed.
  const commandLine = (args) => ["myfox", ...args.map(shellQuote)].join(" ");
  const copyText = (text) => Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper).copyString(text);
  const showCommand = (args) => {
    let line = commandLine(args);
    commandBox.querySelector("code").textContent = line;
    commandBox.hidden = false;
    commandBox.scrollIntoView({ block: "nearest" });
  };
  commandBox.querySelector("button").addEventListener("click", () => {
    copyText(commandBox.querySelector("code").textContent);
  });

  const openProfile = (p) => {
    try {
      let starter = Services.dirsvc.get("GreD", Ci.nsIFile);
      starter.append("firefox-myfox");
      let proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
      proc.init(starter);
      // No --no-remote: Firefox keeps one instance per profile anyway, and
      // one that took it would refuse MyFox's --myfox-quit before an import.
      proc.runwAsync(["--profile", p.path], 2);
      showStatus("");
    } catch(e) {
      showStatus(String(e.message || e), true);
    }
  };
  const applyTweaks = async (p) => {
    if (busy) return;
    busy = true;
    showStatus(t("aboutpage.profiles.applying", p.name));
    let res = await runMyfox(myfox.launcher, ["profile", "apply", p.id]);
    busy = false;
    if (res.error) showStatus(res.error, true);
    else { showStatus(""); load(); }
  };

  // Making a MyFox profile the default: MyFox closes Firefox and starts it
  // again in that profile, so it asks first.
  const useProfile = (p) => {
    let ok = Services.prompt.confirmEx(window, t("aboutpage.profiles.useTitle"),
      t("aboutpage.profiles.useText", p.name),
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
      Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL,
      t("aboutpage.profiles.use"), null, null, null, {}) === 0;
    if (ok) launchMyfox(myfox.launcher, ["profile", "use", p.id, "--relaunch", "--gui"]);
  };

  // Importing a profile of another Firefox: a panel under its row with the
  // choices, then MyFox takes over (see launchMyfox).
  const field = (cls, ...children) => {
    let div = document.createElement("div");
    div.className = "import-field" + (cls ? " " + cls : "");
    div.append(...children);
    return div;
  };
  const choice = (type, group, value, label, checked) => {
    let l = document.createElement("label");
    let input = document.createElement("input");
    input.type = type;
    if (group) input.name = group;
    input.value = value;
    input.checked = !!checked;
    l.append(input, label);
    return l;
  };
  const importPanel = (p) => {
    let panel = document.createElement("div");
    panel.className = "import-panel";
    let group = "import-" + p.id;

    let copy = choice("radio", group + "-mode", "copy", t("aboutpage.profiles.import.copy"), true);
    let move = choice("radio", group + "-mode", "move", t("aboutpage.profiles.import.move"));
    let moveNote = document.createElement("div");
    moveNote.className = "setting-desc";
    moveNote.textContent = t("aboutpage.profiles.import.moveNote");
    moveNote.hidden = true;

    // The Firefox account: only a copy of a signed-in profile has a choice;
    // a moved profile takes it along.
    let syncTitle = document.createElement("div");
    syncTitle.className = "import-label";
    syncTitle.textContent = t("aboutpage.profiles.import.sync");
    let syncs = ["none", "move", "copy"].map((v, i) =>
      choice("radio", group + "-sync", v, t("aboutpage.profiles.import.sync." + v), i === 0));
    let sync = field("import-sync", syncTitle, ...syncs);
    sync.hidden = !p.account;

    let nameLabel = document.createElement("label");
    nameLabel.className = "import-name";
    let name = document.createElement("input");
    name.type = "text";
    name.value = t("aboutpage.profiles.import.nameDefault", p.name);
    nameLabel.append(t("aboutpage.profiles.import.name"), name);

    let use = choice("checkbox", null, "use", t("aboutpage.profiles.use"));
    let open = choice("checkbox", null, "open", t("aboutpage.profiles.import.open"));

    let start = document.createElement("button");
    start.className = "primary";
    start.textContent = t("aboutpage.profiles.import.start");
    let hint = document.createElement("span");
    hint.className = "setting-desc";

    const args = () => {
      let moving = move.querySelector("input").checked;
      let a = ["profile", "import", p.id];
      if (moving) a.push("--move");
      else if (p.account) a.push("--sync", syncs.find(s => s.querySelector("input").checked).querySelector("input").value);
      let n = name.value.trim();
      if (n) a.push("--name", n);
      if (use.querySelector("input").checked) a.push("--use");
      else if (open.querySelector("input").checked) a.push("--open");
      return a;
    };

    // A profile last used by a newer Firefox: MyFox refuses it unless told
    // to, and that only from the terminal, at the user's own risk.
    let lastVersion = String(p.last_version || "").split("_")[0];
    let newer = !!lastVersion && Services.vc.compare(lastVersion, Services.appinfo.version) > 0;
    let downgrade = document.createElement("div");
    downgrade.className = "import-downgrade";
    downgrade.hidden = !newer;
    let downNote = document.createElement("div");
    downNote.className = "setting-desc";
    downNote.textContent = t("aboutpage.profiles.import.newer", lastVersion, Services.appinfo.version);
    let downLine = document.createElement("div");
    downLine.className = "command-line";
    let downCode = document.createElement("code");
    let downCopy = document.createElement("button");
    downCopy.textContent = t("aboutpage.profiles.copy");
    downCopy.addEventListener("click", () => copyText(downCode.textContent));
    downLine.append(downCode, downCopy);
    downgrade.append(downNote, downLine);

    const update = () => {
      let moving = move.querySelector("input").checked;
      moveNote.hidden = !moving;
      sync.hidden = moving || !p.account;
      open.hidden = use.querySelector("input").checked;
      start.disabled = p.open || newer;
      hint.textContent = p.open ? t("aboutpage.profiles.import.isOpen") : "";
      downCode.textContent = commandLine([...args(), "--allow-downgrade", "--relaunch"]);
    };
    panel.addEventListener("change", update);
    name.addEventListener("input", update);
    start.addEventListener("click", () => {
      start.disabled = true;
      launchMyfox(myfox.launcher, [...args(), "--relaunch", "--gui"]);
      showStatus(t("aboutpage.profiles.import.started"));
    });

    panel.append(
      field("", copy, move, moveNote),
      sync,
      field("", nameLabel),
      field("", use, open),
      field("import-start", start, hint),
      downgrade);
    update();
    return panel;
  };

  // Deleting a profile MyFox made (MyFox 1.3.1 or newer, "profiles-remove"):
  // asked here, then MyFox deletes it with no questions, this Firefox open.
  // A copy whose import moved the Firefox account in from another profile
  // gives it back there unless told to keep it.
  let canRemove = myfox.features.includes("profiles-remove");
  const removeProfile = async (p) => {
    if (busy) return;
    let ps = Services.prompt;
    let giveBack = p.account && p.imported_from && !p.moved;
    let check = { value: true };
    let from = names.get(p.imported_from) || p.imported_from;
    let ok = ps.confirmEx(window, t("aboutpage.profiles.removeTitle"), t("aboutpage.profiles.removeText", p.name),
      ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL + ps.BUTTON_POS_1_DEFAULT,
      t("aboutpage.profiles.remove"), null, null,
      giveBack ? t("aboutpage.profiles.removeGiveBack", from) : null, check) === 0;
    if (!ok) return;
    busy = true;
    showStatus(t("aboutpage.profiles.removing", p.name));
    let args = ["profile", "remove", p.id, "-y"];
    if (giveBack && !check.value) args.push("--no-restore-sync");
    let res = await runMyfoxPlain(myfox.launcher, args);
    busy = false;
    showStatus(res.ok ? t("aboutpage.profiles.removed", p.name) : res.error, !res.ok);
    load();
  };

  const row = (p, foreign) => {
    let item = document.createElement("div");
    item.className = "profile";
    let info = document.createElement("div");
    info.className = "profile-info";
    let name = document.createElement("div");
    name.className = "profile-name";
    name.textContent = p.name;
    for (let [on, key] of [[p.used, "isDefault"], [p.open, "isOpen"]]) {
      if (!on) continue;
      let badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = t("aboutpage.profiles." + key);
      name.appendChild(badge);
    }
    let details = [];
    if (!foreign && PROFILE_OWNERS.includes(p.owner)) details.push(t("aboutpage.profiles.owner." + p.owner));
    if (p.last_used) details.push(t("aboutpage.profiles.lastUsed", formatDate(p.last_used)));
    if (p.imported_from) {
      // Where it came from, by that profile's name while it is still there.
      let from = names.get(p.imported_from);
      details.push(p.moved ? t("aboutpage.profiles.movedFrom", p.imported_from)
        : from ? t("aboutpage.profiles.importedFromName", from)
        : t("aboutpage.profiles.importedFrom", p.imported_from));
    }
    let desc = document.createElement("div");
    desc.className = "setting-desc";
    desc.textContent = details.join(" · ");
    let path = document.createElement("div");
    path.className = "profile-path";
    path.textContent = p.path;
    info.append(name, desc, path);
    let actions = document.createElement("div");
    actions.className = "profile-actions";
    if (foreign && canImport) {
      let panel = null;
      actions.append(button(t("aboutpage.profiles.import"), () => {
        if (panel) { panel.hidden = !panel.hidden; return; }
        panel = importPanel(p);
        item.append(panel);
      }));
    } else if (foreign) {
      actions.append(button(t("aboutpage.profiles.import"), () => showCommand(["profile", "import", p.id])));
    } else {
      if (!p.open && ["myfox", "ours", "unused"].includes(p.owner)) {
        let launch = button(t("aboutpage.profiles.open"), () => openProfile(p));
        launch.title = t("aboutpage.profiles.openTitle");
        actions.append(launch);
      }
      if (!p.open && !p.tweaks && ["ours", "unused"].includes(p.owner)) {
        actions.append(button(t("aboutpage.profiles.apply"), () => applyTweaks(p)));
      }
      if (!p.used) {
        actions.append(button(t("aboutpage.profiles.use"),
          () => canImport ? useProfile(p) : showCommand(["profile", "use", p.id])));
      }
      // Only what MyFox made can go, and not while in use; an older MyFox
      // deletes it only with its Firefox closed: a command for the terminal.
      if (p.created && !p.used && !p.open) {
        actions.append(button(t("aboutpage.profiles.remove"),
          () => canRemove ? removeProfile(p) : showCommand(["profile", "remove", p.id])));
      }
    }
    item.append(info, actions);
    return item;
  };

  async function load() {
    if (canImport) {
      let all = await runMyfox(myfox.launcher, ["profile", "list", "--all"]);
      if (Array.isArray(all)) names = new Map(all.map(p => [p.path, p.name]));
    }
    let res = await runMyfox(myfox.launcher, ["profile", "list"]);
    list.textContent = "";
    if (res.error || !Array.isArray(res)) {
      showStatus(res.error || t("aboutpage.command.failed", ""), true);
      return;
    }
    for (let p of res) list.appendChild(row(p, false));
  }
  async function loadForeign() {
    let res = await runMyfox(myfox.launcher, ["profile", "list", "--all"]);
    let rows = foreignBox.querySelector(".profiles-foreign-list");
    rows.textContent = "";
    if (res.error || !Array.isArray(res)) {
      showStatus(res.error || t("aboutpage.command.failed", ""), true);
      return;
    }
    let foreign = res.filter(p => p.owner === "foreign");
    if (!foreign.length) {
      let none = document.createElement("div");
      none.className = "setting-desc";
      none.textContent = t("aboutpage.profiles.noForeign");
      rows.appendChild(none);
    }
    for (let p of foreign) rows.appendChild(row(p, true));
  }

  document.getElementById("profiles-new").addEventListener("click", () => showCommand(["profile", "new", "--use"]));
  document.getElementById("profiles-import").addEventListener("click", () => {
    foreignBox.hidden = !foreignBox.hidden;
    if (!foreignBox.hidden) loadForeign();
  });
  document.getElementById("profiles-box").hidden = false;
  load();
  window.addEventListener("hashchange", () => { if (location.hash === "#profiles") load(); });
}

// What's available, from GitHub for now (later the project's site): the
// released tweaks' and MyFox core's changelogs, newest version first.
const TWEAKS_CHANGELOG_URL = "https://github.com/CustomFF/myfox-tweaks/releases/latest/download/changelog.json";
const CORE_CHANGELOG_URL = "https://github.com/CustomFF/myfox/releases/latest/download/changelog.json";

async function fetchChangelog(url) {
  try {
    let res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).versions || null;
  } catch(e) {
    return null;
  }
}

// Dotted versions compared number by number (159.10 is newer than 159.9).
function compareVersions(a, b) {
  let pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    let d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
const newerThan = (versions, current) =>
  (versions || []).filter(v => !current || compareVersions(v.version, current) > 0);

// A box per version: its number, date and changes; one not installed yet
// (a newer release) marked so.
function versionBox(v, notInstalled) {
  let box = document.createElement("div");
  box.className = "box";
  let h = document.createElement("h3");
  h.textContent = v.version;
  let date = document.createElement("span");
  date.className = "date";
  date.textContent = v.date;
  h.appendChild(date);
  if (notInstalled) {
    let badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = t("aboutpage.changelog.notInstalled");
    h.appendChild(badge);
  }
  let ul = document.createElement("ul");
  for (let change of v.changes) {
    let li = document.createElement("li");
    li.textContent = change;
    ul.appendChild(li);
  }
  box.append(h, ul);
  return box;
}

function renderChangelog(versions, installedVersion) {
  let list = document.getElementById("changelog-list");
  list.textContent = "";
  if (!versions?.length) {
    let p = document.createElement("p");
    let a = document.createElement("a");
    a.href = "https://github.com/CustomFF/myfox-tweaks/blob/master/CHANGELOG.md";
    a.textContent = t("aboutpage.changelog.missing");
    p.appendChild(a);
    list.appendChild(p);
    return;
  }
  for (let v of versions) {
    list.appendChild(versionBox(v, installedVersion && compareVersions(v.version, installedVersion) > 0));
  }
}

// Updates: the tweaks and MyFox core, what is installed and what is out,
// with the changes in between. With MyFox 1.2.2 or newer ("update" among
// its features) a button installs them all through `myfox refresh --json`;
// what Firefox reads at startup takes a restart, which the page offers.
async function initUpdates(myfox, tweaksInstalled, tweaksReleased) {
  let box = document.getElementById("updates-box");
  let status = document.getElementById("updates-status");
  let installButton = document.getElementById("updates-install");
  let checkButton = document.getElementById("updates-check");
  let changes = document.getElementById("updates-changes");
  let canInstall = !!myfox?.features.includes("update");
  const showStatus = (text, error) => {
    status.textContent = text || "";
    status.classList.toggle("error", !!error);
    status.hidden = !text;
  };
  const line = (key, installed, latest) => {
    let row = document.createElement("div");
    row.className = "update-line";
    let name = document.createElement("span");
    name.className = "setting-label";
    name.textContent = t("aboutpage.updates." + key);
    let state = document.createElement("span");
    state.className = "setting-desc";
    state.textContent = !latest ? t("aboutpage.updates.unknown", installed || "?")
      : installed && compareVersions(latest, installed) <= 0 ? t("aboutpage.updates.upToDate", installed)
      : t("aboutpage.updates.available", installed || "?", latest);
    row.append(name, state);
    return row;
  };

  async function check(tweaksReleasedNow) {
    showStatus("");
    let tweaks = tweaksReleasedNow ?? await fetchChangelog(TWEAKS_CHANGELOG_URL);
    let core = myfox ? await fetchChangelog(CORE_CHANGELOG_URL) : null;
    let rows = document.getElementById("updates-versions");
    rows.textContent = "";
    rows.appendChild(line("tweaks", tweaksInstalled, tweaks?.[0]?.version));
    if (myfox) rows.appendChild(line("core", myfox.version, core?.[0]?.version));
    if (!tweaks && (!myfox || !core)) showStatus(t("aboutpage.updates.offline"), true);
    changes.textContent = "";
    let newTweaks = newerThan(tweaks, tweaksInstalled);
    let newCore = myfox ? newerThan(core, myfox.version) : [];
    for (let [key, list] of [["tweaks", newTweaks], ["core", newCore]]) {
      if (!list.length) continue;
      let h = document.createElement("h3");
      h.textContent = t("aboutpage.updates." + key);
      changes.appendChild(h);
      for (let v of list) changes.appendChild(versionBox(v, false));
    }
    installButton.hidden = !canInstall || !(newTweaks.length || newCore.length);
  }

  installButton.addEventListener("click", async () => {
    installButton.disabled = checkButton.disabled = true;
    showStatus(t("aboutpage.updates.installing"));
    let res = await runMyfox(myfox.launcher, ["refresh"]);
    installButton.disabled = checkButton.disabled = false;
    if (res.error || !res.ok) {
      showStatus(res.error || t("aboutpage.command.failed", ""), true);
      return;
    }
    let done = (res.updated || []).map(u => t("aboutpage.updates.track." + u.track) + " " + u.to).join(", ");
    showStatus(done ? t("aboutpage.updates.installed", done) : t("aboutpage.updates.nothing"));
    if (res.restart && offerRestart()) return;
    check();
  });
  checkButton.addEventListener("click", () => check());
  box.hidden = false;
  check(tweaksReleased);
}

// Updates through MyFox's own check (MyFox 1.2.4 or newer, "update-check"):
// `myfox refresh --check` asks what's new for all four parts (the tweaks,
// the themes, the bookmarklets, MyFox itself) and keeps the answer in
// <install>/myfox-updates.json, which the page shows on every visit without
// going to the network. MyFox takes out of it what it installed; what it
// still lists but this install already has (an update from elsewhere) is
// left out here.
const UPDATE_TRACKS = ["tweaks", "themes", "bookmarklets", "core"];

async function loadUpdateCheck() {
  try {
    let install = Services.dirsvc.get("GreD", Ci.nsIFile).path;
    return await IOUtils.readJSON(PathUtils.join(install, "myfox-updates.json"));
  } catch(e) {
    return null;
  }
}

function pendingUpdates(check, tweaksInstalled, coreInstalled) {
  let installed = { tweaks: tweaksInstalled, core: coreInstalled };
  return (check?.updates || [])
    .filter(u => UPDATE_TRACKS.includes(u.track))
    .filter(u => !installed[u.track] || !u.to || compareVersions(u.to, installed[u.track]) > 0)
    .sort((a, b) => UPDATE_TRACKS.indexOf(a.track) - UPDATE_TRACKS.indexOf(b.track));
}

async function initCheckedUpdates(myfox, tweaksInstalled, onTweaksPending) {
  let box = document.getElementById("updates-box");
  let status = document.getElementById("updates-status");
  let installButton = document.getElementById("updates-install");
  let checkButton = document.getElementById("updates-check");
  let changes = document.getElementById("updates-changes");
  let canInstall = myfox.features.includes("update");
  checkButton.dataset.l10n = "aboutpage.updates.checkNow";
  checkButton.textContent = t(checkButton.dataset.l10n);
  const showStatus = (text, error) => {
    status.textContent = text || "";
    status.classList.toggle("error", !!error);
    status.hidden = !text;
  };
  const line = (label, text) => {
    let row = document.createElement("div");
    row.className = "update-line";
    let name = document.createElement("span");
    name.className = "setting-label";
    name.textContent = label;
    let state = document.createElement("span");
    state.className = "setting-desc";
    state.textContent = text;
    row.append(name, state);
    return row;
  };

  function render(check) {
    let pending = pendingUpdates(check, tweaksInstalled, myfox.version);
    let byTrack = Object.fromEntries(pending.map(u => [u.track, u]));
    let rows = document.getElementById("updates-versions");
    rows.textContent = "";
    // The tweaks and MyFox always (this page knows what's installed of
    // them), the themes and the bookmarklets when there's something new.
    for (let track of UPDATE_TRACKS) {
      let u = byTrack[track];
      let installed = { tweaks: tweaksInstalled, core: myfox.version }[track];
      let label = track === "tweaks" || track === "core"
        ? t("aboutpage.updates." + track)
        : t("aboutpage.updates.label." + track);
      if (u) rows.appendChild(line(label, t("aboutpage.updates.available", u.from || installed || "?", u.to || "?")));
      else if (installed) rows.appendChild(line(label, check
        ? t("aboutpage.updates.upToDate", installed)
        : t("aboutpage.updates.unknownYet", installed)));
    }
    let when = check?.checked ? new Date(check.checked) : null;
    let checkedText = when && !isNaN(when)
      ? t("aboutpage.updates.lastCheck", when.toLocaleString(langChain[0], { dateStyle: "medium", timeStyle: "short" }))
      : t("aboutpage.updates.neverChecked");
    let checked = document.createElement("div");
    checked.className = "setting-desc update-checked";
    checked.textContent = checkedText;
    rows.appendChild(checked);

    changes.textContent = "";
    for (let u of pending) {
      if (!u.changes?.length) continue;
      let h = document.createElement("h3");
      h.textContent = t("aboutpage.updates." + u.track);
      changes.appendChild(h);
      changes.appendChild(versionBox({ version: u.to, date: "", changes: u.changes }, false));
    }
    installButton.hidden = !canInstall || !pending.length;
    onTweaksPending(byTrack.tweaks || null);
  }

  checkButton.addEventListener("click", async () => {
    installButton.disabled = checkButton.disabled = true;
    showStatus(t("aboutpage.updates.checking"));
    let res = await runMyfox(myfox.launcher, ["refresh", "--check"]);
    installButton.disabled = checkButton.disabled = false;
    if (res.error || !Array.isArray(res.updates)) {
      showStatus(res.error || t("aboutpage.command.failed", ""), true);
      return;
    }
    showStatus("");
    render(res);
  });
  installButton.addEventListener("click", async () => {
    installButton.disabled = checkButton.disabled = true;
    showStatus(t("aboutpage.updates.installing"));
    let res = await runMyfox(myfox.launcher, ["refresh"]);
    installButton.disabled = checkButton.disabled = false;
    if (res.error || !res.ok) {
      showStatus(res.error || t("aboutpage.command.failed", ""), true);
      return;
    }
    let done = (res.updated || []).map(u => t("aboutpage.updates.track." + u.track) + " " + u.to).join(", ");
    showStatus(done ? t("aboutpage.updates.installed", done) : t("aboutpage.updates.nothing"));
    // What was just installed is on disk, not yet in this page (nor in the
    // myfox.json it read): it counts as installed from here on.
    let installedNow = Object.fromEntries((res.updated || []).map(u => [u.track, u.to]));
    if (installedNow.tweaks) tweaksInstalled = installedNow.tweaks;
    if (installedNow.core) myfox.version = installedNow.core;
    render(await loadUpdateCheck());
    if (res.restart) offerRestart();
  });
  box.hidden = false;
  render(await loadUpdateCheck());
}

// What Firefox reads at startup takes a restart, which the page offers.
function offerRestart() {
  let ps = Services.prompt;
  let restart = ps.confirmEx(window, t("aboutpage.updates.restartTitle"), t("aboutpage.updates.restartText"),
    ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING + ps.BUTTON_POS_0_DEFAULT,
    t("aboutpage.updates.restartNow"), t("aboutpage.updates.restartLater"), null, null, {}) === 0;
  if (!restart) return false;
  let cancel = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
  Services.obs.notifyObservers(cancel, "quit-application-requested", "restart");
  if (!cancel.data) Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
  return true;
}

function showSection() {
  // A section whose menu item is hidden (settings without MyFox) isn't one.
  let id = location.hash.slice(1);
  let item = document.querySelector(`.nav-item[data-section="${CSS.escape(id)}"]`);
  if (!document.getElementById(id)?.matches("section") || !item || item.hidden) id = "about";
  for (let section of document.querySelectorAll("main > section")) {
    section.hidden = section.id !== id;
  }
  for (let item of document.querySelectorAll(".nav-item")) {
    item.classList.toggle("selected", item.dataset.section === id);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  document.documentElement.lang = langChain[0];
  for (let el of document.querySelectorAll("[data-l10n]")) {
    el.textContent = t(el.dataset.l10n);
  }
  document.title = t("aboutpage.title");
  showSection();
  window.addEventListener("hashchange", showSection);
  initAppearance();
  let myfox = await loadMyfox();
  initCommandSetting(myfox);
  initProfiles(myfox);

  // The installed tweaks' changelog, and the released one (newer versions
  // too) from GitHub for the changelog section and the updates.
  let installed = await loadChangelog();
  let installedVersion = installed?.[0]?.version || null;
  let version = document.getElementById("about-version");
  version.textContent = installedVersion
    ? t("aboutpage.about.version", installedVersion)
    : t("aboutpage.about.versionDev");
  // The installed changelog always, with only the released versions newer
  // than it added on top: no network, and it's still all there. With
  // MyFox's own check those come from its last answer, without dates.
  if (myfox?.features.includes("update-check")) {
    renderChangelog(installed, installedVersion);
    initCheckedUpdates(myfox, installedVersion, (u) => {
      let newer = u?.to && u.changes?.length ? [{ version: u.to, date: "", changes: u.changes }] : [];
      renderChangelog([...newer, ...(installed || [])], installedVersion);
    });
    return;
  }
  let released = await fetchChangelog(TWEAKS_CHANGELOG_URL);
  renderChangelog([...newerThan(released, installedVersion), ...(installed || [])], installedVersion);
  initUpdates(myfox, installedVersion, released);
});

