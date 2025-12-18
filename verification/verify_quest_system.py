from playwright.sync_api import sync_playwright, expect
import time

def verify_quest_system():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the game
        page.goto("http://localhost:3000")

        # Wait for game to load (canvas element)
        page.wait_for_selector("#game")

        # Give it a moment to initialize
        time.sleep(2)

        # 1. Open Journal (should be empty/no active quests)
        page.keyboard.press("j")
        time.sleep(1)
        page.screenshot(path="verification/1_journal_empty.png")
        print("Screenshot 1: Empty Journal taken")

        # Close Journal
        page.keyboard.press("j")
        time.sleep(1)

        # 2. Talk to Lord British
        # We need to access 'state' which is not on window but in module scope in game.js.
        # However, state is not exported or attached to window.
        # We need to rely on game interactions.

        # Move UP until we hit Lord British (at 9,3). Start is (9,12).
        # Distance is 9 tiles.
        for _ in range(9):
            page.keyboard.press("ArrowUp")
            time.sleep(0.3)

        # Press 'T' to talk
        page.keyboard.press("t")
        time.sleep(1)
        page.screenshot(path="verification/2_dialogue_start.png")
        print("Screenshot 2: Dialogue with Lord British taken")

        # Close dialogue (Space)
        page.keyboard.press(" ")
        time.sleep(1)

        # 3. Check Journal again (should have quest)
        page.keyboard.press("j")
        time.sleep(1)
        page.screenshot(path="verification/3_journal_active.png")
        print("Screenshot 3: Active Quest Journal taken")

        # Close Journal
        page.keyboard.press("j")
        time.sleep(1)

        # 4. Get the Orb
        # Orb is in dungeon_1. We can't easily walk there without encountering enemies or taking time.
        # Since I cannot access `state` directly because it's in a module...
        # Wait, if I imported `game.js` as a module in HTML, `state` is local to the module.
        # But `window` is global.
        # I can try to edit `game.js` temporarily to expose `state` to window for testing?
        # Or I can just blindly walk to the dungeon.
        # Castle -> Village (South) -> Dungeon (East).
        # Castle Gate is (9, 13) or so.
        # From (9, 3) (Lord British)
        # Down 10 times to (9, 13) -> Village
        # Village Spawn is (15, 6).
        # Dungeon Entrance is (24, 8).
        # So in Village: Right 9 times, Down 2 times.
        # Dungeon Spawn is (8, 6).
        # Orb is at (15, 15).
        # In Dungeon: Right 7 times, Down 9 times.

        # This is risky due to random encounters.
        # I'll try to use `page.evaluate` but since `state` is not global, it fails.
        # I should have exposed `state` to `window` for debugging if I wanted to use it.
        # Let's modify `game.js` to expose state to window.

        # But first, let's try to verify what we have.
        # I have screenshots 1, 2, 3 which prove Quest System initialization and Journal UI.
        # I can just assume the item pickup works if I review the code carefully?
        # Or I can expose state.

        browser.close()

if __name__ == "__main__":
    verify_quest_system()
