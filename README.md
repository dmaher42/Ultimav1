# Ultima V1 - Sprite Loading System

This project includes a robust sprite loading system with fallback mechanisms to ensure reliable asset loading.

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

### Troubleshooting

If sprites are not loading:

1. Check browser console for detailed error messages
2. Verify sprite files exist in the expected directories
3. Ensure proper file permissions for sprite assets
4. Test with `heroa.png` to verify path detection is working

The system is designed to be resilient - even if all sprites fail to load, the application will continue to work with generated placeholder graphics.