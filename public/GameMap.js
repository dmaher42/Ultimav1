// Feature: Village area + transitions (Castle↔Village↔Forest)
export const LORD_BRITISH_SPRITE_SHEET = 'assets/sprites/Boss-01-1758429611593-0937cfdf.png';
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
  },
  pillar: {
    name: 'Marble Pillar',
    description: 'A towering marble pillar supporting the grand hall.',
    color: '#cbb8a9',
    passable: false,
    encounterChance: 0
  },
  bookshelf: {
    name: 'Library Shelf',
    description: 'Shelves of Britannian tomes and dusty histories.',
    color: '#8b5a2b',
    passable: false,
    encounterChance: 0
  },
  barracks_bed: {
    name: 'Barracks Bunk',
    description: 'A neatly made bunk reserved for Lord British\'s guards.',
    color: '#5f6a7d',
    passable: false,
    encounterChance: 0
  },
  kitchen_table: {
    name: 'Kitchen Table',
    description: 'Sturdy tables laden with ingredients for the royal feast.',
    color: '#c68642',
    passable: false,
    encounterChance: 0
  },
  study_desk: {
    name: 'Royal Desk',
    description: 'Charts, ledgers, and quills of the royal study.',
    color: '#b8860b',
    passable: false,
    encounterChance: 0
  },
  kitchen_hearth: {
    name: 'Kitchen Hearth',
    description: 'Broad stone hearths that warm the royal kitchens day and night.',
    color: '#b7410e',
    passable: false,
    encounterChance: 0
  },
  dining_table: {
    name: 'Banquet Table',
    description: 'Long tables prepared for state feasts and visiting dignitaries.',
    color: '#a9743a',
    passable: false,
    encounterChance: 0
  },
  armory_rack: {
    name: 'Armory Rack',
    description: 'Racks of polished steel awaiting the castle guard.',
    color: '#6f584b',
    passable: false,
    encounterChance: 0
  },
  training_dummy: {
    name: 'Training Dummy',
    description: 'Practice dummies for honing swordplay.',
    color: '#c68642',
    passable: true,
    encounterChance: 0
  },
  stable_hay: {
    name: 'Stable Hay',
    description: 'Fresh hay stacked for the royal stables.',
    color: '#d2b48c',
    passable: true,
    encounterChance: 0
  },
  royal_bed: {
    name: 'Royal Bed',
    description: 'Lavish bedding reserved for the sovereign and honored guests.',
    color: '#b56576',
    passable: false,
    encounterChance: 0
  },
  wash_basin: {
    name: 'Wash Basin',
    description: 'Basins of scented water to refresh weary travelers.',
    color: '#87cefa',
    passable: false,
    encounterChance: 0
  },
  chapel_altar: {
    name: 'Chapel Altar',
    description: 'A sacred altar dedicated to the Eight Virtues.',
    color: '#f0ead6',
    passable: false,
    encounterChance: 0
  }
};

const VILLAGE_LAYOUT = [
  'TTTTTTTTTTTTTTTTTTTT',
  'TGGGGGGGGPCGGGGGGGGT',
  'TGGGGGGGGPAGGGGGGGGT',
  'TGGGGGGGGPPGGGGGGGGT',
  'TGGGGGGGGPPGGGGGGGGT',
  'TGGGGGPPPPPPPPGGGGGT',
  'TGGGGGPPPPPPPPGGGGGT',
  'TPPPPPPPPPWPPPPPPPPT',
  'TPPPPPPPPPPPPPPBPFPT',
  'TGGGGGPPNPPPPPGGGGGT',
  'TGPPPPPPPPPPPPPPPPGT',
  'TGGHHHGGGPPGGGHHHGGT',
  'TGGHHHGGGPPGGGHHHGGT',
  'TGGHHHGGGPPGGGHHHGGT',
  'TGGGGGGGGPPGGGGGGGGT',
  'TTTTTTTTTTTTTTTTTTTT'
];

