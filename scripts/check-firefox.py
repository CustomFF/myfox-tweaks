#!/usr/bin/env python3
"""Checks a Firefox build for what the tweaks rely on, without running it.

Reads the build's omni.ja files (its chrome code, styles and prefs) and
reports anything the tweaks name that the build no longer has:

  selectors   ids, classes, elements and attributes in chrome/**/*.css, in
              the CSS the modules carry and in their querySelector() calls
  properties  what the modules read or replace on Firefox's objects
              (SidebarController._setExtensionAttributes and the like)
  prefs       the prefs the modules read or set
  urls        chrome:// and resource:// files the tweaks point to

A name is "there" when it occurs anywhere in the build's sources, comments
included, so a report is short and means a rename or a removal, not a
proof that everything works. Run it when a new Firefox beta comes out,
before the manual checklist in TESTING.md.

Usage:
    scripts/check-firefox.py [--firefox DIR] [--verbose]

DIR is the Firefox install (the folder with omni.ja), by default MyFox's,
~/.local/share/myfox/firefox. Names the build lacks on purpose go into
scripts/check-firefox.allow, one per line, with a comment saying why.
Exit status: 0 nothing missing, 1 something is, 2 the build can't be read.
"""
import argparse
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALLOW_FILE = Path(__file__).with_suffix(".allow")
SOURCE_TYPES = ["*.js", "*.mjs", "*.css", "*.xhtml", "*.html", "*.ftl", "*.xml", "*.inc", "*.json"]

IDENT = r"-?[A-Za-z_][\w-]*"


def extract(firefox: Path, dest: Path) -> list[str]:
    """Unpacks the source files of both omni.ja into dest; returns every
    path in them (images too), for the url check. omni.ja keeps its index
    at the start, which Python's zipfile can't read, so unzip does it."""
    names = []
    for sub, jar in (("gre", firefox / "omni.ja"), ("browser", firefox / "browser" / "omni.ja")):
        if not jar.is_file():
            sys.exit(f"no {jar}: is {firefox} a Firefox install?")
        out = dest / sub
        out.mkdir()
        # unzip warns about the unusual layout and exits 1 or 2; the files are fine.
        subprocess.run(["unzip", "-q", "-o", str(jar), *SOURCE_TYPES, "-d", str(out)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        listing = subprocess.run(["unzip", "-Z1", str(jar)], capture_output=True, text=True).stdout
        names += [f"{sub}/{n}" for n in listing.splitlines()]
    return names


def corpus_words(dest: Path) -> tuple[set[str], set[str]]:
    """Every word in the build's sources, and every quoted string of the
    shape of a pref name (prefs a module reads without a default)."""
    words, quoted = set(), set()
    for path in dest.rglob("*"):
        if path.is_file():
            text = path.read_text(encoding="utf-8", errors="replace")
            words.update(re.findall(r"[\w-]+", text))
            quoted.update(re.findall(r"[\"']([a-z][\w-]*\.[\w.-]+)[\"']", text))
    # "a-b" also stands for its parts: a property "b" written in "a-b".
    for word in [w for w in words if "-" in w]:
        words.update(word.split("-"))
    return words, quoted


def static_prefs(firefox: Path) -> bytes:
    """libxul.so holds the static prefs (StaticPrefList.yaml) as plain names."""
    try:
        return (firefox / "libxul.so").read_bytes()
    except OSError:
        return b""


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def strip_css_comments(text: str) -> str:
    # Keep the newlines, so positions still give the right line.
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group()), text, flags=re.S)


def selector_names(selector: str):
    """(kind, name) for every id, class, element and attribute a selector names."""
    selector = re.sub(r"\$\{[^}]*\}", "", selector)          # JS template holes
    selector = re.sub(r"\[([\w-]+)\s*[~|^$*]?=\s*(\"[^\"]*\"|'[^']*'|[^\]\s]*)\s*[is]?\]", r"[\1]", selector)
    for kind, name in re.findall(r"([#.])(" + IDENT + ")", selector):
        yield ("id" if kind == "#" else "class"), name
    for name in re.findall(r"\[\s*([\w-]+)", selector):
        yield "attribute", name
    for name in re.findall(r"(?:^|[\s,>+~(])(" + IDENT + r")(?=[\s,>+~):.#\[{]|$)", selector):
        yield "element", name


