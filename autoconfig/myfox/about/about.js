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

function showSection() {
  let id = location.hash.slice(1);
  if (!document.getElementById(id)?.matches("section")) id = "about";
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
