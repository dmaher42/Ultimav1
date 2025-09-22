# Ultima V1 - Sprite Loading System

This project includes a robust sprite loading system with fallback mechanisms to ensure reliable asset loading.

## 🎨 Want to Add Your Own Sprites?

**See the [Complete Sprite Guide](SPRITE_GUIDE.md)** for step-by-step instructions on adding custom character sprites to the game!

**Quick Start:**
1. Open the **Sprite Loader Tool** at `/sprite-loader.html`
2. Drag & drop your PNG sprite sheet (3×4 format required) or choose a file
3. Click **Upload Sprite** to copy it into the game's `assets/sprites/` folder (PNG/JPG up to 5 MB)
4. Test with arrow keys to make sure the animation looks right

The game includes an interactive sprite testing tool and supports drag-and-drop sprite loading for easy customization.

## Recent Updates - Lord British's Castle

The game now starts in Lord British's magnificent castle, inspired by Ultima 7's iconic throne room and castle architecture. The scene features:

- **Throne Room**: A grand hall with marble pillars and a red carpet approach to Lord British's golden throne
- **Royal Wings**: Side corridors lead to a library, guard barracks, royal study, bustling kitchens, and a chapel sanctuary
- **Castle Architecture**: Stone walls, polished floors, sturdy doors, and tall windows creating authentic medieval atmosphere
- **Courtyards**: Expansive gardens with decorative fountains surrounding the castle grounds
- **Royal NPCs**: Lord British, his guards, attendants, scholars, and groundskeepers bring the castle to life

### Castle Tile Types Added

The following new tile types have been added for the castle scene:
- `castle_wall` - Sturdy stone castle walls (gray)
- `castle_floor` - Polished stone floors (light gray)
- `red_carpet` - Royal carpet leading to the throne (deep red)
- `throne` - Lord British's magnificent throne (gold)
- `banner` - Royal heraldic banners (blue)
- `torch_wall` - Wall-mounted torches (orange)
- `castle_door` - Heavy wooden doors (brown)
- `castle_window` - Tall castle windows (light blue)
- `fountain` - Decorative courtyard fountains (blue)
- `garden` - Well-tended castle gardens (green)
- `courtyard` - Stone-paved courtyard areas (gray)
- `pillar` - Marble columns lining the great hall (white)
- `bookshelf` - Packed shelves from the royal library (oak)
- `barracks_bed` - Guard bunks within the barracks (steel blue)
- `kitchen_table` - Sturdy tables for the castle kitchens (warm brown)
- `study_desk` - Desks covered in maps and ledgers (golden brown)
- `chapel_altar` - Sacred altar at the heart of the chapel (ivory)

### Castle Tile Pipeline

- **Canonical Tile Size** – every tile in the castle set is now 48×48 pixels. PNGs live alongside their `.tsx` counterparts so Tiled knows how to auto-tile and so the renderer can find them quickly.
- **Purpose-Driven Folders** – assets are organised by intent: `assets/tiles/terrain/` for autotiles (floors, carpets, water, grass), `assets/tiles/architecture/` for modular walls/doors/windows, and `assets/tiles/props/` for object-layer sprites (throne room décor, torches, fountains).
- **Autotiling Ready** – each terrain tileset defines a Wang set (e.g., `castle_floor_auto`, `red_carpet_auto`) so painting rooms automatically blends corners and edges. Keep a 2 px margin and spacing when expanding the spritesheets to avoid texture bleeding.
- **Manifest-Driven Metadata** – `assets/tiles/manifest.json` tags tiles with collision, default layer, sound, and interaction hints. The front-end reads this file to extend loader search paths, preload assets per layer, and align props via their baseline anchors.
- **Object Layer Props** – props now default to an object layer with baseline anchors and optional interactions (`talkToLordBritish`, `listenToWater`). The renderer draws a subtle shadow using those anchors so objects feel grounded without extra manual art passes.
- **Sample Map** – `assets/maps/castle_throne_room.tmx` demonstrates how to layer terrain, carpet overlays, walls, and props using the external tilesets defined in the new structure.

### NPCs in the Castle