def css_selectors(text: str):
    """(position, selector) for each rule's selector in a stylesheet, nested rules included."""
    text = strip_css_comments(text)
    text = re.sub(r"url\([^)]*\)", lambda m: " " * len(m.group()), text)
    start = 0
    for m in re.finditer(r"[{};]", text):
        if m.group() == "{":
            sel = text[start:m.start()]
            stripped = sel.strip()
            if stripped and not stripped.startswith("@") and not re.fullmatch(r"[\d%,\s]+|from|to", stripped):
                yield start + (len(sel) - len(sel.lstrip())), stripped
        start = m.end()


def own_names(js_files, html_files) -> set[str]:
    """Names the tweaks make themselves (ids, classes, attributes, elements):
    a selector naming one of them is not about Firefox."""
    own = set()
    patterns = [
        r"\.id\s*=\s*[\"']([\w-]+)",
        r"(?:set|toggle|remove|has|get)Attribute\(\s*[\"']([\w-]+)",
        r"classList\.(?:add|toggle|remove|contains)\(\s*[\"']([\w-]+)",
        r"className\s*=\s*[\"']([\w -]+)",
        r"create(?:XUL)?Element\(\s*[\"']([\w-]+)",
        r"\bid:\s*[\"']([\w-]+)",                      # CustomizableUI widgets
        r"\bid=\"([\w-]+)\"",
        r"\bclass=\"([\w -]+)\"",
    ]
    for path in js_files + html_files:
        text = path.read_text(encoding="utf-8")
        for pattern in patterns:
            for found in re.findall(pattern, text):
                own.update(found.split())
    return own


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--firefox", type=Path, default=Path.home() / ".local/share/myfox/firefox")
    ap.add_argument("--verbose", action="store_true", help="also list what was checked")
    args = ap.parse_args()

    css_files = sorted((ROOT / "chrome").rglob("*.css"))
    js_files = sorted((ROOT / "autoconfig").rglob("*.js")) + [ROOT / "autoconfig" / "myfox.cfg"]
    # The about page is our own document, whose styles and code name only it.
    about = ROOT / "autoconfig" / "myfox" / "about"
    html_files = sorted(about.glob("*.html"))
    js_files = [p for p in js_files if about not in p.parents and "/i18n/" not in str(p)]

    allow = set()
    if ALLOW_FILE.exists():
        for line in ALLOW_FILE.read_text(encoding="utf-8").splitlines():
            line = line.split("#", 1)[0].strip()
            if line:
                allow.add(line)

    with tempfile.TemporaryDirectory(prefix="myfox-check-") as tmp:
        files = extract(args.firefox, Path(tmp))
        words, quoted = corpus_words(Path(tmp))
        prefs_text = ""
        for p in Path(tmp).rglob("*.js"):
            if "preferences" in p.parts or p.name in ("greprefs.js", "firefox.js"):
                prefs_text += p.read_text(encoding="utf-8", errors="replace")
    libxul = static_prefs(args.firefox)
    version = (args.firefox / "application.ini").read_text(errors="replace") if (args.firefox / "application.ini").exists() else ""
    version = (re.search(r"^Version=(.+)$", version, re.M) or [None, "?"])[1]

    own = own_names(js_files, html_files)
    lower_words = {w.lower() for w in words if not w.islower()}
    missing = defaultdict(list)   # (kind, name) -> ["file:line", ...]
    checked = defaultdict(set)

    def note(kind, name, path, line):
        if name in allow or name in own or name.lower().startswith(("myfox", "my-", "--")):
            return
        checked[kind].add(name)
        rel = f"{path.relative_to(ROOT)}:{line}"
        if kind in ("id", "class", "element", "attribute", "property"):
            # A Lit property (currentView) is an attribute in lower case.
            if name not in words and not (kind == "attribute" and name in lower_words):
                missing[(kind, name)].append(rel)

    def check_css(text, path, offset_line=0):
        for pos, sel in css_selectors(text):
            for kind, name in selector_names(sel):
                note(kind, name, path, offset_line + line_of(text, pos))

    for path in css_files:
        check_css(path.read_text(encoding="utf-8"), path)

    globals_re = r"(?:win|window|w|browser|doc|document)\.(?:(?:gBrowser|SidebarController|gURLBar|CustomizableUI|PanelUI|gBrowserInit|PlacesUtils|AddonManager|BookmarkingUI|gUnifiedExtensions|TabContextMenu|gNavToolbox)\b)"
    for path in js_files:
        text = path.read_text(encoding="utf-8")
        # Stylesheets the modules carry as template strings.
        for m in re.finditer(r"`([^`]*)`", text):
            body = m.group(1)
            if re.search(r"\{[^{}]*:[^{}]*;[^{}]*\}", body) and "!important" in body:
                check_css(body, path, line_of(text, m.start(1)) - 1)
        # Selectors in DOM lookups.
        for m in re.finditer(r"(?:querySelector(?:All)?|closest|matches)\(\s*([`\"'])(.*?)\1", text):
            for kind, name in selector_names(m.group(2)):
                note(kind, name, path, line_of(text, m.start()))
        for m in re.finditer(r"getElementById\(\s*[`\"']([\w-]+)", text):
            note("id", m.group(1), path, line_of(text, m.start()))
        # Firefox's objects: their own members, read or replaced.
        for m in re.finditer(r"\b(?:sbCtrl|SidebarController|" + globals_re + r")((?:\.\w+)+)", text):
            for name in m.group(1).split(".")[1:]:
                if not name.startswith(("my", "original")):
                    note("property", name, path, line_of(text, m.start()))
        for m in re.finditer(r"constructor\.prototype\.(\w+)", text):
            note("property", m.group(1), path, line_of(text, m.start()))
        # Prefs.
        guards = set(re.findall(r"oncePerProfile\(\s*\"([^\"]+)\"", text))
        for m in re.finditer(r"(?:(?:get|set)(?:Bool|Int|Char|String)Pref|defaultPref|lockPref|clearUserPref|prefHasUserValue|addObserver)\(\s*\"([a-z][\w.-]+\.[\w.-]+)\"", text):
            name = m.group(1)
            if name in guards or name in allow or name.startswith("myfox."):
                continue
            checked["pref"].add(name)
            if name not in quoted and f'"{name}"' not in prefs_text and name.encode() not in libxul:
                missing[("pref", name)].append(f"{path.relative_to(ROOT)}:{line_of(text, m.start())}")

    # chrome:// and resource:// files.
    for path in css_files + js_files:
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"(chrome|resource)://([\w.-]*)/+([\w./-]+\.\w+)", text):
            scheme, host, rest = m.groups()
            if host.startswith("myfox") or m.group(0) in allow:
                continue
            checked["url"].add(m.group(0))
            # Where the jar keeps it: chrome://pkg/content/x in .../content/pkg/x,
            # chrome://pkg/skin/x in .../skin/classic/pkg/x, resource://gre/x
            # in the toolkit jar, resource:///x in the browser one.
            if scheme == "chrome":
                part, _, inner = rest.partition("/")
                tails = {"content": [f"/content/{host}/{inner}"],
                         "skin": [f"/skin/classic/{host}/{inner}"]}.get(part, ["/" + rest])
            elif host == "gre":
                tails = ["gre/" + rest]
            elif host in ("", "app"):
                tails = ["browser/" + rest]
            else:
                tails = ["/" + rest]
            if not any(f.endswith(t) or f == t for f in files for t in tails):
                missing[("url", m.group(0))].append(f"{path.relative_to(ROOT)}:{line_of(text, m.start())}")

    print(f"Firefox {version} at {args.firefox}")
    plural = {"class": "classes", "property": "properties"}
    for kind in ("id", "class", "element", "attribute", "property", "pref", "url"):
        print(f"  {plural.get(kind, kind + 's'):11} {len(checked[kind]):5} checked")
    if args.verbose:
        for kind in sorted(checked):
            print(f"\n{kind}s: " + " ".join(sorted(checked[kind])))
    if not missing:
        print("Nothing missing.")
        return 0
    print(f"\nMissing in this build ({len(missing)}):")
    for (kind, name), places in sorted(missing.items()):
        more = f" (+{len(places) - 3} more)" if len(places) > 3 else ""
        print(f"  {kind:9} {name}  — {', '.join(places[:3])}{more}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
