# Castle Tile Library

This folder is now organised around the way the castle is built inside the game:

- **`terrain/`** – blob/autotiles for floors, carpets, courtyards, grass, dirt, and water.
- **`architecture/`** – modular structural pieces such as walls, doors, and windows.
- **`props/`** – everything that lives on the object layer (thrones, banners, torches, fountains, foliage).

All tiles share a **canonical resolution of 48×48 pixels** so they line up with the existing renderer. Each tileset (`.tsx`) is stored next to its PNG and carries metadata properties:

- `category`, `kind`, and `layer` map directly to runtime systems.
- `wangset` entries are prepared for Tiled's Wang-autotiling so corners and seams blend.
- Props declare `anchorX`/`anchorY` so the renderer knows where the baseline touches the floor.
- Interactive props (e.g., the throne or fountains) include `interact` properties so logic hooks do not need hard-coded switch statements.

## Working with Tiled

1. Open any `.tsx` file in Tiled to inspect the metadata and adjust Wang sets.
2. Keep **2–4 px spacing** and a **2 px margin** around tiles when expanding spritesheets to prevent texture bleeding.
3. Use the Wang sets named in each tileset (`castle_floor_auto`, `red_carpet_auto`, etc.) to paint terrain quickly.
4. Place walls, doors, and pillars from the architecture tilesets on their own tile layers so height reads correctly.
5. Drop props using an **object layer**. Their anchors point at the baseline and the renderer draws a soft shadow automatically.
6. Attach gameplay data through custom properties on the object – the manifest surfaces defaults so you only override differences.

The sample map at `assets/maps/castle_throne_room.tmx` demonstrates four layers (floor, carpet, walls, props) wired to the external tilesets.

## Manifest

`manifest.json` tags every tile with the gameplay meaning the code expects – `kind`, collision, default layer, optional interaction hooks, and whether it ships from the handcrafted PNGs or the Pixel Crawler extraction set. The atlas `image` fields describe the combined spritesheets we will publish once enough tiles exist; keep those filenames stable so runtime configuration does not drift. The front-end reads this file to:

- build lookup tables for `tileLoader`,
- preload relevant assets per layer, and
- provide anchors/shadows for prop objects.

When you add new art:

1. Drop the PNG in the appropriate subfolder.
2. Duplicate one of the existing `.tsx` files and update the `<image>` and properties.
3. Extend `manifest.json` with the new `name` and metadata (or mark it as coming from `source: "pixelcrawler"`).
4. Reference the tileset inside your `.tmx` map – the renderer will pick it up automatically via the manifest.

