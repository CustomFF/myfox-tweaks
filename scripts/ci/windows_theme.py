#!/usr/bin/env python3
# windows_theme.py <firefox dir> <profile dir> <out dir>: on a Windows
# desktop (GitHub's windows runner), switches the MyFox themes the ways a
# user does and checks what is on the screen: the toolbar and an open menu
# must be in the colors of the theme that is on. Firefox must be running
# with --start-debugger-server 6000 on that profile (the workflow starts it).
# Writes screenshots and report.json into <out dir>; exits 1 if a check fails.
#
# Why on a real desktop: on Windows 11 (and Server 2025) Firefox draws menus
# as the system's own, over a Mica backdrop (widget.windows.mica.popups), and
# only a screenshot shows what the user sees there.
import json, os, socket, sys, time
from PIL import ImageGrab

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from reload_userchrome import send_msg, read_msg

FF, PROFILE, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
DARK = "myfox-dark-theme@daydve.github.io"
LIGHT = "myfox-light-theme@daydve.github.io"
# The themes' "popup" and "toolbar" colors (themes/*/manifest.json).
EXPECT = {}
for th, key in ((DARK, "myfox-dark"), (LIGHT, "myfox-light")):
    m = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "themes", key, "manifest.json")))
    rgb = lambda s: tuple(int(float(x)) for x in s[s.index("(") + 1:s.index(")")].split(",")[:3])
    EXPECT[th] = {"menu": rgb(m["theme"]["colors"]["popup"]), "toolbar": rgb(m["theme"]["colors"]["toolbar"])}


class Rdp:
    def __init__(self, port=6000):
        for _ in range(90):
            try:
                self.s = socket.create_connection(("127.0.0.1", port))
                break
            except OSError:
                time.sleep(1)
        else:
            raise SystemExit("no debugger server on " + str(port))
        read_msg(self.s)
        send_msg(self.s, {"to": "root", "type": "getProcess", "id": 0})
        desc = read_msg(self.s)["processDescriptor"]["actor"]
        send_msg(self.s, {"to": desc, "type": "getTarget"})
        while True:
            m = read_msg(self.s)
            if m.get("from") == desc:
                break
        self.con = m["process"]["consoleActor"]

    def js(self, code):
        send_msg(self.s, {"to": self.con, "type": "evaluateJSAsync",
                          "text": "(async()=>{" + code + "})()", "mapped": {"await": True}})
        rid = None
        while True:
            m = read_msg(self.s)
            if m.get("from") == self.con and "resultID" in m and rid is None:
                rid = m["resultID"]
                continue
            if m.get("type") == "evaluationResult" and m.get("resultID") == rid:
                if m.get("exceptionMessage"):
                    raise RuntimeError(m["exceptionMessage"])
                r = m.get("result")
                return json.loads(r) if isinstance(r, str) else r


PRELUDE = """
const w = Services.wm.getMostRecentWindow("navigator:browser"); const d = w.document;
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const sleep = ms => new Promise(r => w.setTimeout(r, ms));
"""

STATE = PRELUDE + """
const nav = d.getElementById("nav-bar").getBoundingClientRect();
const mp = d.getElementById("toolbar-context-menu");
const part = mp.shadowRoot?.querySelector('[part~="content"]');
return JSON.stringify({
  os: Services.sysinfo.getProperty("version") + " build " + Services.sysinfo.getProperty("build"),
  firefox: Services.appinfo.version,
  active: Services.prefs.getStringPref("extensions.activeThemeID", ""),
  contentScheme: Services.prefs.getIntPref("layout.css.prefers-color-scheme.content-override", -1),
  chromeDark: w.matchMedia("(prefers-color-scheme: dark)").matches,
  micaPopups: w.matchMedia("(-moz-windows-mica-popups)").matches,
  micaPref: Services.prefs.getIntPref("widget.windows.mica.popups", -1),
  menuAppearance: w.getComputedStyle(mp).appearance,
  menuVar: w.getComputedStyle(mp).getPropertyValue("--panel-background-color"),
  menuPartBg: part ? w.getComputedStyle(part).backgroundColor : null,
  dpr: w.devicePixelRatio,
  navbar: { x: w.mozInnerScreenX + nav.x, y: w.mozInnerScreenY + nav.y, w: nav.width, h: nav.height },
});
"""

