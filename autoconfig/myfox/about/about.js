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
    if (!info.features?.includes("command") || !info.launcher) return null;
    let { type, permissions } = await IOUtils.stat(info.launcher);
    return type === "regular" && (permissions & 0o111) ? info : null;
  } catch(e) {
    return null;
  }
}

// One `<launcher> command ... --json` run: its JSON answer, or {error}. The
// child gets Firefox's environment (HOME, PATH, LANG: the paths and the
// language of its notes depend on it).
async function runCommand(launcher, args) {
  try {
    const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
    let proc = await Subprocess.call({
      command: launcher,
      arguments: ["command", ...args, "--json"],
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

async function initCommandSetting() {
  let myfox = await loadMyfox();
  if (!myfox) return;
  document.querySelector('.nav-item[data-section="settings"]').hidden = false;
  showSection();
  let toggle = document.getElementById("command-toggle");
  let status = document.getElementById("command-status");
  toggle.ariaLabel = t("aboutpage.command.label");
  let [before, after] = t("aboutpage.command.desc", "\0").split("\0");
  let code = document.createElement("code");
  code.textContent = "firefox";
  document.getElementById("command-desc").append(before, code, after ?? "");

  // One quiet line at most: an error, or why the command, switched on,
  // doesn't reach this Firefox yet. MyFox's own notes are for its command
  // line; what they warn of before switching on, the confirmation says.
  let show = (state) => {
    let text = "", title = "";
    if (state.error) {
      text = state.error;
    } else {
      toggle.pressed = !!state.on;
      // The PATH checked is the one Firefox was started with (the desktop
      // session's when started from a menu), not a terminal's.
      if (state.on && state.path === "shadowed" && state.found_first) {
        text = t("aboutpage.command.shadowed", state.found_first);
      } else if (state.on && state.path === "not_in_path") {
        text = t("aboutpage.command.notInPath", PathUtils.parent(state.link));
      }
      if (text) title = t("aboutpage.command.pathHint");
    }
    status.textContent = text;
    status.title = title;
    status.classList.toggle("error", !!state.error);
    status.hidden = !text;
  };

  // Without a first state there is nothing to switch: the setting stays
  // off and greyed, with the reason under it.
  let state = await runCommand(myfox.launcher, []);
  show(state);
  if (state.error) return;
  // The attribute, not the property: the property doesn't take it off, and
  // a form control with it gets no events.
  toggle.toggleAttribute("disabled", false);
  toggle.addEventListener("toggle", async () => {
    let on = toggle.pressed;
    // Another `firefox` there: MyFox keeps it aside and puts it back when
    // switched off, but it is the user's, so ask first.
    if (on && state.replaces && !window.confirm(t("aboutpage.command.replace", state.replaces))) {
      toggle.pressed = false;
      return;
    }
    toggle.toggleAttribute("disabled", true);
    let next = await runCommand(myfox.launcher, [on ? "on" : "off"]);
    if (next.error) toggle.pressed = !on;
    else state = next;
    show(next);
    toggle.toggleAttribute("disabled", false);
  });
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
  initCommandSetting();

  let versions = await loadChangelog();
  let version = document.getElementById("about-version");
  version.textContent = versions?.length
    ? t("aboutpage.about.version", versions[0].version)
    : t("aboutpage.about.versionDev");

  let list = document.getElementById("changelog-list");
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
    let box = document.createElement("div");
    box.className = "box";
    let h = document.createElement("h3");
    h.textContent = v.version;
    let date = document.createElement("span");
    date.className = "date";
    date.textContent = v.date;
    h.appendChild(date);
    let ul = document.createElement("ul");
    for (let change of v.changes) {
      let li = document.createElement("li");
      li.textContent = change;
      ul.appendChild(li);
    }
    box.append(h, ul);
    list.appendChild(box);
  }
});
