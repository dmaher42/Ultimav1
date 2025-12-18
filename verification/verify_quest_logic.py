from playwright.sync_api import sync_playwright, expect
import time

def verify_quest_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        # Load the game
        page.goto("http://localhost:3000")
        page.wait_for_selector("#game")
        time.sleep(2)

        # Check if Character Creator is open
        if page.is_visible("#character-creator"):
            print("Character creator detected. Creating character...")
            page.fill("#character-name", "TestHero")
            page.click("button[type='submit']")
            time.sleep(1)
            print("Character created.")

        # 1. Verify Quest starts at 0 (or undefined)
        initial_stage = page.evaluate("window.state.character.getQuestStage('orb_quest')")
        print(f"Initial Stage: {initial_stage}")
        assert initial_stage == 0

        # 2. Teleport to Lord British and Talk
        # Lord British is at (9, 3).
        # We teleport adjacent to him: (9, 4), facing north.
        page.evaluate("""
            state.player.position.x = 9;
            state.player.position.y = 4;
            state.player.facing = 'north';
            renderGame();
        """)
        time.sleep(1)

        # Press T to talk
        page.keyboard.press("t")
        time.sleep(1)

        # Verify Quest Stage is now 1
        stage_after_talk = page.evaluate("window.state.character.getQuestStage('orb_quest')")
        print(f"Stage after talk: {stage_after_talk}")
        assert stage_after_talk == 1

        # Close dialogue (Space)
        page.keyboard.press(" ")
        time.sleep(1)

        # 3. Get the Orb
        # Orb is in dungeon_1 (ID: 'dungeon_1') at 15,15.
        page.evaluate("""
            const orbMap = state.world.maps['dungeon_1'];
            state.map = orbMap;
            state.player.setMap(orbMap, 'entry');
            state.player.position.x = 15;
            state.player.position.y = 15;
            state.player.facing = 'south';
            renderGame();
        """)
        time.sleep(1)

        # Press G to get
        page.keyboard.press("g")
        time.sleep(1)

        # Verify Quest Stage is now 2
        stage_after_pickup = page.evaluate("window.state.character.getQuestStage('orb_quest')")
        print(f"Stage after pickup: {stage_after_pickup}")
        assert stage_after_pickup == 2

        # 4. Return to Lord British and Complete
        page.evaluate("""
            const castleMap = state.world.maps['castle'];
            state.map = castleMap;
            state.player.setMap(castleMap, 'castle_gate');
            state.player.position.x = 9;
            state.player.position.y = 4;
            state.player.facing = 'north';
            renderGame();
        """)
        time.sleep(1)

        # Talk to Lord British
        page.keyboard.press("t")
        time.sleep(1)

        # Verify Quest Stage is now 3
        stage_final = page.evaluate("window.state.character.getQuestStage('orb_quest')")
        print(f"Final Stage: {stage_final}")
        assert stage_final == 3

        print("Verification Successful!")
        browser.close()

if __name__ == "__main__":
    verify_quest_logic()
