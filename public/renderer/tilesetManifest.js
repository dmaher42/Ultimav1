// Feature: Tile Manifest (Expanded for Dungeon & Bedroom)

const CORE_TILES = [
  // --- TERRAIN ---
  { name: 'grass', category: 'terrain', src: 'assets/tiles/terrain/grass.png' },
  { name: 'trees', category: 'terrain', src: 'assets/tiles/trees.png' },
  { name: 'water', category: 'terrain', src: 'assets/tiles/terrain/water.png' },
  { name: 'path', category: 'terrain', src: 'assets/tiles/path.png' },
  { name: 'courtyard', category: 'terrain', src: 'assets/tiles/terrain/courtyard.png' },
  { name: 'dungeon_floor', category: 'terrain', src: 'assets/tiles/dungeon_00_00.png' }, // NEW
  { name: 'castle_floor', category: 'terrain', src: 'assets/tiles/terrain/castle_floor.png' },
  { name: 'marble_floor', category: 'terrain', src: 'assets/tiles/terrain/marble_floor.png' },
  { name: 'marble_floor_1', category: 'terrain', src: 'assets/tiles/terrain/marble_floor_1.png' },
  { name: 'marble_floor_2', category: 'terrain', src: 'assets/tiles/terrain/marble_floor_2.png' },
  { name: 'marble_floor_3', category: 'terrain', src: 'assets/tiles/terrain/marble_floor_3.png' },
  { name: 'marble_edge', category: 'terrain', src: 'assets/tiles/terrain/marble_edge.png' },
  { name: 'dais_floor', category: 'terrain', src: 'assets/tiles/terrain/dais_floor.png' },
  { name: 'red_carpet', category: 'terrain', src: 'assets/tiles/terrain/red_carpet.png' },
  { name: 'red_carpet_1', category: 'terrain', src: 'assets/tiles/terrain/red_carpet_1.png' },
  { name: 'red_carpet_2', category: 'terrain', src: 'assets/tiles/terrain/red_carpet_2.png' },
  { name: 'red_carpet_end', category: 'terrain', src: 'assets/tiles/terrain/red_carpet_end.png' },

  // --- CASTLE ARCHITECTURE ---
  { name: 'marble_wall', category: 'architecture', src: 'assets/tiles/architecture/marble_wall.png' },
  { name: 'marble_wall_1', category: 'architecture', src: 'assets/tiles/architecture/marble_wall_1.png' },

  // --- PROPS & DECOR ---
  { name: 'throne', category: 'props', src: 'assets/tiles/props/throne.png' },
  { name: 'banner', category: 'props', src: 'assets/tiles/props/banner.png' },
  { name: 'royal_drapes', category: 'props', src: 'assets/tiles/props/royal_drapes.png' },
  { name: 'royal_crest', category: 'props', src: 'assets/tiles/props/royal_crest.png' },
  { name: 'royal_brazier', category: 'props', src: 'assets/tiles/props/royal_brazier.png' },
  { name: 'torch_wall', category: 'props', src: 'assets/tiles/props/torch_wall.png' },
  { name: 'fountain', category: 'props', src: 'assets/tiles/props/fountain.png' },
  { name: 'pillar', category: 'props', src: 'assets/tiles/pillar.png' },
  { name: 'royal_plant', category: 'props', src: 'assets/tiles/props/royal_plant.png' },
  { name: 'garden', category: 'props', src: 'assets/tiles/props/garden.png' },
  { name: 'royal_bed', category: 'props', src: 'assets/tiles/royal_bed.png' }, // NEW
  { name: 'bookshelf', category: 'props', src: 'assets/tiles/bookshelf.png' },
  { name: 'armory_rack', category: 'props', src: 'assets/tiles/armory_rack.png' }, // NEW

  // --- DUNGEON / MISC ---
  { name: 'cave_entrance', category: 'terrain', src: 'assets/tiles/cave_entrance.png' },
  { name: 'cave_exit', category: 'terrain', src: 'assets/tiles/cave_exit.png' }
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

export const TILE_BASE_PATHS = [
  'assets/tiles/',
  'public/assets/tiles/',
  './assets/tiles/'
];

export const FALLBACK_TILE_MANIFEST = {
  tiles: CORE_TILES,
  tilesByName: new Map(CORE_TILES.map(t => [t.name, t])),
  categories: groupByCategory(CORE_TILES)
};