- **Lord British**: The ruler of Britannia welcomes visitors in the great hall (golden)
- **Royal Guards**: Elite guards flank the throne and patrol the barracks (blue)
- **Castle Servant**: Greets travelers entering the keep (brown)
- **Royal Librarian**: Curates the shelves of Britannia's lore (indigo)
- **Captain of the Guard**: Oversees drills in the new barracks (navy)
- **Court Scholar**: Studies charts and decrees within the royal study (violet)
- **Castle Chef**: Keeps the kitchens stocked for every royal feast (copper)
- **Royal Chaplain**: Tends to the chapel and the Eight Virtues (pale gold)
- **Groundskeeper**: Maintains the vibrant courtyards and fountains (emerald)

## Sprite Assets

### Directory Structure

The sprite loader searches for sprites in the following locations (in order of preference):

1. `assets/sprites/` - Preferred location for sprite assets
2. `assets/` - Legacy location for sprites  
3. `public/assets/sprites/` - Public served sprites subdirectory
4. `public/assets/` - Public served sprites base directory

### Required Assets

The following assets should be present for proper functionality:

- **Default Sprite**: `heroa.png` - Used as fallback when requested sprites fail to load
- **Placeholder**: `placeholder.png` - Shown when all loading attempts fail (optional, generated programmatically if missing)

### Sprite Loading Behavior

When loading a sprite, the system follows this process:

1. **Primary Load**: Attempts to load the requested sprite from all available paths
2. **Default Fallback**: If the primary load fails, attempts to load `heroa.png` from all paths
3. **Placeholder Fallback**: If both primary and default fail, generates a colored placeholder rectangle

### Console Logging

The sprite loader provides detailed console output:

- `✓` indicates successful loads with the source path
- `✗` indicates failed attempts with the attempted path  
- `⚠️` indicates fallback strategies being used
- Error details are logged for debugging

### For Contributors

When adding new sprites:

1. Place sprite files in `assets/sprites/` directory for best compatibility
2. Sprites should be in PNG format with 3 columns × 4 rows layout (frames for animation)
3. Test sprite loading in browser console to verify proper paths
4. Ensure `heroa.png` exists as the fallback sprite

## How to Add Your Own Sprites

This game supports custom character sprites! Follow this comprehensive guide to add your own sprite artwork.

### Sprite Format Requirements

All character sprites must follow this exact format:
- **Image Format**: PNG (recommended) or JPG
- **Layout**: 3 columns × 4 rows (12 frames total)
- **Frame Size**: Each frame should be the same size (typically 32×32 or 48×48 pixels)
- **Animation Layout**:
  - Row 1: Down-facing animation (3 frames)
  - Row 2: Left-facing animation (3 frames) 
  - Row 3: Right-facing animation (3 frames)
  - Row 4: Up-facing animation (3 frames)

### Method 1: Using the Sprite Loader Tool

The easiest way to test and add sprites:

1. **Access the Tool**: Navigate to `/sprite-loader.html` in your browser while the game is running
2. **Preview Your Sprite** using any of these methods:
   - **Load via URL**: Enter your sprite filename in the "Sprite URL" field and click "Load"
   - **Drag & Drop**: Simply drag your PNG/JPG sprite file onto the browser window
   - **Choose File**: Click "Choose File..." to browse and select your sprite
3. **Upload to Game Assets**: Click **Upload Sprite** to copy the previewed sheet into `assets/sprites/` (PNG/JPG up to 5 MB). The dropdown refreshes automatically with your new sprite.
4. **Test Animation**: Use arrow keys to verify all four directions animate correctly

The tool provides real-time preview, uploads sprites directly into the game, and shows you exactly how your character looks in context.

### Method 2: File System Installation

For permanent sprite installation:

1. **Choose Location**: Place your sprite files in one of these directories (in order of preference):
   ```
   assets/sprites/          (recommended)
   public/assets/sprites/   (also good)
   assets/                  (legacy support)
   public/assets/          (legacy support)
   ```

2. **File Naming**: Use descriptive names like:
   - `my-character.png`
   - `knight-armor.png`
   - `wizard-robes.png`

3. **Test Loading**: Use the sprite loader tool to verify your sprite loads correctly

### Sprite Creation Guidelines

**Frame Layout Example:**
```
[Down1] [Down2] [Down3]
[Left1] [Left2] [Left3]  
[Right1][Right2][Right3]
[Up1]   [Up2]   [Up3]
```

**Tips for Best Results:**
- Keep consistent frame sizes throughout your sprite sheet
- Center your character within each frame
- Use transparent backgrounds (PNG with alpha channel)
- Test all 4 directions to ensure proper animation
- Consider the game's medieval/fantasy theme

