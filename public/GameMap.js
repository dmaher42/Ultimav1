// Feature: Game World Data & Map Definitions

// --- SPRITE ASSETS ---
export const AVATAR_SPRITE = 'assets/sprites/avatar.png';
export const LORD_BRITISH_SPRITE_SHEET = 'assets/sprites/lord_british.png';
export const LORD_BRITISH_SPRITE_FRAME = 'player_south_1';

// --- TILE DEFINITIONS ---
export const TileInfo = {
  grass: {
    name: 'Meadow',
    description: 'Soft grass sways in the Britannian breeze.',
    color: '#3b7f3a',
    passable: true,
    encounterChance: 0.05
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
  courtyard: {
    name: 'Courtyard',
    description: 'Cobblestones paving the way to the keep.',
    color: '#555555',
    passable: true,
    encounterChance: 0
  },
  castle_floor: {
    name: 'Castle Floor',
    description: 'Polished stone floors of Castle Britannia.',
    color: '#555555',
    passable: true,
    encounterChance: 0
  },
  castle_wall: {
    name: 'Wall',
    description: 'Impenetrable stone walls.',
    color: '#333333',
    passable: false,
    encounterChance: 0
  },
  red_carpet: {
    name: 'Royal Carpet',
    description: 'Plush velvet leading to the throne.',
    color: '#8b0000',
    passable: true,
    encounterChance: 0
  },
  cave_entrance: {
    name: 'Cave Entrance',
    description: 'A yawning darkness descends beneath the earth.',
    color: '#4b3b32',
    passable: true,
    encounterChance: 0.05
  },
  cave_exit: {
    name: 'Cave Exit',
    description: 'Light spills in from the surface world.',
    color: '#4b3b32',
    passable: true,
    encounterChance: 0
  }
};

// --- WORLD FACTORY ---
export function createWorld() {
  // CASTLE MAP
  const castle = new GameMap({
    id: 'castle',
    name: 'Castle Britannia',
    width: 20,
    height: 15,
    safe: true,
    // ASCII Layout
    // #=Wall, .=Floor, R=Carpet, T=ThroneArea(Floor), P=Pillar(Floor)
    layout: [
      '####################',
      '#..................#',
      '#..PP..........PP..#',
      '#..................#',
      '#..PP..........PP..#',
      '#.......RRRR.......#',
      '#.......RRRR.......#',
      '#.......RRRR.......#',
      '#.......RRRR.......#',
      '#..PP...RRRR...PP..#',
      '#.......RRRR.......#',
      '#.......RRRR.......#',
      '#.......RRRR.......#',
      '####################'
    ],
    legend: {
      '#': 'castle_wall',
      '.': 'castle_floor',
      'R': 'red_carpet',
      'P': 'castle_floor'
    },
    objects: [
      // Pillars
      { x: 3, y: 2, sprite: 'pillar', height: 2 },
      { x: 16, y: 2, sprite: 'pillar', height: 2 },
      { x: 3, y: 4, sprite: 'pillar', height: 2 },
      { x: 16, y: 4, sprite: 'pillar', height: 2 },
      { x: 3, y: 9, sprite: 'pillar', height: 2 },
      { x: 16, y: 9, sprite: 'pillar', height: 2 },
      // Throne
      { x: 9, y: 2, sprite: 'throne', width: 2, height: 2 },
      // Torches
      { x: 1, y: 5, sprite: 'torch_wall' },
      { x: 18, y: 5, sprite: 'torch_wall' },
      // Banner
      { x: 8, y: 1, sprite: 'banner' },
      { x: 11, y: 1, sprite: 'banner' }
    ],
    npcs: [
      {
        id: 'lord_british',
        name: 'Lord British',
        x: 9,
        y: 3,
        spriteSheet: 'assets/sprites/lord_british.png',
        spriteFrame: 'player_south_1',
        color: '#ffdd00',
        dialogue: 'Welcome, Avatar! Use the arrow keys to explore, and press T to speak with my subjects.'
      },
      {
        id: 'guard_captain',
        name: 'Captain of the Guard',
        x: 9,
        y: 8,
        spriteSheet: 'assets/sprites/guard_captain.png',
        spriteFrame: 'player_south_1',
        color: '#aaaaaa',
        dialogue: 'Stand tall, citizen. The roads outside are dangerous at night.'
      },
      {
        id: 'noble_lady',
        name: 'Lady Alowen',
        x: 14,
        y: 6,
        spriteSheet: 'assets/sprites/noble_woman.png',
        spriteFrame: 'player_west_1',
        color: '#ffccdd',
        dialogue: 'Have you seen the fountains in the courtyard? They are quite lovely this time of year.'
      }
    ],
    transitions: [
      { x: 9, y: 13, map: 'village', spawn: 'castle_gate' },
      { x: 10, y: 13, map: 'village', spawn: 'castle_gate' }
    ]
  });

  // VILLAGE MAP
  const village = new GameMap({
    id: 'village',
    name: 'Britanny Bay',
    width: 30,
    height: 30,
    safe: true,
    defaultTile: 'grass',
    // ASCII Layout for Village
    layout: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T............................T',
      'T..GGG..................GGG..T',
      'T..GGG..................GGG..T',
      'T...........PPP..............T',
      'T...........PPP..............T',
      'T...........PPP..............T',
      'T............................T',
      'T............................T',
      'T......WWW..........WWW......T',
      'T......W.W..........W.W......T',
      'T......WWW..........WWW......T',
      'T............................T',
      'T............................T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    legend: {
      'T': 'trees',
      '.': 'grass',
      'P': 'path',
      'G': 'garden',
      'W': 'water'
    },
    objects: [
      { x: 15, y: 15, sprite: 'fountain', width: 2, height: 2 }
    ],
    npcs: [
      {
        id: 'villager_1',
        name: 'Townsperson',
        x: 12,
        y: 16,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#cc9966',
        dialogue: 'Good day! I heard Lord British is looking for a hero.'
      },
      {
        id: 'guard_sentry',
        name: 'Gate Guard',
        x: 15,
        y: 5,
        spriteSheet: 'assets/sprites/guard_soldier.png',
        dialogue: 'Halt! Only those with business may enter the castle.'
      }
    ],
    transitions: [
      { x: 15, y: 4, map: 'castle', spawn: 'castle_entry' }
    ],
    spawnPoints: {
      'castle_gate': { x: 15, y: 6 }
    }
  });

  // FOREST MAP (Procedural-ish)
  const forest = new GameMap({
    id: 'forest',
    name: 'Deep Forest',
    width: 40,
    height: 40,
    safe: false,
    defaultTile: 'grass',
    encounterRate: 0.15
  });

  // Fill forest edges with trees
  for(let x=0; x<40; x++) {
      forest.setTile(x, 0, 'trees');
      forest.setTile(x, 39, 'trees');
  }
  for(let y=0; y<40; y++) {
      forest.setTile(0, y, 'trees');
      forest.setTile(39, y, 'trees');
  }

  const maps = { castle, village, forest };
  return {
    maps,
    startingMap: maps.castle
  };
}

