# Castle Britannia Throne-Room Visual Overhaul

## Scope

This pass changes presentation only. Gameplay tile coordinates, collision, NPC positions, dialogue triggers, the throne-room ambush, quest logic, and save data remain unchanged.

The former renderer is preserved verbatim as `public/renderCore.js`. `public/render.js` now subclasses that renderer and replaces only the `castle` scene. All other maps continue through the original rendering path.

## New visual system

- Dark blue-grey stone replaces the washed-out pale backdrop.
- The throne now sits inside a deep royal apse with an arched stone frame.
- A rose window, paired stained-glass windows, side niches, and a Virtue frieze establish a recognisable Britannian identity.
- The dais has three readable stepped levels, stronger contact shadows, and a controlled warm throne light.
- The royal runner is tapered toward the throne, edged in gold, and carries repeating Virtue medallions.
- Marble flooring uses larger slab rhythm, restrained veining, dark inlays, and cool window-light reflections.
- Pillars, banners, throne, torches, and braziers receive new procedural artwork with consistent materials and lighting.
- Lord British and the sentinels retain their existing sprites and logical coordinates but use subtler grounding, rim light, and staging.
- Excessive orbiting lights and competing glow layers are removed in favour of a single cool daylight beam, warm firelight, gentle dust, and a stronger cinematic vignette.

## Verification

Run the normal server, then execute:

```bash
npm start
python verification/verify_throne_room_visuals.py
```

The verification script checks the new renderer class, visual colour/depth diversity, player movement, transitions to another map and back, browser errors, and writes a screenshot to `artifacts/throne-room-visual-overhaul.png`.
