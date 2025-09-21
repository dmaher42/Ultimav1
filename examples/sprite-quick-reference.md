# Sprite Quick Reference Card

## Format Requirements
- **Layout**: 3 columns × 4 rows (12 frames total)
- **File**: PNG or JPG format  
- **Size**: 32×32, 48×48, or 64×64 pixels per frame
- **Transparency**: PNG with alpha channel recommended

## Frame Layout
```
[Down1] [Down2] [Down3]  ← Walking toward camera
[Left1] [Left2] [Left3]  ← Walking left
[Right1][Right2][Right3] ← Walking right  
[Up1]   [Up2]   [Up3]    ← Walking away from camera
```

## Quick Test Steps
1. Open `http://localhost:3000/sprite-loader.html`
2. Drag your PNG file onto the browser window
3. Use arrow keys to test all 4 directions
4. If satisfied, copy to `assets/sprites/` directory

## Common Sizes
- **Small**: 96×128 total (32×32 per frame)
- **Medium**: 144×192 total (48×48 per frame)  
- **Large**: 192×256 total (64×64 per frame)

## Animation Pattern
Game cycles: Frame 1 → Frame 2 → Frame 3 → Frame 2 → repeat
- Frame 2 should be the neutral/idle pose
- Frames 1 & 3 are the walking steps

## Troubleshooting
- **No sprite visible**: Check browser console for errors
- **Wrong direction**: Verify row order (down, left, right, up)
- **Poor animation**: Ensure frame 2 works as both idle and middle step

See `SPRITE_GUIDE.md` for complete documentation.