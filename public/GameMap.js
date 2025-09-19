const TILE_DEFINITIONS = {
  grass: {
    name: 'Meadow',
    description: 'Soft grass sways in the Britannian breeze.',
    color: '#3b7f3a',
    passable: true,
    encounterChance: 0
  },
  trees: {
    name: 'Woodland',
    description: 'A dense wall of oaks and birch trees.',
    color: '#1f3d1b',
    passable: false,
    encounterChance: 0
  },
  water: {
    name: 'Stream',
    description: 'Crystal water flows gently.',
    color: '#264c7d',
    passable: false,
    encounterChance: 0
  },
  path: {
    name: 'Path',
    description: 'A worn path left by many travelers.',
    color: '#9f884f',
    passable: true,
    encounterChance: 0.02
  },
  cave_entrance: {
    name: 'Cave Entrance',
    description: 'A yawning darkness descends beneath the earth.',
    color: '#4b3b32',
    passable: true,
    encounterChance: 0.05
  },
  cave_exit: {
    name: 'Cave Mouth',
    description: 'Light from the forest spills into the cavern.',
    color: '#4b3b32',
    passable: true,
    encounterChance: 0.05
  },
  cave_floor: {
    name: 'Cavern Floor',
    description: 'Cold stone and dripping stalactites.',
    color: '#55535d',
    passable: true,
    encounterChance: 0.2
  },
  wall: {
    name: 'Stone Wall',
    description: 'Ancient stone blocks further travel.',
    color: '#2b2b30',
    passable: false,
    encounterChance: 0
  }
};

const FOREST_LAYOUT = [
  'TTTTTTTTTTTTTTTTTTTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGWWGGGGGGGGGGGGGTT',
  'TGGWWGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGSSGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGEGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TTTTTTTTTTTTTTTTTTTT'
];

const CAVE_LAYOUT = [
  '####################',
  '#....###....###....#',
  '#....###....###....#',
  '#....###....###....#',
  '#..................#',
  '#.######.######.####',
  '#...............####',
  '#.######.######.####',
  '#.................E#',
  '#.######.######.####',
  '#....###....###....#',
  '#....###....###....#',
  '#....###....###....#',
  '#..................#',
  '#.######.######.####',
  '#...............####',
  '#.######.######.####',
  '#..................#',
  '#..................#',
  '####################'
];

const FOREST_CHAR_MAP = {
  G: { tile: 'grass' },
  S: { tile: 'grass', spawn: 'village' },
  T: { tile: 'trees' },
  W: { tile: 'water' },
  E: { tile: 'cave_entrance', transition: { map: 'cave', spawn: 'mouth' }, spawn: 'mouth' }
};

const CAVE_CHAR_MAP = {
  '#': { tile: 'wall' },
  '.': { tile: 'cave_floor' },
  E: { tile: 'cave_exit', transition: { map: 'forest', spawn: 'mouth' }, spawn: 'mouth' }
};

function parseLayout(layout, charMap) {
  const tiles = [];
  const meta = new Map();
  const spawns = {};
  for (let y = 0; y < layout.length; y += 1) {
    const row = layout[y];
    const tileRow = [];
    for (let x = 0; x < row.length; x += 1) {
      const symbol = row[x];
      const mapping = charMap[symbol] || { tile: 'grass' };
      tileRow.push(mapping.tile);
      if (mapping.transition) {
        meta.set(`${x},${y}`, { transition: { ...mapping.transition } });
      }
      if (mapping.spawn) {
        spawns[mapping.spawn] = { x, y };
      }
    }
    tiles.push(tileRow);
  }
  return { tiles, meta, spawns };
}

export class GameMap {
  constructor({ id, name, layout, charMap, areaLevel = 1, encounterRate = 0.1, safe = false }) {
    this.id = id;
    this.name = name;
    this.safe = safe;
    this.areaLevel = areaLevel;
    this.encounterRate = encounterRate;
    this.discovered = safe;
    const parsed = parseLayout(layout, charMap);
    this.tiles = parsed.tiles;
    this.meta = parsed.meta;
    this.spawnPoints = parsed.spawns;
    this.height = this.tiles.length;
    this.width = this.tiles[0]?.length || 0;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  getTileDefinition(tile) {
    return TILE_DEFINITIONS[tile] || TILE_DEFINITIONS.grass;
  }

  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const tile = this.getTile(x, y);
    return this.getTileDefinition(tile).passable;
  }

  getEncounterChance(x, y) {
    const tile = this.getTile(x, y);
    const base = this.getTileDefinition(tile).encounterChance || 0;
    return Math.min(1, Math.max(0, this.encounterRate + base));
  }

  getTransition(x, y) {
    return this.meta.get(`${x},${y}`)?.transition || null;
  }

  describeTile(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) {
      return 'An impassable void.';
    }
    const def = this.getTileDefinition(tile);
    return `${def.name}: ${def.description}`;
  }

  getSpawn(tag) {
    if (tag && this.spawnPoints[tag]) {
      return { ...this.spawnPoints[tag] };
    }
    const first = Object.values(this.spawnPoints)[0];
    if (first) {
      return { ...first };
    }
    return { x: 1, y: 1 };
  }
}

export function createWorld() {
  const forest = new GameMap({
    id: 'forest',
    name: 'Silvan Glade',
    layout: FOREST_LAYOUT,
    charMap: FOREST_CHAR_MAP,
    areaLevel: 1,
    encounterRate: 0,
    safe: true
  });
  const cave = new GameMap({
    id: 'cave',
    name: 'Glimmering Cave',
    layout: CAVE_LAYOUT,
    charMap: CAVE_CHAR_MAP,
    areaLevel: 3,
    encounterRate: 0.18,
    safe: false
  });
  return {
    maps: {
      forest,
      cave
    },
    startingMap: forest
  };
}

export const TileInfo = TILE_DEFINITIONS;
