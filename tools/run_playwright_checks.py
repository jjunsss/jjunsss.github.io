#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import socket
import threading
import time
from contextlib import closing
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = ROOT / "playwright-artifacts"


def find_free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


def start_server() -> tuple[ThreadingHTTPServer, str]:
    port = find_free_port()
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, f"http://127.0.0.1:{port}/"


def collect_page_metrics(page):
    return page.evaluate(
        """() => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const overflowNodes = [];
            const tapTargets = [];

            const selector = 'a, button, [role="button"], input, select, textarea';
            document.querySelectorAll(selector).forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && (rect.width < 36 || rect.height < 36)) {
                    tapTargets.push({
                        tag: el.tagName.toLowerCase(),
                        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60),
                        width: Number(rect.width.toFixed(1)),
                        height: Number(rect.height.toFixed(1))
                    });
                }
            });

            document.querySelectorAll('body *').forEach((el) => {
                if (el.closest('.pub-ticker-track')) return;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
                if (style.pointerEvents === 'none' && !el.classList.contains('show')) return;
                if (rect.width <= 0 || rect.height <= 0) return;
                if (rect.right > viewportWidth + 1 || rect.left < -1) {
                    overflowNodes.push({
                        tag: el.tagName.toLowerCase(),
                        className: (el.className || '').toString().trim().slice(0, 80),
                        text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
                        left: Number(rect.left.toFixed(1)),
                        right: Number(rect.right.toFixed(1)),
                        width: Number(rect.width.toFixed(1))
                    });
                }
            });

            const navEntry = performance.getEntriesByType('navigation')[0];
            return {
                viewportWidth,
                viewportHeight,
                documentScrollWidth: document.documentElement.scrollWidth,
                horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - viewportWidth),
                overflowNodes: overflowNodes.slice(0, 20),
                smallTapTargets: tapTargets.slice(0, 20),
                reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                navTiming: navEntry ? {
                    domContentLoaded: Math.round(navEntry.domContentLoadedEventEnd),
                    load: Math.round(navEntry.loadEventEnd),
                    transferSize: navEntry.transferSize || 0
                } : null
            };
        }"""
    )


def trigger_reveals(page):
    page.evaluate(
        """async () => {
            const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const step = Math.max(280, Math.round(window.innerHeight * 0.85));
            for (let top = 0; top <= maxScroll; top += step) {
                window.scrollTo(0, top);
                await new Promise((resolve) => setTimeout(resolve, 180));
            }
            window.scrollTo(0, maxScroll);
            await new Promise((resolve) => setTimeout(resolve, 220));
            window.scrollTo(0, 0);
            await new Promise((resolve) => setTimeout(resolve, 300));
        }"""
    )


def run_case(browser, name: str, base_url: str, context_options: dict):
    ARTIFACTS_DIR.mkdir(exist_ok=True)
    screenshot_path = ARTIFACTS_DIR / f"{name}.png"

    context = browser.new_context(**context_options)
    page = context.new_page()

    console_messages = []
    page_errors = []

    page.on(
        "console",
        lambda msg: console_messages.append(
            {
                "type": msg.type,
                "text": msg.text,
            }
        ),
    )
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))

    page.goto(base_url, wait_until="load")
    page.wait_for_timeout(1800)
    trigger_reveals(page)

    metrics = collect_page_metrics(page)
    page.screenshot(path=str(screenshot_path), full_page=True)

    result = {
        "name": name,
        "url": base_url,
        "screenshot": str(screenshot_path),
        "console": console_messages,
        "pageErrors": page_errors,
        "metrics": metrics,
    }

    context.close()
    return result


def main() -> int:
    server, base_url = start_server()
    time.sleep(0.3)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            desktop = run_case(
                browser,
                "desktop",
                base_url,
                {
                    "viewport": {"width": 1440, "height": 1080},
                    "device_scale_factor": 1.5,
                },
            )
            mobile = run_case(
                browser,
                "mobile",
                base_url,
                {
                    **playwright.devices["iPhone 13"],
                    "is_mobile": True,
                },
            )
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    report = {
        "generatedAt": int(time.time()),
        "results": [desktop, mobile],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
