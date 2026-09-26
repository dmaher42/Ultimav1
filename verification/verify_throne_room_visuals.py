import os
from pathlib import Path
import subprocess

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("ULTIMA_BASE_URL", "http://127.0.0.1:3000")
REPO_ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_PATH = REPO_ROOT / "artifacts" / "throne-room-visual-overhaul.png"


def syntax_check(relative_path: str) -> None:
    source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
    subprocess.run(
        ["node", "--input-type=module", "--check"],
        input=source,
        text=True,
        check=True,
    )


def create_fresh_hero(page) -> None:
    page.add_init_script("localStorage.clear();")
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#game")

    if page.locator("#character-creator").is_visible():
        page.fill("#character-name", "VisualTest")
        page.click("#character-creator button[type='submit']")

    page.wait_for_function(
        "window.gameApp?.state?.character && window.gameApp?.renderer"
    )
    page.evaluate(
        """
        const app = window.gameApp;
        app.state.throneIntroComplete = true;
        app.state.character.setQuestStage('castle_crisis', 4);
        app.changeMap('castle', 'castle_gate');
        app.renderGame();
        """
    )
    page.wait_for_timeout(500)


def verify_canvas_complexity(page) -> None:
    result = page.evaluate(
        """
        () => {
          const canvas = document.getElementById('game');
          const ctx = canvas.getContext('2d');
          const width = canvas.width;
          const height = canvas.height;
          const colors = new Set();
          let litPixels = 0;
          let darkPixels = 0;

          for (let row = 1; row < 14; row += 1) {
            for (let col = 1; col < 20; col += 1) {
              const x = Math.floor((col / 20) * width);
              const y = Math.floor((row / 14) * height);
              const pixel = ctx.getImageData(x, y, 1, 1).data;
              colors.add(`${Math.round(pixel[0] / 12)}-${Math.round(pixel[1] / 12)}-${Math.round(pixel[2] / 12)}`);
              const luminance = pixel[0] * 0.2126 + pixel[1] * 0.7152 + pixel[2] * 0.0722;
              if (luminance > 95) litPixels += 1;
              if (luminance < 38) darkPixels += 1;
            }
          }

          return {
            uniqueColorBuckets: colors.size,
            litPixels,
            darkPixels,
            rendererName: window.gameApp.renderer.constructor.name,
            mapId: window.gameApp.state.map.id
          };
        }
        """
    )

    assert result["rendererName"] == "ThroneRoomRenderEngine", result
    assert result["mapId"] == "castle", result
    assert result["uniqueColorBuckets"] >= 24, result
    assert result["litPixels"] > 0, result
    assert result["darkPixels"] > 0, result


def verify_other_maps_still_render(page) -> None:
    page.evaluate("window.gameApp.changeMap('village', 'village_road')")
    page.wait_for_timeout(250)
    assert page.evaluate("window.gameApp.state.map.id") == "village"

    page.evaluate("window.gameApp.changeMap('castle', 'castle_gate')")
    page.wait_for_timeout(250)
    assert page.evaluate("window.gameApp.state.map.id") == "castle"


def verify_movement(page) -> None:
    before = page.evaluate(
        "({ ...window.gameApp.state.player.position })"
    )
    page.keyboard.press("ArrowDown")
    page.wait_for_timeout(150)
    after = page.evaluate(
        "({ ...window.gameApp.state.player.position })"
    )
    assert before != after, (before, after)


def main() -> None:
    syntax_check("public/renderCore.js")
    syntax_check("public/render.js")

    SCREENSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if not executable and Path("/usr/bin/chromium").exists():
            executable = "/usr/bin/chromium"

        launch_options = {"headless": True}
        if executable:
            launch_options["executable_path"] = executable

        browser = playwright.chromium.launch(**launch_options)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        create_fresh_hero(page)
        verify_canvas_complexity(page)
        verify_movement(page)
        verify_other_maps_still_render(page)
        page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)

        assert not page_errors, page_errors
        browser.close()

    print(f"Throne-room overhaul verified. Screenshot: {SCREENSHOT_PATH}")


if __name__ == "__main__":
    main()
