#!/usr/bin/env python3
"""Which of the tweaks' CSS rules apply to what, in a running Firefox.

Talks to Firefox over the Remote Debugging Protocol: through
scripts/firefox_rdp_proxy.py (port 34376, the default), or straight to a
debugger server (`firefox --start-debugger-server N`, devtools.chrome.enabled
and devtools.debugger.remote-enabled on, an ssh tunnel for a VM). It runs
css-report.js in Firefox's parent process, which goes through every document
there (browser windows with their shadow DOM, panels, menus, the sidebar,
about:myfox) and records, for every rule of ours, the elements it matches.

    css-report.py                    summary: per file, rules matched and not;
                                     the rules that hit the most kinds of element
    css-report.py --open-views       the same, with the pages the tweaks style
                                     (about:preferences, about:addons, …) and every
                                     sidebar panel opened in a window of its own,
                                     closed afterwards
    css-report.py --broad 5          the rules hitting 5+ kinds of element, with them
    css-report.py --rule user/30-toolbar-urlbar.css:10
                                     what that rule (or every rule of a file) hits
    css-report.py --unmatched        the rules that match nothing right now
    css-report.py --element '.titlebar-button'
                                     every rule of ours on those elements
    --save FILE / --load FILE        keep a scan as JSON / report from one

It is a snapshot: a rule for :hover, an open menu or a selected tab counts
only if that is so at the moment of the scan (--open-views adds the pages
and panels, not states like split view or tab groups). Pages in a content
process (about:logins, about:newtab, web pages) aren't reachable from here;
the report lists them.
"""

import argparse
import json
import os
import socket
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
RESULT = "globalThis.__myfoxCssReport"


def send(sock, msg):
    data = json.dumps(msg).encode()
    sock.sendall(str(len(data)).encode() + b":" + data)


def recv(sock):
    head = b""
    while not head.endswith(b":"):
        c = sock.recv(1)
        if not c:
            return None
        head += c
    size = int(head[:-1])
    data = b""
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            return None
        data += chunk
    return json.loads(data)


class Firefox:
    def __init__(self, port):
        self.sock = socket.create_connection(("127.0.0.1", port))
        self.sock.settimeout(300)
        if recv(self.sock) is None:
            sys.exit("No answer from the debugger on port %d (is Firefox there and the connection allowed?)" % port)
        send(self.sock, {"to": "root", "type": "getProcess", "id": 0})
        desc = self._reply("root")["processDescriptor"]["actor"]
        send(self.sock, {"to": desc, "type": "getTarget"})
        self.console = self._reply(desc)["process"]["consoleActor"]

    def _reply(self, actor):
        while True:
            m = recv(self.sock)
            if m is None:
                sys.exit("The debugger closed the connection.")
            if m.get("from") == actor:
                return m

    def eval(self, text):
        """A synchronous expression's value (a long string fetched whole)."""
        send(self.sock, {"to": self.console, "type": "evaluateJSAsync", "text": text})
        rid = self._reply(self.console)["resultID"]
        while True:
            m = recv(self.sock)
            if m is None:
                sys.exit("The debugger closed the connection.")
            if m.get("type") == "evaluationResult" and m.get("resultID") == rid:
                break
        if m.get("exceptionMessage"):
            sys.exit("Firefox: " + m["exceptionMessage"])
        r = m.get("result")
        if isinstance(r, dict) and r.get("type") == "longString":
            parts, length, step = [], r["length"], 1 << 20
            for start in range(0, length, step):
                send(self.sock, {"to": r["actor"], "type": "substring", "start": start,
                                 "end": min(start + step, length)})
                parts.append(self._reply(r["actor"])["substring"])
            return "".join(parts)
        if isinstance(r, dict):
            return None if r.get("type") in ("null", "undefined") else r
        return r

    def run(self, params):
        """css-report.js with these params; its JSON answer."""
        with open(os.path.join(HERE, "css-report.js")) as f:
            body = f.read()
        # Started, then polled: older Firefoxes don't hand back an awaited
        # promise's value to this client.
        self.eval("%s = null; { const params = %s; (%s).then(v => %s = v, e => %s = 'ERROR ' + e + '\\n' + e.stack); } 'started'"
                  % (RESULT, json.dumps(params), body.strip().rstrip(";"), RESULT, RESULT))
        while True:
            state = self.eval("%s === null ? 'running' : 'done'" % RESULT)
            if state == "done":
                break
            time.sleep(1)
        text = self.eval(RESULT)
        self.eval("%s = undefined; 'ok'" % RESULT)
        if text.startswith("ERROR "):
            sys.exit("Firefox: " + text[6:])
        return json.loads(text)


