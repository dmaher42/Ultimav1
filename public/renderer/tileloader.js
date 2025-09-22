/**
 * Individual tile loader that attempts to load tiles from assets/tiles/
 * before falling back to atlas sprites
 */

class TileLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map(); // Track promises to avoid duplicate loads
    this.basePaths = [
      // existing locations
      'assets/tiles/',
      'public/assets/tiles/',
      './assets/tiles/',
      './public/assets/tiles/',
      // pixelcrawler locations (new)
      'public/assets/pixelcrawler/',
      'public/assets/pixelcrawler/tiles/',
      'public/assets/pixelcrawler/props/',
      './public/assets/pixelcrawler/',
      './public/assets/pixelcrawler/tiles/',
      './public/assets/pixelcrawler/props/'
    ];
    // optional: filename aliasing (tileName -> fileName without .png)
    this.alias = {
      // Map game tile names to pixelcrawler assets
      'castle_wall': 'wall_00_00',
      'castle_floor': 'floor_00_00',
      'red_carpet': 'floor_01_01',
      'throne': 'dungeon_00_03',
      'banner': 'dungeon_00_04',
      'torch_wall': 'wall_01_00',
      'castle_door': 'dungeon_01_00',
      'castle_window': 'wall_02_00',
      'fountain': 'dungeon_02_00',
      'garden': 'floor_02_00',
      'courtyard': 'floor_00_01',
      'pillar': 'wall_03_00',
      'bookshelf': 'dungeon_03_00',
      'barracks_bed': 'dungeon_04_00',
      'kitchen_table': 'dungeon_05_00',
      'study_desk': 'dungeon_06_00',
      'chapel_altar': 'dungeon_07_00',
      'kitchen_hearth': 'wall_04_00',
      'wash_basin': 'dungeon_02_01',
      'dining_table': 'dungeon_05_01',
      'armory_rack': 'dungeon_06_01',
      'training_dummy': 'dungeon_07_01',
      'royal_bed': 'dungeon_04_01',
      'stable_hay': 'floor_03_00',
      'water': 'water_00_00',
      'trees': 'wall_05_00',
      'grass': 'floor_04_00',
      'path': 'floor_05_00'
    };
  }

  async loadTile(tileName) {
    // Return cached tile if available
    if (this.cache.has(tileName)) {
      return this.cache.get(tileName);
    }

    // Return existing promise if already loading
    if (this.loading.has(tileName)) {
      return this.loading.get(tileName);
    }

    // Start loading the tile
    const loadPromise = this._loadTileFromPaths(tileName);
    this.loading.set(tileName, loadPromise);

    try {
      const result = await loadPromise;
      this.cache.set(tileName, result);
      return result;
    } catch (error) {
      // Remove from loading set on failure
      this.loading.delete(tileName);
      throw error;
    } finally {
      // Clean up loading promise
      this.loading.delete(tileName);
    }
  }

  async _loadTileFromPaths(tileName) {
    const stem = this.alias[tileName] || tileName;
    const filename = `${stem}.png`;
    
    for (const basePath of this.basePaths) {
      const url = `${basePath}${filename}`;
      try {
        const image = await this._loadImage(url);
        console.log(`✓ Loaded individual tile: ${tileName} from ${url}`);
        return { image, source: 'individual' };
      } catch (error) {
        console.log(`✗ Failed to load tile from ${url}:`, error.message);
        continue;
      }
    }
    
    throw new Error(`Failed to load tile ${tileName} from all paths`);
  }

  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      img.src = url;
    });
  }

  // Get a tile synchronously if cached, null otherwise
  getCachedTile(tileName) {
    return this.cache.get(tileName) || null;
  }

  // Pre-load common tiles
  async preloadTiles(tileNames) {
    const promises = tileNames.map(name => 
      this.loadTile(name).catch(err => {
        console.warn(`Failed to preload tile ${name}:`, err.message);
        return null;
      })
    );
    
    const results = await Promise.all(promises);
    const loaded = results.filter(Boolean).length;
    console.log(`Preloaded ${loaded}/${tileNames.length} individual tiles`);
    return results;
  }
}

// Create singleton instance
export const tileLoader = new TileLoader();

/**
 * Draw a tile using individual tile images if available, falling back to atlas
 */
export function drawTile(ctx, atlas, tileName, x, y, width, height, fallbackColor) {
  // Try to get cached individual tile first
  const cachedTile = tileLoader.getCachedTile(tileName);
  if (cachedTile && cachedTile.image) {
    ctx.drawImage(cachedTile.image, x, y, width, height);
    return true;
  }

  // Fall back to atlas sprite
  if (atlas && atlas.img && atlas.meta) {
    const frame = atlas.meta[tileName] || atlas.meta.default;
    if (frame) {
      const { x: sx, y: sy, w, h } = frame;
      ctx.drawImage(atlas.img, sx, sy, w, h, x, y, width, height);
      return true;
    }
  }

  // Final fallback to solid color
  if (fallbackColor) {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(x, y, width, height);
  }

  return false;
}

/**
 * Async version that loads individual tiles on demand
 */
export async function drawTileAsync(ctx, atlas, tileName, x, y, width, height, fallbackColor) {
  try {
    // Try to load individual tile
    const tile = await tileLoader.loadTile(tileName);
    if (tile && tile.image) {
      ctx.drawImage(tile.image, x, y, width, height);
      return true;
    }
  } catch (error) {
    // Continue to atlas fallback
  }

  // Use synchronous fallback path
  return drawTile(ctx, atlas, tileName, x, y, width, height, fallbackColor);
}