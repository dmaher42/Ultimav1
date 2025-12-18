// Feature: Tile Manifest & Definitions
// Maps logical tile names to file paths for the loader

const CORE_TILES = [
  // --- TERRAIN ---
  {
    name: 'grass',
    category: 'terrain',
    src: 'assets/tiles/terrain/grass.png'
  },
  {
    name: 'trees',
    category: 'terrain',
    src: 'assets/tiles/trees.png'
  },
  {
    name: 'water',
    category: 'terrain',
    src: 'assets/tiles/terrain/water.png'
  },
  {
    name: 'path',
    category: 'terrain',
    src: 'assets/tiles/path.png'
  },
  {
    name: 'courtyard',
    category: 'terrain',
    src: 'assets/tiles/terrain/courtyard.png'
  },

  // --- CASTLE ARCHITECTURE ---
  {
    name: 'castle_floor',
    category: 'architecture',
    src: 'assets/tiles/terrain/castle_floor.png'
  },
  {
    name: 'castle_wall',
    category: 'architecture',
    src: 'assets/tiles/architecture/castle_wall.png'
  },
  {
    name: 'castle_door',
    category: 'architecture',
    src: 'assets/tiles/architecture/castle_door.png'
  },
  {
    name: 'castle_window',
    category: 'architecture',
    src: 'assets/tiles/architecture/castle_window.png'
  },
  {
    name: 'red_carpet',
    category: 'architecture',
    src: 'assets/tiles/terrain/red_carpet.png'
  },

  // --- PROPS & DECOR ---
  {
    name: 'throne',
    category: 'props',
    src: 'assets/tiles/props/throne.png'
  },
  {
    name: 'banner',
    category: 'props',
    src: 'assets/tiles/props/banner.png'
  },
  {
    name: 'torch_wall',
    category: 'props',
    src: 'assets/tiles/props/torch_wall.png'
  },
  {
    name: 'fountain',
    category: 'props',
    src: 'assets/tiles/props/fountain.png'
  },
  {
    name: 'pillar',
    category: 'props',
    src: 'assets/tiles/pillar.png'
  },
  {
    name: 'garden',
    category: 'props',
    src: 'assets/tiles/props/garden.png'
  },

  // --- DUNGEON / MISC ---
  {
    name: 'cave_entrance',
    category: 'terrain',
    src: 'assets/tiles/cave_entrance.png'
  },
  {
    name: 'cave_exit',
    category: 'terrain',
    src: 'assets/tiles/cave_exit.png'
  },
  {
    name: 'bookshelf',
    category: 'props',
    src: 'assets/tiles/bookshelf.png'
  }
];

export async function loadTileManifest() {
  return {
    tiles: CORE_TILES,
    tilesByName: new Map(CORE_TILES.map(t => [t.name, t])),
    categories: groupByCategory(CORE_TILES)
  };
}

function groupByCategory(tiles) {
  const map = new Map();
  tiles.forEach(tile => {
    const cat = tile.category || 'misc';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(tile.name);
  });
  return map;
}

export function getTileDefinition(manifest, name) {
  if (!manifest || !manifest.tilesByName) return null;
  return manifest.tilesByName.get(name) || null;
}

export function getTileNamesByCategory(manifest, category) {
  if (!manifest || !manifest.categories) return [];
  const list = manifest.categories.get(category);
  return Array.isArray(list) ? list.slice() : [];
}

export function getAllTileNames(manifest) {
  if (!manifest || !Array.isArray(manifest.tiles)) return [];
  return manifest.tiles.map((tile) => tile.name);
}

export const FALLBACK_TILE_MANIFEST = {
  tiles: CORE_TILES,
  tilesByName: new Map(CORE_TILES.map(t => [t.name, t])),
  categories: groupByCategory(CORE_TILES)
};

export const TILE_BASE_PATHS = [
  'assets/tiles/',
  'public/assets/tiles/',
  './public/assets/tiles/'
];
