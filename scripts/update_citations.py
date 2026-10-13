#!/usr/bin/env python3
"""Sync Google Scholar citation counts into index.html.

Updates
  - the "Total Citations" stat (data-target + visible number)
  - every publication badge "<n> citations", matched by its Scholar `cites=` id
  - publications that have no badge yet: a badge is inserted when the Scholar
    title matches the card title

Exit codes: 0 = done (changed or not), 1 = Scholar page unusable (blocked / layout change).
Standard library only, so it runs as-is on GitHub Actions.
"""
from __future__ import annotations

import html
import re
import sys
import urllib.request
from pathlib import Path

INDEX = Path(__file__).resolve().parents[1] / "index.html"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def norm(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", html.unescape(title).lower())


def fetch_profile(user_id: str) -> str:
    url = f"https://scholar.google.com/citations?user={user_id}&hl=en&cstart=0&pagesize=100"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_profile(page: str) -> tuple[int, list[dict]]:
    table = re.search(r'<table id="gsc_rsb_st">(.*?)</table>', page, re.S)
    total = re.search(r'<td class="gsc_rsb_std">(\d+)</td>', table.group(1)) if table else None
    if not total:
        raise ValueError("citation table not found (blocked or layout changed)")
    papers = []
    for row in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
        title = re.search(r'class="gsc_a_at"[^>]*>(.*?)</a>', row, re.S)
        cites = re.search(r'<a[^>]*href="([^"]*cites=(\d+)[^"]*)"[^>]*class="gsc_a_ac[^"]*"[^>]*>(\d+)</a>', row)
        if not cites:  # attribute order varies
            cites = re.search(r'<a[^>]*class="gsc_a_ac[^"]*"[^>]*href="([^"]*cites=(\d+)[^"]*)"[^>]*>(\d+)</a>', row)
        if title:
            papers.append({
                "title": html.unescape(re.sub(r"<[^>]+>", "", title.group(1))).strip(),
                "cites_id": cites.group(2) if cites else None,
                "count": int(cites.group(3)) if cites else 0,
            })
    if not papers:
        raise ValueError("no publication rows found")
    return int(total.group(1)), papers


def badge(cites_id: str, count: int) -> str:
    noun = "citation" if count == 1 else "citations"
    return (f'<a class="pub-citations" href="https://scholar.google.com/scholar?oi=bibs&amp;hl=en&amp;cites={cites_id}" '
            f'target="_blank" rel="noopener noreferrer">{count} {noun}</a>')


def apply(src: str, total: int, papers: list[dict]) -> tuple[str, list[str]]:
    log = []
    new, n = re.subn(r'(<span class="citation-number" data-target=")\d+(">)\d*(</span>)',
                     rf"\g<1>{total}\g<2>{total}\g<3>", src)
    if n != 1:
        raise ValueError("total citation element not found in index.html")
    if new != src:
        log.append(f"total -> {total}")
    src = new

    for p in papers:
        if not p["cites_id"] or p["count"] <= 0:
            continue
        # 1) existing badge with the same Scholar id
        pat = re.compile(r'<a class="pub-citations" href="[^"]*cites=' + p["cites_id"] + r'"[^>]*>\d+ citations?</a>')
        if pat.search(src):
            new = pat.sub(lambda _: badge(p["cites_id"], p["count"]), src)
            if new != src:
                log.append(f'{p["count"]:>4}  {p["title"][:60]}')
            src = new
            continue
        # 2) no badge yet: find the card by title and insert one after the venue chip
        key = norm(p["title"])
        for m in re.finditer(r'<div class="pub-meta">(.*?)</div>\s*<div class="pub-title">(.*?)</div>', src, re.S):
            card_key = norm(re.sub(r"<[^>]+>", "", m.group(2)))
            if key and (card_key == key or card_key.startswith(key) or key.startswith(card_key)):
                if "pub-citations" in m.group(1):
                    break  # card already has a (different-id) badge; leave it alone
                meta = m.group(1)
                insert = meta.rstrip() + "\n                    " + badge(p["cites_id"], p["count"]) + "\n                "
                src = src[:m.start(1)] + insert + src[m.end(1):]
                log.append(f'{p["count"]:>4}  {p["title"][:60]}  (new badge)')
                break
    return src, log


def main() -> int:
    src = INDEX.read_text(encoding="utf-8")
    user = re.search(r"scholar\.google\.com/citations\?user=([\w-]+)", src)
    if not user:
        print("Scholar user id not found in index.html", file=sys.stderr)
        return 1
    try:
        total, papers = parse_profile(fetch_profile(user.group(1)))
    except Exception as exc:  # network error, captcha page, layout change
        print(f"::error::Could not read Google Scholar profile: {exc}", file=sys.stderr)
        return 1
    updated, log = apply(src, total, papers)
    if updated == src:
        print(f"No change (total {total}).")
        return 0
    INDEX.write_text(updated, encoding="utf-8")
    print("Updated citations:\n  " + "\n  ".join(log))
    return 0


if __name__ == "__main__":
    sys.exit(main())
