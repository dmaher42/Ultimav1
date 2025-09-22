const MANIFEST_URL = 'assets/tiles/manifest.json';
const TILE_DIRECTORIES = ['terrain', 'architecture', 'props'];

const FALLBACK_MANIFEST = {
  tileSize: 48,
  atlases: {
    terrain: {
      image: 'assets/tiles/terrain/terrain_atlas.png',
      margin: 2,
      spacing: 2,
      layers: ['ground', 'floor', 'carpet', 'liquid'],
      description: 'Blob and bitmask autotiles for castle floors, carpets, and exterior grounds.'
    },
    architecture: {
      image: 'assets/tiles/architecture/architecture_atlas.png',
      margin: 2,
      spacing: 2,
      layers: ['walls', 'structure'],
      description: 'Modular walls, doors, windows, stairs, roofs, and structural caps.'
    },
    props: {
      image: 'assets/tiles/props/props_atlas.png',
      margin: 2,
      spacing: 2,
      layers: ['props', 'decor'],
      description: 'Object-layer sprites with drop shadows and anchor metadata.'
    }
  },
  tiles: [
    {
      name: 'grass',
      category: 'terrain',
      kind: 'ground',
      tileset: 'assets/tiles/terrain/grass.tsx',
      atlas: 'terrain',
      layer: 'ground',
      idRange: [0, 0],
      passable: true,
      footstep: 'grass',
      wangset: 'grass_auto'
    },
    {
      name: 'dirt',
      category: 'terrain',
      kind: 'ground',
      tileset: 'assets/tiles/terrain/dirt.tsx',
      atlas: 'terrain',
      layer: 'ground',
      idRange: [0, 0],
      passable: true,
      footstep: 'dirt',
      wangset: 'dirt_auto'
    },
    {
      name: 'stone',
      category: 'terrain',
      kind: 'floor',
      tileset: 'assets/tiles/terrain/stone.tsx',
      atlas: 'terrain',
      layer: 'floor',
      idRange: [0, 0],
      passable: true,
      footstep: 'stone',
      wangset: 'stone_auto'
    },
    {
      name: 'water',
      category: 'terrain',
      kind: 'water',
      tileset: 'assets/tiles/terrain/water.tsx',
      atlas: 'terrain',
      layer: 'liquid',
      idRange: [0, 0],
      passable: false,
      footstep: 'splash',
      wangset: 'water_auto'
    },
    {
      name: 'castle_floor',
      category: 'terrain',
      kind: 'floor',
      tileset: 'assets/tiles/terrain/castle_floor.tsx',
      atlas: 'terrain',
      layer: 'floor',
      idRange: [0, 0],
      passable: true,
      footstep: 'stone',
      wangset: 'castle_floor_auto'
    },
    {
      name: 'red_carpet',
      category: 'terrain',
      kind: 'carpet',
      tileset: 'assets/tiles/terrain/red_carpet.tsx',
      atlas: 'terrain',
      layer: 'carpet',
      idRange: [0, 0],
      passable: true,
      footstep: 'carpet',
      wangset: 'red_carpet_auto'
    },
    {
      name: 'courtyard',
      category: 'terrain',
      kind: 'floor',
      tileset: 'assets/tiles/terrain/courtyard.tsx',
      atlas: 'terrain',
      layer: 'floor',
      idRange: [0, 0],
      passable: true,
      footstep: 'stone',
      wangset: 'courtyard_auto'
    },
    {
      name: 'castle_wall',
      category: 'architecture',
      kind: 'wall',
      tileset: 'assets/tiles/architecture/castle_wall.tsx',
      atlas: 'architecture',
      layer: 'walls',
      idRange: [0, 0],
      passable: false,
      shadow: true
    },
    {
      name: 'castle_window',
      category: 'architecture',
      kind: 'window',
      tileset: 'assets/tiles/architecture/castle_window.tsx',
      atlas: 'architecture',
      layer: 'walls',
      idRange: [0, 0],
      passable: false,
      shadow: true
    },
    {
      name: 'castle_door',
      category: 'architecture',
      kind: 'door',
      tileset: 'assets/tiles/architecture/castle_door.tsx',
      atlas: 'architecture',
      layer: 'walls',
      idRange: [0, 0],
      passable: true,
      states: ['closed', 'open'],
      shadow: true
    },
    {
      name: 'pillar',
      category: 'architecture',
      kind: 'pillar',
      tileset: null,
      atlas: 'architecture',
      layer: 'structure',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'throne',
      category: 'props',
      kind: 'throne',
      tileset: 'assets/tiles/props/throne.tsx',
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      anchor: [0.5, 1],
      object: {
        type: 'throne',
        properties: {
          interact: 'talkToLordBritish'
        }
      }
    },
    {
      name: 'banner',
      category: 'props',
      kind: 'banner',
      tileset: 'assets/tiles/props/banner.tsx',
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      anchor: [0.5, 1]
    },
    {
      name: 'torch_wall',
      category: 'props',
      kind: 'torch',
      tileset: 'assets/tiles/props/torch_wall.tsx',
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      anchor: [0.5, 1],
      object: {
        type: 'light',
        properties: {
          lightRadius: 3
        }
      }
    },
    {
      name: 'fountain',
      category: 'props',
      kind: 'fountain',
      tileset: 'assets/tiles/props/fountain.tsx',
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      anchor: [0.5, 1],
      object: {
        type: 'fountain',
        properties: {
          interact: 'listenToWater'
        }
      }
    },
    {
      name: 'garden',
      category: 'props',
      kind: 'foliage',
      tileset: 'assets/tiles/props/garden.tsx',
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      anchor: [0.5, 1]
    },
    {
      name: 'bookshelf',
      category: 'props',
      kind: 'furniture',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'barracks_bed',
      category: 'props',
      kind: 'furniture',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'kitchen_table',
      category: 'props',
      kind: 'furniture',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'study_desk',
      category: 'props',
      kind: 'furniture',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'chapel_altar',
      category: 'props',
      kind: 'altar',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'kitchen_hearth',
      category: 'props',
      kind: 'furnace',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'wash_basin',
      category: 'props',
      kind: 'utility',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'dining_table',
      category: 'props',
      kind: 'furniture',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'armory_rack',
      category: 'props',
      kind: 'storage',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'training_dummy',
      category: 'props',
      kind: 'training',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: true,
      source: 'pixelcrawler'
    },
    {
      name: 'royal_bed',
      category: 'props',
      kind: 'furniture',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: false,
      source: 'pixelcrawler'
    },
    {
      name: 'stable_hay',
      category: 'props',
      kind: 'storage',
      tileset: null,
      atlas: 'props',
      layer: 'props',
      idRange: [0, 0],
      passable: true,
      source: 'pixelcrawler'
    }
  ]
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function indexTiles(manifest) {
  const tilesByName = new Map();
  const categories = new Map();
  if (Array.isArray(manifest.tiles)) {
    manifest.tiles.forEach((tile) => {
      if (!tile || !tile.name) return;
      tilesByName.set(tile.name, tile);
      const group = categories.get(tile.category) || [];
      group.push(tile.name);
      categories.set(tile.category, group);
    });
  }
  return { tilesByName, categories };
}

function withDerivedData(baseManifest) {
  const manifest = deepClone(baseManifest);
  const { tilesByName, categories } = indexTiles(manifest);
  manifest.tilesByName = tilesByName;
  manifest.categories = categories;
  return manifest;
}

let manifestPromise = null;

export function loadTileManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load tile manifest: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.warn('[tilesetManifest] Using fallback manifest:', error.message || error);
        return deepClone(FALLBACK_MANIFEST);
      })
      .then((raw) => withDerivedData(raw));
  }
  return manifestPromise;
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

export const TILE_BASE_PATHS = (() => {
  const roots = [
    'assets/tiles/',
    'public/assets/tiles/',
    './assets/tiles/',
    './public/assets/tiles/'
  ];
  const expanded = [];
  roots.forEach((root) => {
    TILE_DIRECTORIES.forEach((dir) => {
      expanded.push(`${root}${dir}/`);
    });
  });
  expanded.push('assets/tiles/');
  expanded.push('public/assets/tiles/');
  expanded.push('./assets/tiles/');
  expanded.push('./public/assets/tiles/');
  return expanded;
})();

export const TILE_DIRECTORIES_SET = new Set(TILE_DIRECTORIES);
export const FALLBACK_TILE_MANIFEST = withDerivedData(FALLBACK_MANIFEST);
export const TILE_MANIFEST_URL = MANIFEST_URL;