const FOREST_LAYOUT = [
  'TTTTTTTTTTTTTTTTTTTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGWWGGGGGGGGGGGGGTT',
  'TGGWWGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGGGGGGGGGGGGGTT',
  'TGGGGGSSVGGGGGGGGGTT',
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

// Lord British's Castle Layout - Expanded halls, wings, and courtyards
const CASTLE_LAYOUT = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWGGGGGW',
  'WGGGGGWLLLCLLLLCOOOOOUUUUUUEEEEEECCCCCCCCWGGGGGW',
  'WGGGGGWLLLCLLLLCOOOOOUOUUUOKKKKKKCCCCCCBCWGGGGGW',
  'WGGGGGWLLLCLLLLCOOOOOUOUUUOKKKKKKCCCCCCBCWGGGGGW',
  'WGGGGGWLLLCLLLLCOOOOOUUUUUUKKKKKKCCCCCCBCWGGGGGW',
  'WGGGGGWLLLCLLLLCOOOOOCCRTRCKKKKKKCCCCCCBCWGGGGGW',
  'WGGGGGWLLLCLLLLCQQQQQCCRRRMMMMMMCMMMMMMMBCWGGGGGW',
  'WGGGGGWLLLCLLLLCQQQQQCCRRRMMMMMMCMMMMMMMBCWGGGGGW',
  'WGGGGGWLLLCLLLLCQQQQQCRRRRMAAAXDCDDAAAABCWGGGGGW',
  'WGGGGGWLLLCLLLLCQQQQQCRRRRMAAAAACAAAAAABCWGGGGGW',
  'WGGGGGWBBBDDDDBBBYDDYCRRRRMAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRRRRMAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRXXXXAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRXXXXAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRRRRCAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRRRRCAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRRRRCAAAAACAAAAAACCWGGGGGW',
  'WGGGGGWBBBBBBBBBBYYYYCRRRRCAAAAACAAAAAACCWGGGGGW',
  'WGGGYYWCCCCCCCCCCCCCCCCCSCCCCCCCCCCCCCCCCWJJGGGW',
  'WGGGYYWCCCCCCCCCCCCCCCCHHHCCCCCCCCCCCCCCCWJJGGGW',
  'WGGGYYWWWWWWWWWWWWWWWWHHHHHWWWWWWWWWWWWWWWJJGGGW',
  'WGGGYYYYYYYYHHHHHHHHHHHHHHHHHHHHHHHHJJJJJJJJGGGW',
  'WGGGYYYYYYYYFHHHHHHHHHHHHHHHHHHHHHHHJJJJJJJJGGGW',
  'WGGGYYYYYYYYHHHHHHHHHHHHHHHHHHHHHHHHJJJJJJJJGGGW',
  'WGGGGGHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHGGGGGW',
  'WGGGGGHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGGHHHGGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGHHHHHGGGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGGGGGHVHGGGGGGGGGGGGGGGGGGGGGW',
  'WWWWWWWWWWWWWWWWWWWWWWWDDDWWWWWWWWWWWWWWWWWWWWWW'
];

const FOREST_CHAR_MAP = {
  G: { tile: 'grass' },
  S: { tile: 'grass', spawn: ['village', 'forest_path'] },
  T: { tile: 'trees' },
  W: { tile: 'water' },
  V: { tile: 'grass', transition: { map: 'village', spawn: 'forest_path' } },
  E: { tile: 'cave_entrance', transition: { map: 'cave', spawn: 'mouth' }, spawn: 'mouth' }
};

const VILLAGE_CHAR_MAP = {
  T: { tile: 'trees' },
  G: { tile: 'grass' },
  P: { tile: 'path' },
  C: { tile: 'path', transition: { map: 'castle', spawn: 'castle_gate' } },
  A: { tile: 'path', spawn: 'castle_gate' },
  F: { tile: 'path', transition: { map: 'forest', spawn: 'forest_path' } },
  B: { tile: 'path', spawn: 'forest_path' },
  W: { tile: 'fountain' },
  H: { tile: 'castle_wall' },
  N: { tile: 'path' }
};