OPEN_MENU = PRELUDE + """
const mp = d.getElementById("toolbar-context-menu");
const shown = new Promise(r => mp.addEventListener("popupshown", r, { once: true }));
mp.openPopup(d.getElementById("nav-bar"), "after_start", 200, 0, true);
await shown; await sleep(800);
const r = mp.getOuterScreenRect();
return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height });
"""

CLOSE_MENU = PRELUDE + """
d.getElementById("toolbar-context-menu").hidePopup(); await sleep(400); return "1";
"""

# about:myfox, Settings > Appearance: a click on the card, as a user does.
VIA_ABOUT = PRELUDE + """
const tab = w.gBrowser.addTrustedTab("about:myfox#settings"); w.gBrowser.selectedTab = tab;
const b = tab.linkedBrowser;
for (let i = 0; i < 60; i++) { await sleep(250); if (b.contentDocument?.querySelector(".theme-card")) break; }
const cards = [...b.contentDocument.querySelectorAll(".theme-card")];
if (!cards.length) throw new Error("no theme cards in about:myfox");
cards[__INDEX__].click();
await sleep(2500);
w.gBrowser.removeTab(tab); await sleep(500);
return "1";
"""

# about:addons, Themes: "Enable", which is addon.enable().
VIA_ADDONS = PRELUDE + """
const a = await AddonManager.getAddonByID("__ID__"); await a.enable(); await sleep(2500); return "1";
"""


def pixel_mode(img, box):
    """The most common color in box (left, top, right, bottom): the fill,
    whatever text and icons are on it."""
    crop = img.crop(box).convert("RGB")
    colors = crop.getcolors(crop.width * crop.height)
    return max(colors)[1]


def close(a, b, tol=6):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


report = {"steps": [], "ok": True}
rdp = Rdp()
# The theme add-ons are enabled by 75-theme.js once the window is up.
# Until then there may be no browser window yet (no answer, or an error).
for _ in range(60):
    try:
        st = rdp.js(STATE)
    except RuntimeError:
        st = None
    if st and st["active"] == DARK:
        break
    time.sleep(1)


def check(name):
    st = rdp.js(STATE)
    k = st["dpr"]
    rect = rdp.js(OPEN_MENU)
    img = ImageGrab.grab(all_screens=True)
    img.save(os.path.join(OUT, name + ".png"))
    rdp.js(CLOSE_MENU)
    nb = st["navbar"]
    mx, my, mw, mh = (round(rect[c] * k) for c in ("x", "y", "w", "h"))
    menu = pixel_mode(img, (mx + 4, my + 4, mx + mw - 4, my + mh - 4))
    toolbar = pixel_mode(img, (round(nb["x"] * k), round(nb["y"] * k), round((nb["x"] + nb["w"]) * k), round((nb["y"] + nb["h"]) * k)))
    # The menu's window right at its left edge, halfway down: the menu
    # itself, not a frame of whatever is behind (Windows 11's Mica backdrop
    # showed round the menu where its window was bigger than the menu).
    # Off the shadow's room where there is one (no Mica).
    inset = 1 if st["micaPopups"] else round(12 * k)
    edge = pixel_mode(img, (mx + inset, my + mh // 3, mx + inset + 3, my + 2 * mh // 3))
    want = EXPECT.get(st["active"], {})
    ok = (st["active"] in EXPECT and close(menu, want["menu"]) and close(toolbar, want["toolbar"])
          and close(edge, want["menu"]))
    step = dict(st, step=name, menuOnScreen=menu, menuEdgeOnScreen=edge, toolbarOnScreen=toolbar, expected=want, ok=ok)
    report["steps"].append(step)
    report["ok"] &= ok
    print(("OK  " if ok else "FAIL"), name, "active", st["active"], "menu", menu, "edge", edge, "toolbar", toolbar,
          "want", want, "mica", st["micaPopups"], flush=True)


check("1-installed-dark")
rdp.js(VIA_ABOUT.replace("__INDEX__", "0"))   # cards: light, dark
check("2-about-myfox-light")
rdp.js(VIA_ABOUT.replace("__INDEX__", "1"))
check("3-about-myfox-dark")
rdp.js(VIA_ADDONS.replace("__ID__", LIGHT))
check("4-addons-light")
rdp.js(VIA_ADDONS.replace("__ID__", DARK))
check("5-addons-dark")

json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=2)
print("os", report["steps"][0]["os"], "firefox", report["steps"][0]["firefox"])
sys.exit(0 if report["ok"] else 1)
