
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to game...")
            page.goto("http://localhost:3000")

            # Wait for canvas
            page.wait_for_selector("#game", timeout=10000)
            print("Canvas found.")

            # Wait for button
            page.wait_for_selector("text=Begin Adventure", timeout=5000)
            print("Begin Adventure button found.")

            # Fill out the name field
            page.fill("#character-name", "Jules")
            print("Name filled.")

            page.click("text=Begin Adventure")
            print("Clicked Begin Adventure.")

            # Wait for game to load map (canvas content changes)
            time.sleep(2)

            # Take screenshot of in-game state
            page.screenshot(path="verification/game_state_ingame.png")
            print("Screenshot taken.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