const CAVE_CHAR_MAP = {
  '#': { tile: 'wall' },
  '.': { tile: 'cave_floor' },
  E: { tile: 'cave_exit', transition: { map: 'forest', spawn: 'mouth' }, spawn: 'mouth' }
};

// Lord British's Castle character mapping
const CASTLE_CHAR_MAP = {
  W: { tile: 'castle_wall' },       // Castle walls
  C: { tile: 'castle_floor' },      // Castle floor
  R: { tile: 'red_carpet' },        // Red carpet leading to throne
  T: { tile: 'throne' },            // Lord British's throne
  D: { tile: 'castle_door' },       // Castle doors
  G: { tile: 'garden' },            // Castle gardens/courtyard
  F: { tile: 'fountain' },          // Decorative fountains
  P: { tile: 'pillar' },            // Marble pillars in the great hall
  L: { tile: 'bookshelf' },         // Library shelves
  B: { tile: 'barracks_bed' },      // Guard barracks bunks
  K: { tile: 'kitchen_table' },     // Castle kitchen tables
  U: { tile: 'kitchen_hearth' },    // Hearths in the bustling kitchens
  E: { tile: 'wash_basin' },        // Wash basins for servants and soldiers alike
  Q: { tile: 'dining_table' },      // Banquet hall tables
  O: { tile: 'study_desk' },        // Royal study desks
  M: { tile: 'armory_rack' },       // Armory storage racks
  X: { tile: 'training_dummy' },    // Training ground dummies
  Y: { tile: 'royal_bed' },         // Royal sleeping quarters
  J: { tile: 'stable_hay' },        // Hay piles in the stables
  H: { tile: 'courtyard' },         // Stone courtyard paths
  A: { tile: 'chapel_altar' },      // Chapel altar
  S: { tile: 'castle_floor', spawn: ['entrance', 'village', 'castle_gate'] },  // Spawn points (entrance & exterior)
  V: { tile: 'garden', transition: { map: 'village', spawn: 'castle_gate' } }  // Transition to the village hub
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
      if (Array.isArray(mapping.spawn)) {
        mapping.spawn.forEach((tag) => {
          if (tag) {
            spawns[tag] = { x, y };
          }
        });
      } else if (mapping.spawn) {
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
        x: 24,
        y: 12,
        sprite: 'npc',
        spriteSheet: LORD_BRITISH_SPRITE_SHEET,
        spriteFrame: LORD_BRITISH_SPRITE_FRAME,
        color: '#d4af37',
        dialogue: 'The keep has never been busier—wander the new wings and speak with my household.'
      },
      {
        id: 'royal_guard_captain',
        name: 'Royal Guard Captain',
        x: 22,
        y: 15,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Soldier-07-4-1758429632107-f51524ce.png',
        spriteFrame: 'player_south_1',
        color: '#2b4c7e',
        dialogue: 'The garrison drills day and night to keep the throne secure.'
      },
      {
        id: 'hall_guard_west',
        name: 'Royal Guard',
        x: 21,
        y: 21,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Soldier-05-4-1758429645243-83d4c8c6.png',
        spriteFrame: 'player_south_1',
        color: '#3a5fcd',
        dialogue: 'These chambers belong to the royal family; we stand ready at every door.'
      },
      {
        id: 'hall_guard_east',
        name: 'Royal Guard',
        x: 26,
        y: 21,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Soldier-03-2-1758429649266-4ec7b80c.png',
        spriteFrame: 'player_south_1',
        color: '#3b4f9f',
        dialogue: 'The chapel and training yards remain under constant watch.'
      },
      {
        id: 'royal_steward',
        name: 'Royal Steward',
        x: 21,
        y: 14,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-24-1-1758429708321-a5ae6e2b.png',
        spriteFrame: 'player_south_1',
        color: '#c29f4b',
        dialogue: 'Banquets are scheduled nightly; every hall must gleam for visiting dignitaries.'
      },
      {
        id: 'head_librarian',
        name: 'Head Librarian',
        x: 10,
        y: 12,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-25-1-1758428250234-e8e79abb.png',
        spriteFrame: 'player_south_1',
        color: '#4b0082',
        dialogue: 'Centuries of Britannian lore rest upon these shelves—handle every tome with reverence.'
      },
      {
        id: 'court_scholar',
        name: 'Court Scholar',
        x: 15,
        y: 9,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Male-17-3-1758428284774-d1ea43dc.png',
        spriteFrame: 'player_south_1',
        color: '#9370db',
        dialogue: 'Charts of the realm and star maps cover every desk; Lord British expects precise counsel.'
      },
      {
        id: 'royal_chef',
        name: 'Royal Chef',
        x: 26,
        y: 11,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-22-4-1758429697306-192e02a2.png',
        spriteFrame: 'player_south_1',
        color: '#d2691e',
        dialogue: 'The furnaces stay hot so that no guest ever waits for a feast.'
      },
      {
        id: 'armory_master',
        name: 'Armory Master',
        x: 32,
        y: 13,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Soldier-06-4-1758429640375-9ed01da2.png',
        spriteFrame: 'player_south_1',
        color: '#6b6b73',
        dialogue: 'Every rack is polished and every blade accounted for before the sun sets.'
      },
      {
        id: 'drill_instructor',
        name: 'Drill Instructor',
        x: 24,
        y: 18,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Soldier-07-3-1758429635635-21197350.png',
        spriteFrame: 'player_south_1',
        color: '#b22222',
        dialogue: 'Strike the dummies with purpose—discipline wins battles before steel is drawn.'
      },
      {
        id: 'royal_chaplain',
        name: 'Royal Chaplain',
        x: 32,
        y: 20,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-06-1-1758429682755-cde250c8.png',
        spriteFrame: 'player_south_1',
        color: '#f0e68c',
        dialogue: 'May the Eight Virtues guide your path; the chapel is open to all who seek peace.'
      },
      {
        id: 'stable_master',
        name: 'Stable Master',
        x: 40,
        y: 27,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Male-11-1-1758429180284-34dd97f7.png',
        spriteFrame: 'player_south_1',
        color: '#8b4513',
        dialogue: 'Fresh hay and oiled tack keep the royal steeds ready for a midnight ride.'
      },
      {
        id: 'groundskeeper',
        name: 'Groundskeeper',
        x: 18,
        y: 30,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-20-4-1758429686210-8e1c4b7b.png',
        spriteFrame: 'player_south_1',
        color: '#2e8b57',
        dialogue: 'These courtyards are swept and trimmed so the kingdom sees only brilliance.'
      },
      {
        id: 'lady_in_waiting',
        name: 'Lady-in-Waiting',
        x: 22,
        y: 19,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-15-3-1758429690018-be2acd33.png',
        spriteFrame: 'player_south_1',
        color: '#ffb6c1',
        dialogue: 'The royal suites shimmer with silks and song awaiting our liege.'
      },
      {
        id: 'castle_page',
        name: 'Castle Page',
        x: 24,
        y: 25,
        sprite: 'npc',
        spriteSheet: 'assets/sprites/Female-04-2-1758429713667-ed61eda3.png',
        spriteFrame: 'player_south_1',
        color: '#add8e6',
        dialogue: 'Welcome! The throne room lies just ahead—mind the courtiers at work.'
      }
    ]
  });
  const village = new GameMap({
    id: 'village',
    name: 'Britannian Village',
    layout: VILLAGE_LAYOUT,
    charMap: VILLAGE_CHAR_MAP,
    areaLevel: 1,
    encounterRate: 0,
    safe: true,
    npcs: [
      {
        id: 'village_greeter',
        name: 'Village Greeter',
        x: 10,
        y: 6,
        sprite: 'npc',
        color: '#d2b48c',
        dialogue: 'Welcome to our humble village! The castle gates stand just to the north.'
      },
      {
        id: 'market_keeper',
        name: 'Stall Keeper',
        x: 8,
        y: 9,
        sprite: 'npc',
        color: '#9acd32',
        dialogue: 'I am preparing a stall—soon travelers will be able to stock up before their journeys.'
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
      village,
      forest,
      cave
    },
    startingMap: castle
  };
}

export const TileInfo = TILE_DEFINITIONS;
