Original prompt: Continue this repo from its current state until there is a playable browser-based game vertical slice that runs locally and can be viewed live in the browser.

## Notes

- Canonical entry: `index.html`
- Canonical game logic: `public/game.js`
- Canonical world data: `public/GameMap.js`
- Runtime path: `node server.js` via `npm start`
- Duplicate/stale files: `public/index.html` is only a redirect wrapper; `src/` appears to be older experiments and is not the live runtime path

## Current investigation

- Verify the live build in a browser.
- Confirm throne room exit and progression flow end-to-end.
- Preserve existing implementation and make the smallest safe fixes only.

## Verification Notes

- Intro ambush now resolves in the throne room, drops loot, and leaves the player able to talk to Lord British.
- Castle -> Athens -> Village -> Dungeon travel works, and the Orb of Moons can now be picked up and used to choose a destination.
- Storm Cloak is equipped from loot and blocks Reaper lightning damage.
- Socrates quest now shows the riddle choices, awards the Tactics Codex, and opens the codex panel.
- Reloading the page restores the saved state from localStorage.
- The character creator had a validation trap on the hero name field; it now starts with a real default name so Begin Adventure works immediately.
- Added a live objective panel in the HUD so the throne-room intro, Orb of Moons quest, and Codex quest are easier to follow during play and in `render_game_to_text`.
- Visual polish pass: strengthened the title screen, unified the panel/button palette, improved combat/dialogue/journal presentation, and made the creator screen feel more like Britannia instead of a generic form.
