# Movement polish pass

## Player movement

The game keeps tile-based collision and quest logic, but separates the player's logical tile from the position used for drawing.

- A tap moves one tile immediately.
- Holding WASD or an arrow key uses a game-owned repeat cadence rather than the operating system's keyboard-repeat setting.
- The most recently pressed direction wins when more than one movement key is held.
- A short one-step input buffer preserves quick turns made near the end of the current step.
- Releasing the newest direction falls back to the previous held direction.
- Logical movement remains cardinal and grid based; only the visual position is interpolated.
- Blocked input turns the Avatar toward the obstacle and produces a small visual nudge without changing tiles.

Default timing is defined in `public/MovementController.js`:

- visual step: 118 ms
- initial hold delay: 185 ms
- continuous repeat: 116 ms
- minimum gap between accepted steps: 92 ms
- buffered input window: 190 ms

## Camera and animation

- The camera follows the interpolated position instead of jumping between logical tiles.
- Map transitions snap the camera to the new spawn point rather than gliding from the previous map.
- Walk animation remains active for the duration of a visual step, including quick taps.
- Blur, tab changes, panels, dialogue, combat and map transitions clear held input to prevent stuck movement.

## NPC movement

Wandering NPCs retain their existing AI and logical destinations but now interpolate between tiles. Sprite-sheet NPCs also face their travel direction and cycle walking frames while in motion.

## Safety

The pass does not change map layouts, passability, NPC collision, transitions, quest triggers, save positions, combat or dialogue.

## Verification

Run the deterministic checks:

```bash
npm run verify:movement
```

For the full keyboard and camera smoke test, start the game in one terminal and run:

```bash
npm start
npm run verify:movement:browser
```
