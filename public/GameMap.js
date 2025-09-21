export const LORD_BRITISH_SPRITE_SHEET = 'assets/sprites/Soldier-01-2-1758429653885-76805eae.png';
export const LORD_BRITISH_SPRITE_FRAME = 'player_south_1';

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
  },
  // Lord British's Castle themed tiles
  castle_wall: {
    name: 'Castle Wall',
    description: 'Sturdy stone walls of Lord British\'s magnificent castle.',
    color: '#4a4a52',
    passable: false,
    encounterChance: 0
  },
  castle_floor: {
    name: 'Castle Floor',
    description: 'Polished stone floors worn smooth by countless visitors.',
    color: '#6b6b73',
    passable: true,
    encounterChance: 0
  },
  red_carpet: {
    name: 'Royal Carpet',
    description: 'A rich red carpet leading to the throne.',
    color: '#8b1538',
    passable: true,
    encounterChance: 0
  },
  throne: {
    name: 'Lord British\'s Throne',
    description: 'The magnificent throne of the ruler of Britannia.',
    color: '#d4af37',
    passable: false,
    encounterChance: 0
  },
  banner: {
    name: 'Royal Banner',
    description: 'Heraldic banners displaying the royal arms.',
    color: '#1e40af',
    passable: false,
    encounterChance: 0
  },
  torch_wall: {
    name: 'Wall Torch',
    description: 'A flickering torch mounted on the castle wall.',
    color: '#ff6b35',
    passable: false,
    encounterChance: 0
  },
  castle_door: {
    name: 'Castle Door',
    description: 'Heavy wooden doors reinforced with iron.',
    color: '#654321',
    passable: true,
    encounterChance: 0
  },
  castle_window: {
    name: 'Castle Window',
    description: 'Tall windows letting in natural light.',
    color: '#87ceeb',
    passable: false,
    encounterChance: 0
  },
  fountain: {
    name: 'Castle Fountain',
    description: 'A decorative fountain in the courtyard.',
    color: '#4682b4',
    passable: false,
    encounterChance: 0
  },
  garden: {
    name: 'Castle Gardens',
    description: 'Well-tended gardens with fragrant flowers.',
    color: '#228b22',
    passable: true,
    encounterChance: 0
  },
  courtyard: {
    name: 'Castle Courtyard',
    description: 'The main courtyard paved with smooth stones.',
    color: '#778899',
    passable: true,
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

// Lord British's Castle Layout - Throne room centered with courtyards
const CASTLE_LAYOUT = [
  'WWWWWWWWWDWWWWWWWWWW',
  'WGGGGGGGGGGGGGGGGGW',
  'WGFFFGGGGGGGGGFFFGW',
  'WGFGFGGGGGGGGGFGFGW',
  'WGGGGGGGGGGGGGGGGGW',
  'WGGGGGGWWDWWGGGGGGW',
  'WGGGGGGWCCCWGGGGGGW',
  'WGGGGGGWCRCWGGGGGGW',
  'WGGGGGGWCRCWGGGGGGW',
  'WGGGGGGWCRCWGGGGGGW',
  'DCCCCCCCCRTCCCCCCCCD',
  'WGGGGGGWCRCWGGGGGGW',
  'WGGGGGGWCRCWGGGGGGW',
  'WGGGGGGWCRCWGGGGGGW',
  'WGGGGGGWCCCWGGGGGGW',
  'WGGGGGGWWDWWGGGGGGW',
  'WGGGGGGGGGGGGGGGGGW',
  'WGFGFGGGGGGGGGFGFGW',
  'WGFFFGGGSGGGGGFFFGW',
  'WGGGGGGGGGGGGGGGGGW',
  'WWWWWWWWWDWWWWWWWWWW'
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

// Lord British's Castle character mapping
const CASTLE_CHAR_MAP = {
  W: { tile: 'castle_wall' },     // Castle walls
  C: { tile: 'castle_floor' },    // Castle floor
  R: { tile: 'red_carpet' },      // Red carpet leading to throne
  T: { tile: 'throne' },          // Lord British's throne
  D: { tile: 'castle_door' },     // Castle doors
  G: { tile: 'garden' },          // Castle gardens/courtyard
  F: { tile: 'fountain' },        // Decorative fountains
  S: { tile: 'castle_floor', spawn: 'entrance' }  // Spawn point (entrance)
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
  constructor({ id, name, layout, charMap, areaLevel = 1, encounterRate = 0.1, safe = false, npcs = [] }) {
    this.id = id;
    this.name = name;
    this.safe = safe;
    this.areaLevel = areaLevel;
    this.encounterRate = encounterRate;
    this.discovered = safe;
    this.npcs = npcs;
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
  const castle = new GameMap({
    id: 'castle',
    name: 'Lord British\'s Castle',
    layout: CASTLE_LAYOUT,
    charMap: CASTLE_CHAR_MAP,
    areaLevel: 1,
    encounterRate: 0,
    safe: true,
    npcs: [
      {
        id: 'lord_british',
        name: 'Lord British',
        x: 10,
        y: 10,
        sprite: 'npc',
        spriteSheet: LORD_BRITISH_SPRITE_SHEET,
        spriteFrame: LORD_BRITISH_SPRITE_FRAME,
        color: '#d4af37',
        dialogue: 'Welcome to my castle, brave adventurer! I am Lord British, ruler of Britannia.'
      },
      {
        id: 'royal_guard_1',
        name: 'Royal Guard',
        x: 8,
        y: 10,
        sprite: 'npc',
        color: '#4169e1',
        dialogue: 'I serve to protect Lord British and his castle.'
      },
      {
        id: 'royal_guard_2',
        name: 'Royal Guard',
        x: 12,
        y: 10,
        sprite: 'npc',
        color: '#4169e1',
        dialogue: 'Stay vigilant, citizen. The realm must be protected.'
      },
      {
        id: 'castle_servant',
        name: 'Castle Servant',
        x: 6,
        y: 8,
        sprite: 'npc',
        color: '#8b4513',
        dialogue: 'The castle is magnificent, is it not? Lord British rules with wisdom and justice.'
      }
    ]
  });
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
      castle,
      forest,
      cave
    },
    startingMap: castle
  };
}

export const TileInfo = TILE_DEFINITIONS;
