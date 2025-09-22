// extract_pixelcrawler_tiles.js
// Extract individual tiles from pixelcrawler sprite sheets for use with the existing tile system

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Tile mappings: game tile name -> { sheet, x, y, description }
const tileMappings = {
  // Castle/dungeon walls from structure/Walls.png
  'castle_wall': { sheet: 'structure/Walls.png', x: 0, y: 0, desc: 'Stone castle wall' },
  'dungeon_wall': { sheet: 'Dungeon_Tiles.png', x: 0, y: 0, desc: 'Dark dungeon wall' },
  
  // Floors from structure/Floors.png and Floors_Tiles.png
  'castle_floor': { sheet: 'structure/Floors.png', x: 0, y: 0, desc: 'Castle stone floor' },
  'red_carpet': { sheet: 'structure/Floors.png', x: 4, y: 2, desc: 'Royal red carpet' },
  'courtyard': { sheet: 'structure/Floors.png', x: 2, y: 0, desc: 'Courtyard stone' },
  
  // Props from structure/Props.png
  'throne': { sheet: 'structure/Props.png', x: 10, y: 8, desc: 'Royal throne' },
  'banner': { sheet: 'structure/Props.png', x: 15, y: 0, desc: 'Royal banner' },
  'torch_wall': { sheet: 'structure/Props.png', x: 0, y: 10, desc: 'Wall torch' },
  'castle_door': { sheet: 'structure/Props.png', x: 8, y: 12, desc: 'Castle door' },
  'castle_window': { sheet: 'structure/Props.png', x: 12, y: 4, desc: 'Castle window' },
  'fountain': { sheet: 'structure/Props.png', x: 20, y: 15, desc: 'Castle fountain' },
  'pillar': { sheet: 'structure/Props.png', x: 6, y: 0, desc: 'Marble pillar' },
  'bookshelf': { sheet: 'structure/Props.png', x: 2, y: 15, desc: 'Library bookshelf' },
  'kitchen_table': { sheet: 'structure/Props.png', x: 14, y: 10, desc: 'Kitchen table' },
  'study_desk': { sheet: 'structure/Props.png', x: 16, y: 8, desc: 'Study desk' },
  'chapel_altar': { sheet: 'structure/Props.png', x: 18, y: 12, desc: 'Chapel altar' },
  
  // Garden/outdoor tiles
  'garden': { sheet: 'Floors_Tiles.png', x: 5, y: 10, desc: 'Castle garden' },
  
  // Additional furniture/props
  'barracks_bed': { sheet: 'structure/Props.png', x: 4, y: 18, desc: 'Guard bed' },
  'kitchen_hearth': { sheet: 'structure/Props.png', x: 8, y: 20, desc: 'Kitchen hearth' },
  'wash_basin': { sheet: 'structure/Props.png', x: 12, y: 16, desc: 'Wash basin' },
  'dining_table': { sheet: 'structure/Props.png', x: 16, y: 12, desc: 'Dining table' },
  'armory_rack': { sheet: 'structure/Props.png', x: 20, y: 8, desc: 'Weapon rack' },
  'training_dummy': { sheet: 'structure/Props.png', x: 22, y: 14, desc: 'Training dummy' },
  'royal_bed': { sheet: 'structure/Props.png', x: 6, y: 20, desc: 'Royal bed' },
  'stable_hay': { sheet: 'structure/Props.png', x: 10, y: 22, desc: 'Stable hay' }
};

const TILE_SIZE = 16; // Source tile size in sprite sheets
const OUTPUT_SIZE = 48; // Target size for game (same as existing tiles)
const SOURCE_DIR = './public/assets/pixelcrawler/tiles';
const OUTPUT_DIR = './public/assets/tiles';

async function extractTiles() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Extracting tiles from pixelcrawler assets...`);
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Converting ${TILE_SIZE}x${TILE_SIZE} -> ${OUTPUT_SIZE}x${OUTPUT_SIZE}`);

  for (const [tileName, mapping] of Object.entries(tileMappings)) {
    try {
      const sourcePath = path.join(SOURCE_DIR, mapping.sheet);
      
      if (!fs.existsSync(sourcePath)) {
        console.warn(`⚠️  Source sprite sheet not found: ${sourcePath}`);
        continue;
      }

      console.log(`\nProcessing: ${tileName}`);
      console.log(`  Source: ${mapping.sheet} (${mapping.x}, ${mapping.y})`);
      console.log(`  Description: ${mapping.desc}`);

      // Load the sprite sheet
      const sourceImage = await loadImage(sourcePath);
      
      // Create output canvas
      const canvas = createCanvas(OUTPUT_SIZE, OUTPUT_SIZE);
      const ctx = canvas.getContext('2d');
      
      // Disable smoothing for pixel art
      ctx.imageSmoothingEnabled = false;
      
      // Extract and scale the tile
      ctx.drawImage(
        sourceImage,
        mapping.x * TILE_SIZE, mapping.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, // Source
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE // Destination
      );
      
      // Save the tile
      const outputPath = path.join(OUTPUT_DIR, `${tileName}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`  ✓ Saved: ${outputPath}`);
      
    } catch (error) {
      console.error(`  ✗ Error processing ${tileName}:`, error.message);
    }
  }

  console.log(`\n🎉 Tile extraction complete!`);
  console.log(`Check ${OUTPUT_DIR} for extracted tiles.`);
}

// Check if canvas package is available
try {
  require('canvas');
  extractTiles().catch(console.error);
} catch (error) {
  console.error('❌ Canvas package not found. Please install it with: npm install canvas');
  console.log('Alternative: Extract tiles manually using the web interface at /extract_tiles.html');
}