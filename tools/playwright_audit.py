#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "playwright-artifacts"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


@contextlib.contextmanager
def local_server(root: Path):
    handler = partial(QuietHandler, directory=str(root))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = httpd.server_address[:2]
        yield f"http://{host}:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)


def collect_page_metrics(page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
            const doc = document.documentElement;
            const nav = document.getElementById('navbar');
            const hero = document.querySelector('.hero');
            const news = document.querySelector('.news-scroll');
            const pubTrack = document.getElementById('pubTickerTrack');
            const navRect = nav ? nav.getBoundingClientRect() : null;
            const heroRect = hero ? hero.getBoundingClientRect() : null;
            const newsRect = news ? news.getBoundingClientRect() : null;
            return {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                scrollWidth: doc.scrollWidth,
                overflowX: Math.max(0, doc.scrollWidth - window.innerWidth),
                navHeight: navRect ? navRect.height : null,
                heroTop: heroRect ? heroRect.top : null,
                newsTop: newsRect ? newsRect.top : null,
                publicationCards: pubTrack ? pubTrack.querySelectorAll('.pub-card').length : 0,
                reducedMotionMedia: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            };
        }"""
    )


def collect_navigation_metrics(page) -> dict[str, Any]:
    return page.evaluate(
        """() => {
            const entry = performance.getEntriesByType('navigation')[0];
            if (!entry) return null;
            return {
                domContentLoaded: entry.domContentLoadedEventEnd,
                loadEventEnd: entry.loadEventEnd,
                duration: entry.duration
            };
        }"""
    )


def run_case(browser, base_url: str, case: dict[str, Any]) -> dict[str, Any]:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    console_messages: list[str] = []
    page_errors: list[str] = []

    context = browser.new_context(**case["context_options"])
    page = context.new_page()
    page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))

    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_timeout(1800)

    result: dict[str, Any] = {
        "name": case["name"],
        "metrics": collect_page_metrics(page),
        "navigation": collect_navigation_metrics(page),
        "console_messages": console_messages,
        "page_errors": page_errors,
        "screenshots": [],
    }

    home_path = ARTIFACTS / f"{case['name']}-home.png"
    page.screenshot(path=str(home_path), full_page=False)
    result["screenshots"].append(str(home_path.relative_to(ROOT)))

    if case["name"] == "desktop":
        page.locator(".pub-summary-trigger").first.click()
        page.wait_for_timeout(250)
        pub_path = ARTIFACTS / "desktop-publication-popup.png"
        page.screenshot(path=str(pub_path), full_page=False)
        result["screenshots"].append(str(pub_path.relative_to(ROOT)))
    else:
        page.locator("#navToggle").click()
        page.wait_for_timeout(250)
        nav_path = ARTIFACTS / f"{case['name']}-nav-open.png"
        page.screenshot(path=str(nav_path), full_page=False)
        result["screenshots"].append(str(nav_path.relative_to(ROOT)))
        page.locator("#navToggle").click()
        page.wait_for_timeout(200)

    page.locator("#publications").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    pubs_path = ARTIFACTS / f"{case['name']}-publications.png"
    page.screenshot(path=str(pubs_path), full_page=False)
    result["screenshots"].append(str(pubs_path.relative_to(ROOT)))

    page.locator("#gallery").scroll_into_view_if_needed()
    page.wait_for_timeout(900)
    gallery_path = ARTIFACTS / f"{case['name']}-gallery.png"
    page.screenshot(path=str(gallery_path), full_page=False)
    result["screenshots"].append(str(gallery_path.relative_to(ROOT)))

    result["gallery_metrics"] = collect_page_metrics(page)

    context.close()
    return result


def main() -> None:
    cases = [
        {
            "name": "desktop",
            "context_options": {
                "viewport": {"width": 1440, "height": 1100},
                "device_scale_factor": 1.5,
            },
        },
        {
            "name": "mobile-390",
            "context_options": {
                "viewport": {"width": 390, "height": 844},
                "device_scale_factor": 3,
                "is_mobile": True,
                "has_touch": True,
            },
        },
        {
            "name": "mobile-430",
            "context_options": {
                "viewport": {"width": 430, "height": 932},
                "device_scale_factor": 3,
                "is_mobile": True,
                "has_touch": True,
            },
        },
    ]

    with local_server(ROOT) as base_url:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                report = [run_case(browser, base_url, case) for case in cases]
            finally:
                browser.close()

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
