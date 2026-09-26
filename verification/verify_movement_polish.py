import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap

REPO_ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ULTIMA_BASE_URL", "http://127.0.0.1:3000")
SCREENSHOT_PATH = REPO_ROOT / "artifacts" / "movement-polish.png"


def syntax_check(relative_path: str) -> None:
    source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
    subprocess.run(
        ["node", "--input-type=module", "--check"],
        input=source,
        text=True,
        check=True,
    )


def verify_static_integration() -> None:
    game = (REPO_ROOT / "public/game.js").read_text(encoding="utf-8")
    renderer = (REPO_ROOT / "public/renderCore.js").read_text(encoding="utf-8")
    camera = (REPO_ROOT / "public/renderer/camera.js").read_text(encoding="utf-8")

    required_game_fragments = (
        "MovementController",
        "movementController.handleKeyDown",
        "movementController.handleKeyUp",
        "renderer.beginPlayerStep",
        "renderer.playBlockedStep",
        "window.addEventListener('blur'",
        "document.addEventListener('visibilitychange'",
    )
    for fragment in required_game_fragments:
        assert fragment in game, f"Missing movement integration: {fragment}"

    assert "activeMovementDirections" not in game
    for fragment in (
        "getPlayerRenderPosition",
        "getNpcRenderPosition",
        "beginPlayerStep",
        "updatePlayerMovementState",
        "playBlockedStep",
        "snapCameraToPlayer",
    ):
        assert fragment in renderer, f"Missing renderer movement integration: {fragment}"
    assert "function snap(" in camera


def verify_node_behaviour() -> None:
    with tempfile.TemporaryDirectory(prefix="ultima-movement-") as tmp_dir:
        tmp = Path(tmp_dir)
        controller_target = tmp / "MovementController.mjs"
        player_target = tmp / "Player.mjs"
        camera_target = tmp / "camera.mjs"

        shutil.copy2(REPO_ROOT / "public/MovementController.js", controller_target)
        shutil.copy2(REPO_ROOT / "public/Player.js", player_target)

        camera_source = (REPO_ROOT / "public/renderer/camera.js").read_text(encoding="utf-8")
        camera_source = camera_source.replace("import { DPR } from './canvas.js';", "const DPR = 1;")
        camera_target.write_text(camera_source, encoding="utf-8")

        script = textwrap.dedent(
            r"""
            import MovementController from __CONTROLLER__;
            import Player from __PLAYER__;
            import { createCamera } from __CAMERA__;

            let now = 0;
            let scheduled = null;
            const steps = [];
            const intents = [];
            let allowMovement = true;

            const controller = new MovementController({
              keyToDirection: {
                arrowright: 'east',
                arrowleft: 'west',
                arrowup: 'north',
                arrowdown: 'south',
                d: 'east',
                a: 'west',
                w: 'north',
                s: 'south'
              },
              clock: () => now,
              requestFrame: (callback) => { scheduled = callback; return 1; },
              cancelFrame: () => { scheduled = null; },
              canMove: () => allowMovement,
              onIntentChange: (direction, active) => intents.push([direction, active]),
              attemptStep: (direction, meta) => {
                steps.push([direction, meta.source, now]);
                return { moved: allowMovement };
              }
            });

            const advanceFrame = (time) => {
              now = time;
              const callback = scheduled;
              scheduled = null;
              if (callback) callback(time);
            };

            controller.handleKeyDown('ArrowRight');
            if (steps.length !== 1 || steps[0][0] !== 'east' || steps[0][1] !== 'press') {
              throw new Error('The first movement step was not immediate.');
            }

            advanceFrame(100);
            if (steps.length !== 1) throw new Error('Movement repeated before the initial delay.');
            advanceFrame(190);
            if (steps.length !== 2 || steps[1][1] !== 'repeat') {
              throw new Error('Controlled key repeat did not start.');
            }

            controller.handleKeyDown('ArrowUp');
            advanceFrame(282);
            if (steps.at(-1)[0] !== 'north' || steps.at(-1)[1] !== 'buffered') {
              throw new Error('Recent-direction input buffering failed.');
            }

            controller.handleKeyUp('ArrowUp');
            advanceFrame(400);
            if (steps.at(-1)[0] !== 'east') {
              throw new Error('Held-direction fallback failed.');
            }

            controller.handleKeyUp('ArrowRight');
            const countAfterRelease = steps.length;
            advanceFrame(700);
            if (steps.length !== countAfterRelease) {
              throw new Error('Movement continued after all keys were released.');
            }

            allowMovement = false;
            controller.handleKeyDown('ArrowLeft');
            if (steps.length !== countAfterRelease) {
              throw new Error('Movement ignored the canMove gate.');
            }
            controller.reset();
            allowMovement = true;

            const map = {
              getSpawn: () => ({ x: 2, y: 3 }),
              isWalkable: (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8
            };
            const player = new Player({});
            player.setMap(map);
            if (!player.move(1, 0, { durationMs: 100, timestamp: 0 })) {
              throw new Error('Player logical movement failed.');
            }
            const midpoint = player.getRenderPosition(50);
            if (!(midpoint.x > 2 && midpoint.x < 3 && midpoint.y === 3)) {
              throw new Error(`Player interpolation failed: ${JSON.stringify(midpoint)}`);
            }

            const chainedFrom = player.getRenderPosition(75);
            if (!player.move(1, 0, { durationMs: 100, timestamp: 75 })) {
              throw new Error('Chained movement failed.');
            }
            const chainedStart = player.getRenderPosition(75);
            if (Math.abs(chainedStart.x - chainedFrom.x) > 0.0001) {
              throw new Error('Chained movement introduced a visual teleport.');
            }
            const settled = player.getRenderPosition(180);
            if (settled.x !== 4 || player.isVisuallyMoving(180)) {
              throw new Error('Player movement did not settle on the logical tile.');
            }

            player.setPosition(0, 0);
            player.face('west');
            const blocked = player.move(-1, 0, { durationMs: 100, timestamp: 200 });
            if (blocked || player.facing !== 'west' || player.position.x !== 0) {
              throw new Error('Blocked movement did not preserve position and facing.');
            }

            const camera = createCamera({ x: 0, y: 0, w: 400, h: 240, lerp: 0.2 });
            camera.setBounds(0, 0, 1000, 800);
            camera.snap(600, 420);
            const snapped = camera.getState();
            if (snapped.position.x !== snapped.target.x || snapped.position.y !== snapped.target.y) {
              throw new Error('Camera snap did not place the camera on its target.');
            }

            console.log(JSON.stringify({
              stepCount: steps.length,
              midpoint,
              settled,
              intents,
              camera: snapped
            }));
            """
        )
        script = (
            script.replace("__CONTROLLER__", json.dumps(controller_target.as_uri()))
            .replace("__PLAYER__", json.dumps(player_target.as_uri()))
            .replace("__CAMERA__", json.dumps(camera_target.as_uri()))
        )
        subprocess.run(
            ["node", "--input-type=module", "-e", script],
            text=True,
            check=True,
        )