export class GameMap {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.width = data.width || 20;
    this.height = data.height || 15;
    this.tiles = [];
    this.safe = data.safe || false;
    this.encounterRate = data.encounterRate || 0;
    this.objects = data.objects || [];
    this.npcs = data.npcs || [];
    this.transitions = data.transitions || [];
    this.spawnPoints = data.spawnPoints || {};

    // Initialize grid
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(data.defaultTile || 'grass');
      }
      this.tiles.push(row);
    }

    // Apply Layout if provided
    if (data.layout && data.legend) {
      this.applyLayout(data.layout, data.legend);
    }
  }

  applyLayout(layoutStrings, legend) {
    layoutStrings.forEach((rowStr, y) => {
      if (y >= this.height) return;
      for (let x = 0; x < this.width && x < rowStr.length; x++) {
        const char = rowStr[x];
        if (legend[char]) {
          this.tiles[y][x] = legend[char];
        }
      }
    });
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  setTile(x, y, type) {
    if (this.inBounds(x, y)) {
      this.tiles[y][x] = type;
    }
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return false;

    // Check Terrain Passability
    const info = TileInfo[tile];
    if (info && !info.passable) return false;

    // Check Objects (Collision)
    const obj = this.objects.find(o => {
        // Handle objects larger than 1x1
        const w = o.width || 1;
        const h = o.height || 1;
        return x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
    });
    if (obj && !obj.passable) return false;

    return true;
  }

  getTransition(x, y) {
    return this.transitions.find(t => t.x === x && t.y === y);
  }

  getEncounterChance(x, y) {
    const tile = this.getTile(x, y);
    const info = TileInfo[tile];
    // Base rate + Tile modifier
    return this.encounterRate + (info ? (info.encounterChance || 0) : 0);
  }

  describeTile(x, y) {
      const tile = this.getTile(x, y);
      const info = TileInfo[tile];
      return info ? info.description : 'Unknown terrain.';
  }
}
