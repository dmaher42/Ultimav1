# Adding Your Own Sprites to Ultima V1

This guide will walk you through adding custom character sprites to the Ultima V1 game. The game includes a powerful sprite loading system with real-time testing tools.

## Quick Start

1. **Create or Find a Sprite Sheet**: Must be 3 columns × 4 rows (12 frames total)
2. **Test with Sprite Loader**: Open `/sprite-loader.html` in your browser
3. **Preview Locally**: Drag & drop or choose your PNG/JPG sprite to see it animate
4. **Click “Upload Sprite”**: The tool saves it to `assets/sprites/` automatically (PNG/JPG up to 5 MB)

## Sprite Format Specification

### Required Layout
Your sprite sheet must follow this exact format:

```
┌─────────┬─────────┬─────────┐
│ Down 1  │ Down 2  │ Down 3  │  ← Walking down (towards camera)
├─────────┼─────────┼─────────┤
│ Left 1  │ Left 2  │ Left 3  │  ← Walking left
├─────────┼─────────┼─────────┤
│ Right 1 │ Right 2 │ Right 3 │  ← Walking right  
├─────────┼─────────┼─────────┤
│ Up 1    │ Up 2    │ Up 3    │  ← Walking up (away from camera)
└─────────┴─────────┴─────────┘
```

### Technical Requirements
- **Format**: PNG (recommended) or JPG
- **Dimensions**: Each frame should be equal size (e.g., 32×32, 48×48, or 64×64 pixels)
- **Transparency**: PNG with alpha channel works best
- **Total Frames**: Exactly 12 frames (3 columns × 4 rows)
- **Animation**: Frame 2 is typically the "neutral" walking pose for each direction

## Installation Methods

### Method 1: Sprite Loader Tool (Recommended for Testing)

The interactive sprite loader tool is perfect for testing your sprites:

1. **Start the Game Server**:
   ```bash
   npm start
   ```

2. **Open Sprite Loader**: Navigate to `http://localhost:3000/sprite-loader.html`

3. **Preview Your Sprite** using any of these methods:
   - **Drag & Drop**: Drag your PNG/JPG file directly onto the browser window
   - **File Browser**: Click "Choose File..." and select your sprite
   - **URL Input**: Type the filename in "Sprite URL" field and click "Load"

4. **Upload to Assets**: Click **Upload Sprite** to copy the previewed sheet into `assets/sprites/` (PNG/JPG up to 5 MB)

5. **Test Animation**: Use arrow keys to move the character and verify all directions work correctly

### Method 2: Direct File Installation

For permanent installation in the game:

1. **Choose Directory**: Place your sprite file in one of these locations (in order of preference):
   ```
   assets/sprites/yoursprite.png          (recommended)
   public/assets/sprites/yoursprite.png   (also good)
   assets/yoursprite.png                  (legacy)  
   public/assets/yoursprite.png          (legacy)
   ```

2. **Reference in Game**: The sprite will be automatically detected and available in the sprite selector dropdown

> 💡 You can still copy files manually if you prefer, but the sprite loader's **Upload Sprite** button now saves directly to `assets/sprites/` for you.

## Creating Your Own Sprites

### Tools You Can Use
- **Aseprite** (paid, excellent for pixel art)
- **GIMP** (free, good for editing existing sprites)
- **Photoshop** (paid, professional option)
- **Piskel** (free online pixel art editor)
- **GraphicsGale** (free, good for animation)

### Step-by-Step Creation

1. **Create New Image**: 
   - Size: 96×128 pixels (for 32×32 frames) or 144×192 pixels (for 48×48 frames)
   - Background: Transparent

2. **Draw Your Character**: Start with the "Down 2" frame (middle frame, row 1)
   - This should be your character's neutral front-facing pose
   - Keep the character centered in the frame

3. **Create Walking Animation**:
   - **Down 1**: Slightly lean forward, one foot forward
   - **Down 2**: Neutral standing pose  
   - **Down 3**: Slightly lean back, other foot forward

4. **Mirror for Other Directions**:
   - Copy and modify for left, right, and up-facing directions
   - Maintain consistent proportions and style

5. **Test and Refine**: Use the sprite loader tool frequently to test your work

### Style Guidelines

- **Medieval/Fantasy Theme**: The game has a classic RPG aesthetic
- **Readable at Small Sizes**: Characters will be rendered at various scales
- **Consistent Proportions**: Keep head, body, and limb ratios consistent across frames
- **Clear Silhouette**: Make sure your character is easily distinguishable

## Troubleshooting

### Sprite Not Loading
- **Check Console**: Open browser developer tools and look for error messages
- **Verify File Path**: Ensure the file exists in the correct directory
- **Test with Tool**: Use the sprite loader tool to isolate issues

### Wrong Animation
- **Layout Check**: Verify your sprite sheet follows the exact 3×4 format
- **Frame Order**: Ensure rows are: down, left, right, up (in that order)

### Performance Issues
- **File Size**: Keep individual sprite files under 1MB
- **Dimensions**: Very large frames may cause performance issues

### Visual Issues
- **Scaling**: The game automatically scales sprites, but consistent sizing works best
- **Transparency**: Use PNG with alpha channel for best results
- **Centering**: Make sure characters are centered within each frame

## Sprite Upload API

Automate sprite management or integrate with other tools using these endpoints:

- `POST /api/upload-sprite`
  - Send a `multipart/form-data` request with a single field named `sprite`
  - Accepts PNG or JPG files up to **5 MB** and stores them in `assets/sprites/`
  - Returns the saved `filename`, `url`, original filename, and the refreshed sprite list
- `GET /api/sprites`
  - Returns `{ sprites: [{ name, url }, ...] }` covering all supported sprite directories

Uploads appear immediately in the sprite loader dropdown and inside the main game.

## Example Resources

### Free Sprite Sources
- **OpenGameArt.org**: Large collection of free game assets
- **Itch.io**: Many free character sprite packs
- **Kenney.nl**: High-quality free game assets

### Converting Existing Sprites
If you have sprites in different formats:

1. **Single Frame Characters**: You'll need to create the other 11 frames manually
2. **Different Layouts**: Use image editing software to rearrange into 3×4 format
3. **Wrong Directions**: May need to rotate or flip frames to match expected directions

## Advanced Features

### Multiple Character Support
- Each sprite file becomes a selectable character
- Name your files descriptively: `knight.png`, `wizard.png`, `archer.png`

### Custom Animations
- While walking uses frames 1→2→3→2 (cycling), you can design frames with this in mind
- Frame 2 should work well as both middle animation and idle pose

### Integration with Game Systems
- Sprites automatically work with the game's collision detection
- Character outline and lighting effects are applied automatically
- All game mechanics (combat, inventory, etc.) work with any sprite

## Getting Help

If you run into issues:

1. **Use the Sprite Loader Tool**: It provides real-time feedback and error messages
2. **Check Browser Console**: Look for specific error messages
3. **Test with Existing Sprites**: Try loading `heroa.png` to verify the system works
4. **Start Simple**: Begin with editing existing sprites before creating from scratch

The sprite system is designed to be forgiving - if a sprite fails to load, the game will show placeholder graphics and continue working, so feel free to experiment!