def verify_renderer_runtime() -> None:
    with tempfile.TemporaryDirectory(prefix="ultima-renderer-") as tmp_dir:
        tmp = Path(tmp_dir)
        public_target = tmp / "public"
        shutil.copytree(REPO_ROOT / "public", public_target)
        (tmp / "package.json").write_text('{"type":"module"}\n', encoding="utf-8")

        script = textwrap.dedent(
            r"""
            import RenderEngine from __RENDERER__;
            import Player from __PLAYER__;

            const canvas = { width: 800, height: 600, clientWidth: 800, clientHeight: 600 };
            const ctx = { canvas };
            const renderer = new RenderEngine(ctx);
            const map = {
              getSpawn: () => ({ x: 3, y: 4 }),
              isWalkable: () => true
            };
            const player = new Player({});
            player.setMap(map);
            renderer.player = player;
            renderer.map = { id: 'test' };
            renderer.offsetX = 0;
            renderer.offsetY = 0;

            const start = performance.now();
            player.move(1, 0, { durationMs: 120, timestamp: start });
            const interpolated = renderer.getPlayerRenderPosition(player, start + 60);
            if (!(interpolated.x > 3 && interpolated.x < 4)) {
              throw new Error(`Renderer did not read interpolated player position: ${JSON.stringify(interpolated)}`);
            }

            renderer.beginPlayerStep('east', 120);
            if (!renderer.isMoving || renderer.currentDirection !== 'east') {
              throw new Error('Renderer walk animation did not start with a movement step.');
            }

            renderer.playBlockedStep('north');
            const nudge = renderer.getBlockedNudgeOffset(performance.now() + 40);
            if (!(nudge.y < 0)) throw new Error('Blocked-step nudge was not applied.');

            player.cancelMotion();
            renderer.updatePlayerMovementState(performance.now() + 500);
            if (renderer.isMoving) throw new Error('Renderer did not return to idle.');

            console.log(JSON.stringify({ interpolated, nudge, direction: renderer.currentDirection }));
            """
        )
        script = (
            script.replace("__RENDERER__", json.dumps((public_target / "renderCore.js").as_uri()))
            .replace("__PLAYER__", json.dumps((public_target / "Player.js").as_uri()))
        )
        subprocess.run(
            ["node", "--input-type=module", "-e", script],
            text=True,
            check=True,
        )

