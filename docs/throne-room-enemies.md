# Throne-room enemy NPCs

Castle Britannia now presents the opening ambush as a visible scene rather than an invisible tile trigger.

## Encounter staging

Three hostile Gargoyles occupy the hall while `castle_crisis` is below stage 2:

- **Gargoyle Vanguard** — blocks the centre of the royal approach and controls the largest detection radius.
- **Gargoyle Skirmisher** — holds the western aisle.
- **Gargoyle Seer** — watches the eastern aisle and reinforces the False Prophet theme.

They use the established Gargoyle sheet, but receive throne-room-specific hostile lighting, floor marks, outlines, eye glow, animation timing, and interaction prompts.

## Starting combat

The onboarding battle begins when the player:

- enters a hostile NPC’s aggression radius;
- bumps into a hostile NPC; or
- presses `T` while facing one.

The existing `throne_ambush` combat category is preserved. The visible raiding party is removed only after victory. Fleeing, losing, or reloading an unfinished stage restores the enemies so the encounter cannot become stranded.

## Persistence

Enemy presence is derived from existing state rather than adding another save field:

```text
show enemies = throneIntroComplete is false AND castle_crisis < 2
```

This keeps old saves compatible. Saves that have already cleared the throne-room ambush do not respawn the raiders.

## Scope

The change does not alter:

- Castle map geometry;
- NPC or player collision rules;
- onboarding combat balance;
- Orb quest stages;
- save schema;
- non-castle rendering.