def kinds(rule):
    return len(rule["matches"])


def where(rule):
    return "%s:%s" % (rule["file"], rule["line"])


def print_rule(rule, limit):
    total = sum(rule["matches"].values())
    print("%s  %s" % (where(rule), rule["selector"]))
    print("    sets: %s" % (", ".join(rule["props"]) or "(nothing)"))
    if rule.get("perSelector"):
        print("    per selector: %s" % rule["perSelector"])
    print("    hits %d element(s), %d kind(s)%s" % (total, kinds(rule), ":" if total else ""))
    items = sorted(rule["matches"].items(), key=lambda kv: (-kv[1], kv[0]))
    for d, n in items[:limit]:
        print("      %4d  %s" % (n, d))
    if len(items) > limit:
        print("      … and %d more kinds" % (len(items) - limit))


def summary(report, top):
    print("Firefox %s (%s), theme %s, %s" % (report["firefox"], report["os"], report["theme"], report["time"]))
    print("%d element checks in: %s" % (report["elements"], ", ".join(report["docs"])))
    if report.get("readFromDisk"):
        print("Not in any document now, rules read from disk: %s" % ", ".join(report["readFromDisk"]))
    if report.get("unreachable"):
        print("Not covered: %s" % ", ".join(report["unreachable"]))
    print()
    files = {}
    for r in report["rules"]:
        f = files.setdefault(r["file"], [0, 0])
        f[0] += 1
        f[1] += 1 if r["matches"] else 0
    print("%-48s %6s %8s %10s" % ("file", "rules", "matched", "unmatched"))
    for name in sorted(files):
        total, matched = files[name]
        print("%-48s %6d %8d %10d" % (name, total, matched, total - matched))
    print()
    print("Rules hitting the most kinds of element:")
    for r in sorted(report["rules"], key=lambda r: -kinds(r))[:top]:
        print("  %4d kinds  %s  %s" % (kinds(r), where(r), r["selector"][:110]))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--port", type=int, default=34376)
    p.add_argument("--save", metavar="FILE")
    p.add_argument("--load", metavar="FILE")
    p.add_argument("--open-views", action="store_true")
    p.add_argument("--element", metavar="SELECTOR")
    p.add_argument("--rule", metavar="FILE[:LINE]")
    p.add_argument("--broad", type=int, metavar="N")
    p.add_argument("--unmatched", action="store_true")
    p.add_argument("--top", type=int, default=25)
    p.add_argument("--limit", type=int, default=30, help="element kinds shown per rule")
    a = p.parse_args()

    if a.load:
        with open(a.load) as f:
            report = json.load(f)
    else:
        params = {"views": a.open_views}
        if a.element:
            params["selector"] = a.element
        report = Firefox(a.port).run(params)
    if a.save:
        with open(a.save, "w") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)

    rules = report["rules"]
    if a.element:
        hit = [r for r in rules if r["matches"]]
        print("%d element(s) match %s; %d rule(s) of ours apply:" % (report["elements"], a.element, len(hit)))
        for r in sorted(hit, key=lambda r: (r["file"], r["line"])):
            print_rule(r, a.limit)
    elif a.rule:
        name, _, line = a.rule.partition(":")
        sel = [r for r in rules if r["file"] == name and (not line or str(r["line"]) == line)]
        if not sel:
            sys.exit("No rule of ours at %s." % a.rule)
        for r in sorted(sel, key=lambda r: r["line"]):
            print_rule(r, a.limit)
    elif a.unmatched:
        for r in sorted((r for r in rules if not r["matches"]), key=lambda r: (r["file"], r["line"])):
            print("%s  %s" % (where(r), r["selector"]))
    elif a.broad:
        for r in sorted((r for r in rules if kinds(r) >= a.broad), key=lambda r: -kinds(r)):
            print_rule(r, a.limit)
            print()
    else:
        summary(report, a.top)


if __name__ == "__main__":
    main()