### Common Issues and Solutions

**Sprite Not Loading:**
- Check browser console for error messages
- Verify file exists in correct directory
- Ensure filename matches exactly (case-sensitive)
- Try using the sprite loader tool first

**Wrong Animation Direction:**
- Double-check your sprite sheet layout matches the 3×4 format
- Ensure rows are in correct order: down, left, right, up

**Sprite Appears Too Large/Small:**
- The game will automatically scale sprites, but consistent sizing works best
- Try 32×32 or 48×48 pixels per frame

**Placeholder Rectangles Showing:**
- This means the sprite file couldn't be loaded
- Check file path and permissions
- Verify the sprite follows the required 3×4 format

### Example Sprite Sources

You can find suitable sprite sheets from:
- OpenGameArt.org
- Itch.io free asset packs
- Create your own using tools like Aseprite or GIMP
- Convert existing character art to the required format

### Testing Your Sprite

1. **Load the Sprite Loader Tool**: Navigate to `/sprite-loader.html`
2. **Preview the Sheet**: Use drag-and-drop or the file picker to see the animation in the scene
3. **Upload Sprite**: Click **Upload Sprite** to store it in `assets/sprites/` for future sessions
4. **Verify Animation**: Use arrow keys to move the character and check all directions
5. **Confirm Availability**: The sprite is now listed in the dropdown and ready to use in the main game

The sprite system is robust and designed to work even if some sprites fail to load, so don't worry about breaking the game while experimenting!

### Sprite Upload API (for tooling)

The server now exposes simple endpoints you can call from custom tools or scripts:

- `POST /api/upload-sprite`
  - Accepts `multipart/form-data` with a single field named `sprite`
  - Supports PNG or JPG files up to **5 MB**
  - Responds with the stored `filename`, `url`, the `originalName`, and the refreshed sprite list
- `GET /api/sprites`
  - Returns `{ sprites: [{ name, url }, ...] }` containing every detected sprite across the supported asset directories

Sprites uploaded through the API are immediately available in the loader dropdown and inside the main game.

#### Upgrading Castle Assets

The castle tile library now mirrors the way we build maps in Tiled. All tiles are 48×48 and split across three folders:

- `assets/tiles/terrain/` – floors, carpets, courtyards, grass, dirt, and water autotiles.
- `assets/tiles/architecture/` – modular walls, doors, and windows for structural layers.
- `assets/tiles/props/` – throne room furniture, torches, banners, fountains, and other interactables that live on object layers.

Each PNG has a companion `.tsx` file that declares Wang-set metadata, default layers, and anchor points. The master manifest at `assets/tiles/manifest.json` tags every tile with gameplay meaning so the renderer can preload the right atlas, align props to the floor, and attach default interactions.

To extend the castle set:

1. **Terrain autotiles** – expand the spritesheets in `assets/tiles/terrain/`, update the Wang sets inside the matching `.tsx`, and add the tile to the manifest with the correct `kind`, `layer`, and `wangset` name.
2. **Modular architecture** – drop new wall/window/door variations into `assets/tiles/architecture/`, making sure inner/outer corners, tees, and caps are present. Update the manifest so the game knows which layer and collision behaviour to apply.
3. **Props** – place interactable art in `assets/tiles/props/`, set `anchorX`/`anchorY` inside the `.tsx`, and list the object in the manifest with optional interaction metadata. The renderer now reads those anchors to draw baseline shadows and attach behaviours.

The sample map at `assets/maps/castle_throne_room.tmx` shows how terrain, carpet overlays, walls, and prop object layers fit together using the external tilesets.

2. **NPC Sprites**: Add character sprites to represent:
   - Lord British in royal robes and crown
   - Royal Guards in blue/silver armor  
   - Castle Servants in brown work clothes

3. **Atmospheric Enhancement**: Consider adding:
   - Warm lighting effects for medieval ambiance
   - Particle effects for torch flames and fountain water
   - Ambient sounds for a living castle environment

The current implementation provides a solid foundation - the layout, NPCs, and tile system are all functional and ready for visual asset upgrades.

### Troubleshooting

If sprites are not loading:

1. Check browser console for detailed error messages
2. Verify sprite files exist in the expected directories
3. Ensure proper file permissions for sprite assets
4. Test with `heroa.png` to verify path detection is working

The system is designed to be resilient - even if all sprites fail to load, the application will continue to work with generated placeholder graphics.