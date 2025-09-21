# Ultima V1 - Sprite Loading System

This project includes a robust sprite loading system with fallback mechanisms to ensure reliable asset loading.

## 🎨 Want to Add Your Own Sprites?

**See the [Complete Sprite Guide](SPRITE_GUIDE.md)** for step-by-step instructions on adding custom character sprites to the game!

**Quick Start:**
1. Open the **Sprite Loader Tool** at `/sprite-loader.html` 
2. Drag & drop your PNG sprite sheet (3×4 format required)
3. Test with arrow keys, then install to `assets/sprites/` directory

The game includes an interactive sprite testing tool and supports drag-and-drop sprite loading for easy customization.

## Recent Updates - Lord British's Castle

The game now starts in Lord British's magnificent castle, inspired by Ultima 7's iconic throne room and castle architecture. The scene features:

- **Throne Room**: Centered layout with Lord British's golden throne and red carpet approach
- **Castle Architecture**: Stone walls, floors, doors, and windows creating authentic medieval atmosphere  
- **Courtyards**: Beautiful gardens with decorative fountains surrounding the castle
- **Royal NPCs**: Lord British himself sits near his throne, flanked by Royal Guards and attended by Castle Servants

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

### NPCs in the Castle

- **Lord British**: The ruler of Britannia, positioned near his throne (golden)
- **Royal Guards**: Elite guards protecting the castle (blue)  
- **Castle Servant**: Helpful staff maintaining the castle (brown)

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
2. **Load via URL**: Enter your sprite filename in the "Sprite URL" field and click "Load"
3. **Drag & Drop**: Simply drag your PNG/JPG sprite file onto the browser window
4. **Choose File**: Click "Choose File..." to browse and select your sprite

The tool provides real-time preview and will show you exactly how your sprite looks in the game.

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
2. **Upload Your Sprite**: Use drag-and-drop or file selection
3. **Verify Animation**: Use arrow keys to move the character and check all directions
4. **Check All Frames**: Each direction should have smooth 3-frame animation
5. **Install Permanently**: Copy to `assets/sprites/` directory once satisfied

The sprite system is robust and designed to work even if some sprites fail to load, so don't worry about breaking the game while experimenting!

#### Upgrading Castle Assets

The castle currently uses fallback colors for visual tiles. To upgrade with pixel art assets:

1. **Castle Tiles**: Add proper 48x48 pixel art tiles to `assets/tiles/` directory:
   - `castle_wall.png` - Medieval stone wall texture
   - `castle_floor.png` - Polished stone floor pattern  
   - `red_carpet.png` - Rich red carpet with royal patterns
   - `throne.png` - Ornate golden throne sprite
   - `banner.png` - Royal heraldic banners with coat of arms
   - `torch_wall.png` - Flickering wall torch with flame animation
   - `castle_door.png` - Heavy wooden door with iron reinforcements
   - `castle_window.png` - Tall arched window with light rays
   - `fountain.png` - Decorative stone fountain with water
   - `garden.png` - Lush garden with flowers and plants
   - `courtyard.png` - Smooth stone courtyard paving

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