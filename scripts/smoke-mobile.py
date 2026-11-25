"""Exercise the built site at 390 × 844 with Chrome and ChromeDriver on PATH."""
import json
import os
import shutil
import subprocess
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class LocalSite(SimpleHTTPRequestHandler):
    def end_headers(self):
        # The demo runs with its own seed data. Block all external page traffic.
        self.send_header("Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-src 'none'")
        super().end_headers()

    def log_message(self, *_):
        pass


def webdriver(method, path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = Request("http://127.0.0.1:9515" + path, data=body, method=method,
                      headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=25) as response:
            return json.load(response)["value"]
    except HTTPError as error:
        raise RuntimeError(f"{method} {path}: {error.read().decode()}") from error


def smoke(base):
    session = webdriver("POST", "/session", {"capabilities": {"alwaysMatch": {
        "browserName": "chrome",
        "goog:chromeOptions": {"args": ["--headless=new", "--disable-dev-shm-usage"],
                               "mobileEmulation": {"deviceMetrics": {"width": 390, "height": 844, "pixelRatio": 2}}},
    }}})
    path = "/session/" + session["sessionId"]

    def element(strategy, selector):
        found = webdriver("POST", path + "/element", {"using": strategy, "value": selector})
        return found["element-6066-11e4-a52e-4f73-9f4d-51b9a3dcf116"]

    def click(strategy, selector):
        webdriver("POST", path + "/element/" + element(strategy, selector) + "/click", {})

    def evaluate(script):
        return webdriver("POST", path + "/execute/sync", {"script": script, "args": []})

    def check_width(page):
        widths = evaluate("return [innerWidth, document.documentElement.scrollWidth]")
        assert widths == [390, 390], f"{page}: viewport and content widths {widths}"

    try:
        webdriver("POST", path + "/timeouts", {"implicit": 12000})
        webdriver("POST", path + "/url", {"url": base})
        click("xpath", "//button[normalize-space()='Endast nödvändiga']")
        check_width("Startsidan")
        click("css selector", "button[aria-label='Öppna meny']")
        element("css selector", "#landing-mobile-menu:not([hidden]) a[href='/priser']")
        click("css selector", "button[aria-label='Stäng meny']")
        element("css selector", "#landing-mobile-menu[hidden]")
        click("css selector", ".hg-hero a[href='/demo']")
        element("css selector", "button[aria-label='Lägg till ett ägg']")
        check_width("Demoöversikten")
        click("link text", "Historik")
        element("css selector", "#egg-history-date")
        assert evaluate("return location.pathname.replace(/\\/$/, '') + location.search") == "/demo?view=eggs"
        check_width("Äggboken")
    finally:
        webdriver("DELETE", path)


if __name__ == "__main__":
    dist = Path(__file__).resolve().parents[1] / "dist"
    if not (dist / "index.html").is_file():
        raise SystemExit("Bygg sajten med npm run build före mobiltestet.")
    binary = shutil.which("chromedriver") or str(Path(os.getenv("CHROMEWEBDRIVER", "")) / "chromedriver")
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(LocalSite, directory=str(dist))) as site:
        threading.Thread(target=site.serve_forever, daemon=True).start()
        driver = subprocess.Popen([binary, "--port=9515"])
        try:
            for _ in range(50):
                if driver.poll() is not None:
                    raise RuntimeError("ChromeDriver avslutades innan testet startade.")
                try:
                    if webdriver("GET", "/status")["ready"]:
                        break
                except URLError:
                    time.sleep(0.1)
            smoke(f"http://127.0.0.1:{site.server_port}/")
            print("Mobiltest godkänt på startsidan, demoöversikten och äggboken.")
        finally:
            driver.terminate()
            driver.wait(timeout=10)