def run_browser_smoke() -> None:
    from playwright.sync_api import sync_playwright

    SCREENSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if not executable and Path("/usr/bin/chromium").exists():
            executable = "/usr/bin/chromium"

        options = {"headless": True}
        if executable:
            options["executable_path"] = executable

        browser = playwright.chromium.launch(**options)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.add_init_script("localStorage.clear();")
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.wait_for_selector("#game")

        if page.locator("#character-creator").is_visible():
            page.fill("#character-name", "MovementTest")
            page.click("#character-creator button[type='submit']")

        page.wait_for_function("window.gameApp?.state?.player")
        page.evaluate(
            """
            const app = window.gameApp;
            app.state.throneIntroComplete = true;
            app.state.character.setQuestStage('castle_crisis', 4);
            app.state.player.map = app.state.map;
            app.state.player.setPosition(14, 13);
            app.renderGame();
            """
        )
        page.wait_for_timeout(80)

        page.keyboard.down("ArrowDown")
        immediate = json.loads(page.evaluate("window.render_game_to_text()"))
        assert immediate["player"]["y"] == 14, immediate
        assert immediate["player"]["moving"] is True, immediate
        assert immediate["player"]["renderY"] < 14, immediate

        page.wait_for_timeout(60)
        midpoint = json.loads(page.evaluate("window.render_game_to_text()"))
        assert 13 < midpoint["player"]["renderY"] < 14, midpoint

        page.wait_for_timeout(430)
        page.keyboard.up("ArrowDown")
        held = json.loads(page.evaluate("window.render_game_to_text()"))
        assert 15 <= held["player"]["y"] <= 18, held

        page.keyboard.down("ArrowRight")
        page.wait_for_timeout(150)
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        after_blur = json.loads(page.evaluate("window.render_game_to_text()"))
        page.wait_for_timeout(300)
        final_blur = json.loads(page.evaluate("window.render_game_to_text()"))
        assert final_blur["player"]["x"] == after_blur["player"]["x"]
        assert final_blur["movement"]["pressedKeys"] == []
        page.keyboard.up("ArrowRight")

        page.evaluate(
            """
            const app = window.gameApp;
            app.changeMap('village', 'village_road');
            app.renderer.updateCanvasMetrics();
            """
        )
        camera_state = page.evaluate("window.gameApp.renderer.camera.getState()")
        assert abs(camera_state["position"]["x"] - camera_state["target"]["x"]) < 0.01
        assert abs(camera_state["position"]["y"] - camera_state["target"]["y"]) < 0.01

        page.screenshot(path=str(SCREENSHOT_PATH), full_page=True)
        assert not page_errors, page_errors
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify the movement polish pass.")
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Also run the full browser smoke test against ULTIMA_BASE_URL.",
    )
    args = parser.parse_args()

    for path in (
        "public/MovementController.js",
        "public/Player.js",
        "public/game.js",
        "public/render.js",
        "public/renderCore.js",
        "public/renderer/camera.js",
        "public/throneRoom/pipeline.js",
        "public/throneRoom/characterVisuals.js",
    ):
        syntax_check(path)

    verify_static_integration()
    verify_node_behaviour()
    verify_renderer_runtime()

    if args.browser:
        run_browser_smoke()
        print(f"Movement polish browser smoke passed. Screenshot: {SCREENSHOT_PATH}")
    else:
        print("Movement polish syntax, integration, controller, interpolation, and camera checks passed.")
        print("Run with --browser while the local server is running for the full gameplay smoke test.")


if __name__ == "__main__":
    main()
