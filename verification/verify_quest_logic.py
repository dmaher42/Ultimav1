import base64
import os
from pathlib import Path
import subprocess

from playwright.sync_api import Page, sync_playwright

BASE_URL = os.environ.get("ULTIMA_BASE_URL", "http://127.0.0.1:3000")
REPO_ROOT = Path(__file__).resolve().parents[1]


def syntax_check_browser_module(relative_path: str) -> None:
    source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
    subprocess.run(
        ["node", "--input-type=module", "--check"],
        input=source,
        text=True,
        check=True,
    )


def verify_character_inventory_helper() -> None:
    source = (REPO_ROOT / "public/Character.js").read_text(encoding="utf-8")
    encoded = base64.b64encode(source.encode("utf-8")).decode("ascii")
    script = f"""
      const {{ default: Character }} = await import('data:text/javascript;base64,{encoded}');
      const character = new Character({{ name: 'Test', stats: {{ STR: 10, DEX: 10, INT: 10, VIT: 10, LUK: 10 }} }});
      if (character.hasItem('orb_of_moons')) throw new Error('Empty inventory reported an item');
      if (!character.addItem({{ id: 'orb_of_moons', name: 'Orb of Moons', type: 'quest' }})) throw new Error('Could not add quest item');
      if (!character.hasItem('orb_of_moons')) throw new Error('Added item was not found');
      character.removeItem('orb_of_moons');
      if (character.hasItem('orb_of_moons')) throw new Error('Removed item remained present');
    """
    subprocess.run(
        ["node", "--input-type=module", "-e", script],
        text=True,
        check=True,
    )


def create_fresh_hero(page: Page, name: str) -> None:
    page.add_init_script("localStorage.clear();")
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#game")

    if page.locator("#character-creator").is_visible():
        page.fill("#character-name", name)
        page.click("#character-creator button[type='submit']")

    page.wait_for_function(
        "window.gameApp && window.gameApp.state && window.gameApp.state.character"
    )

    page.evaluate(
        """
        const { state } = window.gameApp;
        state.throneIntroComplete = true;
        state.character.setQuestStage('castle_crisis', 4);
        """
    )


def assert_stage(page: Page, expected: int) -> None:
    actual = page.evaluate(
        "window.gameApp.state.character.getQuestStage('orb_quest')"
    )
    assert actual == expected, f"Expected Orb stage {expected}, received {actual}"


def open_npc_dialogue(page: Page, map_id: str, npc_id: str, spawn: str) -> None:
    page.evaluate(
        """
        ({ mapId, npcId, spawn }) => {
          const app = window.gameApp;
          app.changeMap(mapId, spawn);
          const npc = app.state.map.npcs.find((candidate) => candidate.id === npcId);
          if (!npc) throw new Error(`NPC not found: ${npcId}`);
          app.showDialogue(npc);
        }
        """,
        {"mapId": map_id, "npcId": npc_id, "spawn": spawn},
    )


def submit_keyword(page: Page, keyword: str) -> None:
    page.evaluate(
        "keyword => window.gameApp.handleDialogueSubmit(keyword)", keyword
    )


def pick_up_relic(page: Page, x: int, y: int) -> None:
    page.evaluate(
        """
        ({ x, y }) => {
          const app = window.gameApp;
          app.state.player.map = app.state.map;
          app.state.player.setPosition(x, y);
          app.handleGet();
        }
        """,
        {"x": x, "y": y},
    )


def begin_orb_quest(page: Page) -> None:
    open_npc_dialogue(page, "castle", "lord_british", "castle_gate")
    submit_keyword(page, "ORB")
    assert_stage(page, 1)
    objective = page.evaluate("window.gameApp.getObjectiveState().text")
    assert "Mariah" in objective

    open_npc_dialogue(page, "lycaeum_entrance", "mariah", "lycaeum_gateway")
    submit_keyword(page, "PROPHECY")
    assert_stage(page, 2)
    objective = page.evaluate("window.gameApp.getObjectiveState().text")
    assert "Dark Caverns" in objective


def recover_relics(page: Page, tablet_first: bool) -> None:
    page.evaluate(
        "window.gameApp.changeMap('dungeon_1', 'entry')"
    )
    locations = [(23, 7), (25, 7)] if tablet_first else [(25, 7), (23, 7)]

    pick_up_relic(page, *locations[0])
    assert_stage(page, 4)
    pick_up_relic(page, *locations[1])
    assert_stage(page, 5)

    inventory = page.evaluate(
        "window.gameApp.state.character.inventory.map(item => item.id)"
    )
    assert "orb_of_moons" in inventory
    assert "gargoyle_tablet" in inventory


