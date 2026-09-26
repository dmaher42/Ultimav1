import argparse
import base64
import json
import os
from pathlib import Path
import subprocess

REPO_ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ULTIMA_BASE_URL", "http://127.0.0.1:3000")


def syntax_check(relative_path: str) -> None:
    source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
    subprocess.run(
        ["node", "--input-type=module", "--check"],
        input=source,
        text=True,
        check=True,
    )


def require(source: str, fragment: str, label: str) -> None:
    if fragment not in source:
        raise AssertionError(f"Missing {label}: {fragment}")


def verify_enemy_data_module() -> None:
    source = (REPO_ROOT / "public/ThroneRoomEnemies.js").read_text(encoding="utf-8")
    encoded = base64.b64encode(source.encode("utf-8")).decode("ascii")
    script = f"""
      const mod = await import('data:text/javascript;base64,{encoded}');
      const castle = {{ npcs: [{{ id: 'lord_british', name: 'Lord British' }}] }};

      const first = mod.syncThroneAmbushNpcs(castle, {{
        castleCrisisStage: 0,
        throneIntroComplete: false
      }});
      if (first.length !== 3) throw new Error(`Expected 3 hostiles, received ${{first.length}}`);
      if (castle.npcs.length !== 4) throw new Error('Permanent NPC was not preserved');
      if (new Set(first.map((npc) => npc.id)).size !== 3) throw new Error('Hostile IDs are not unique');
      if (!first.every((npc) => npc.hostile && npc.enemyGroup === mod.THRONE_AMBUSH_GROUP)) {
        throw new Error('Hostile metadata is incomplete');
      }

      const second = mod.syncThroneAmbushNpcs(castle, {{
        castleCrisisStage: 1,
        throneIntroComplete: false
      }});
      if (second.length !== 3 || castle.npcs.length !== 4) {
        throw new Error('Repeated sync duplicated or removed NPCs');
      }

      const aggressor = mod.findThroneAmbushAggressor(castle, 14, 11);
      if (!aggressor || aggressor.id !== 'throne_raider_vanguard') {
        throw new Error('Central approach did not select the Vanguard');
      }
      if (mod.findThroneAmbushAggressor(castle, 2, 17)) {
        throw new Error('A distant player incorrectly triggered the ambush');
      }

      const cleared = mod.syncThroneAmbushNpcs(castle, {{
        castleCrisisStage: 2,
        throneIntroComplete: true
      }});
      if (cleared.length !== 0) throw new Error('Cleared encounter returned hostile NPCs');
      if (castle.npcs.length !== 1 || castle.npcs[0].id !== 'lord_british') {
        throw new Error('Hostiles were not removed cleanly');
      }

      console.log(JSON.stringify({{
        firstCount: first.length,
        aggressor: aggressor.id,
        remainingAfterClear: castle.npcs.length
      }}));
    """
    subprocess.run(
        ["node", "--input-type=module", "-e", script],
        text=True,
        check=True,
    )


def verify_runtime_integration() -> None:
    game = (REPO_ROOT / "public/game.js").read_text(encoding="utf-8")
    render = (REPO_ROOT / "public/render.js").read_text(encoding="utf-8")
    hostile_visuals = (REPO_ROOT / "public/throneRoom/hostileVisuals.js").read_text(encoding="utf-8")
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    index = (REPO_ROOT / "index.html").read_text(encoding="utf-8")
    public_index = (REPO_ROOT / "public/index.html").read_text(encoding="utf-8")

    require(game, "from './ThroneRoomEnemies.js?v=1'", "enemy data import")
    require(game, "function syncThroneRoomEnemies()", "world-state synchroniser")
    require(game, "function beginThroneRoomAmbush", "ambush starter")
    require(game, "findThroneAmbushAggressor(state.map, x, y)", "proximity trigger")
    require(game, "isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()", "collision/talk trigger")
    require(game, "syncThroneRoomEnemies();\n      renderer.playHostileDefeat?.();", "victory cleanup")
    require(game, "hostileNpcs:", "diagnostic hostile list")
    require(game, "Renderer from './render.js?v=19'", "renderer cache bump")

    require(render, "hostileVisualsMethods", "hostile renderer import")
    require(render, "characterVisualsMethods,\n  hostileVisualsMethods", "hostile renderer ordering")
    require(hostile_visuals, "drawNearbyHostilePrompt", "hostile prompt")
    require(hostile_visuals, "playHostileAlert", "hostile alert")
    require(hostile_visuals, "characterVisualsMethods.drawNPC.call", "friendly renderer fallback")

    if package.get("scripts", {}).get("verify:throne-enemies") != "python verification/verify_throne_room_enemies.py":
        raise AssertionError("Missing verify:throne-enemies package script")
    require(index, "./public/game.js?v=22", "root cache bump")
    require(public_index, "./game.js?v=22", "public cache bump")


def create_fresh_hero(page, name: str) -> None:
    page.add_init_script("localStorage.clear();")
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#game")
    if page.locator("#character-creator").is_visible():
        page.fill("#character-name", name)
        page.click("#character-creator button[type='submit']")
    page.wait_for_function("window.gameApp?.state?.character && window.gameApp?.state?.map")


def verify_browser() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit("Playwright is required for --browser verification") from exc

    with sync_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if not executable and Path("/usr/bin/chromium").exists():
            executable = "/usr/bin/chromium"
        launch_options = {"headless": True}
        if executable:
            launch_options["executable_path"] = executable

        browser = playwright.chromium.launch(**launch_options)
        page = browser.new_page(viewport={"width": 1366, "height": 768})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        create_fresh_hero(page, "EnemyNpcTest")

        status = page.evaluate(
            """
            () => {
              const app = window.gameApp;
              app.state.throneIntroComplete = false;
              app.state.character.setQuestStage('castle_crisis', 0);
              app.syncThroneRoomEnemies();
              app.changeMap('castle', 'castle_gate');
              return {
                hostiles: app.state.map.npcs.filter((npc) => npc.hostile).map((npc) => ({
                  id: npc.id,
                  x: npc.x,
                  y: npc.y
                })),
                stage: app.state.character.getQuestStage('castle_crisis')
              };
            }
            """
        )
        assert len(status["hostiles"]) == 3, status
        assert status["stage"] == 0, status

        page.evaluate("window.gameApp.attemptMove(0, -1)")
        page.evaluate("window.gameApp.attemptMove(0, -1)")
        page.wait_for_function("window.gameApp.state.inCombat === true")
        assert page.evaluate("window.gameApp.combatEngine.category") == "throne_ambush"
        browser.close()

        assert not errors, errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", action="store_true")
    args = parser.parse_args()

    for module in (
        "public/ThroneRoomEnemies.js",
        "public/throneRoom/hostileVisuals.js",
        "public/render.js",
        "public/game.js",
    ):
        syntax_check(module)

    verify_enemy_data_module()
    verify_runtime_integration()

    if args.browser:
        verify_browser()

    print("Throne-room enemy NPC data, rendering, triggers, cleanup, and cache checks passed.")


if __name__ == "__main__":
    main()