def translate_and_finish(page: Page, final_keyword: str) -> None:
    open_npc_dialogue(page, "lycaeum_entrance", "mariah", "lycaeum_gateway")
    submit_keyword(page, "TABLET")
    assert_stage(page, 6)

    open_npc_dialogue(page, "castle", "lord_british", "castle_gate")
    submit_keyword(page, "MISUNDERSTANDING")
    assert_stage(page, 7)
    submit_keyword(page, final_keyword)
    assert_stage(page, 8)

    assert page.evaluate("window.gameApp.state.orbQuest.complete") is True
    assert page.locator("#vertical-slice-ending").is_visible()


def verify_diplomatic_path_and_reload(page: Page) -> None:
    create_fresh_hero(page, "Diplomat")
    begin_orb_quest(page)

    open_npc_dialogue(page, "dungeon_1", "gargoyle_guardian", "entry")
    assert_stage(page, 3)
    submit_keyword(page, "UNDERSTANDING")
    assert_stage(page, 4)

    resolution = page.evaluate("window.gameApp.state.orbQuest.guardianResolution")
    assert resolution == "diplomacy"

    recover_relics(page, tablet_first=True)
    translate_and_finish(page, "PEACE")

    stored = page.evaluate(
        "JSON.parse(localStorage.getItem('ultima_athens_save'))"
    )
    assert stored["version"] == 2
    assert stored["questState"]["orbQuest"]["guardianResolution"] == "diplomacy"
    assert stored["questState"]["orbQuest"]["finalDecision"] == "peace"
    assert stored["questState"]["orbQuest"]["complete"] is True

    page.reload(wait_until="domcontentloaded")
    page.wait_for_function(
        "window.gameApp?.state?.orbQuest?.complete === true"
    )
    assert_stage(page, 8)
    assert page.evaluate("window.gameApp.state.orbQuest.finalDecision") == "peace"
    assert page.locator("#vertical-slice-ending").is_visible()


def verify_combat_resolution_path(page: Page) -> None:
    create_fresh_hero(page, "Fighter")
    begin_orb_quest(page)

    page.evaluate(
        """
        async () => {
          const app = window.gameApp;
          app.changeMap('dungeon_1', 'entry');
          app.state.character.setQuestStage('orb_quest', 3);
          await app.resolveCombat(
            { outcome: 'victory', xp: 0, loot: [] },
            { id: 'gargoyle_guardian', name: 'Guardian', xpReward: 0 },
            'dungeon_boss'
          );
        }
        """
    )
    assert_stage(page, 4)
    assert page.evaluate("window.gameApp.state.orbQuest.guardianResolution") == "combat"
    guardian_present = page.evaluate(
        "window.gameApp.state.world.maps.dungeon_1.npcs.some(npc => npc.id === 'gargoyle_guardian')"
    )
    assert guardian_present is False

    recover_relics(page, tablet_first=False)
    translate_and_finish(page, "DEFENCE")
    assert page.evaluate("window.gameApp.state.orbQuest.finalDecision") == "defence"


def verify_quest_logic() -> None:
    for module in (
        "public/Character.js",
        "public/OrbQuest.js",
        "public/QuestManager.js",
        "public/SaveManager.js",
        "public/game.js",
    ):
        syntax_check_browser_module(module)

    verify_character_inventory_helper()

    with sync_playwright() as playwright:
        chromium_override = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if not chromium_override and Path("/usr/bin/chromium").exists():
            chromium_override = "/usr/bin/chromium"
        launch_options = {"headless": True}
        if chromium_override:
            launch_options["executable_path"] = chromium_override
        browser = playwright.chromium.launch(**launch_options)
        diplomatic_page = browser.new_page()
        diplomatic_page.on(
            "pageerror", lambda error: print(f"Diplomatic path page error: {error}")
        )
        verify_diplomatic_path_and_reload(diplomatic_page)

        combat_page = browser.new_page()
        combat_page.on(
            "pageerror", lambda error: print(f"Combat path page error: {error}")
        )
        verify_combat_resolution_path(combat_page)

        browser.close()

    print("Orb quest diplomatic path, combat path, ending, and reload checks passed.")


if __name__ == "__main__":
    verify_quest_logic()
