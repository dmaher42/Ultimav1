// Feature: Game World Data (Multi-Room Expansion)

export const AVATAR_SPRITE = 'assets/sprites/avatar.png';
export const LORD_BRITISH_SPRITE_SHEET = 'assets/sprites/lord_british.png';

export const TileInfo = {
  grass: { name: 'Meadow', color: '#3b7f3a', passable: true, encounterChance: 0.05 },
  trees: { name: 'Woodland', color: '#1f3d1b', passable: false },
  water: { name: 'Stream', color: '#264c7d', passable: false },
  path: { name: 'Path', color: '#9f884f', passable: true },
  castle_floor: { name: 'Castle Floor', color: '#555555', passable: true },
  castle_wall: { name: 'Wall', color: '#333333', passable: false },
  red_carpet: { name: 'Royal Carpet', color: '#8b0000', passable: true },
  courtyard: { name: 'Courtyard', color: '#666', passable: true },
  dungeon_floor: { name: 'Dungeon Floor', color: '#444', passable: true, encounterChance: 0.2 },
  dungeon_wall: { name: 'Dungeon Wall', color: '#222', passable: false },
  cave_entrance: { name: 'Cave Mouth', color: '#000', passable: true }
};

export function createWorld() {
  // 1. MAIN CASTLE HALL
  const castle = new GameMap({
    id: 'castle',
    name: 'Castle Britannia',
    width: 20, height: 15, safe: true,
    layout: [
      '####################',
      '#..................#',
      'D..PP..........PP..#', // D = Door to Bedroom (West)
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
    legend: { '#': 'castle_wall', '.': 'castle_floor', 'R': 'red_carpet', 'P': 'castle_floor', 'D': 'castle_door' },
    objects: [
      { x: 3, y: 2, sprite: 'pillar', height: 2 }, { x: 16, y: 2, sprite: 'pillar', height: 2 },
      { x: 3, y: 9, sprite: 'pillar', height: 2 }, { x: 16, y: 9, sprite: 'pillar', height: 2 },
      { x: 9, y: 2, sprite: 'throne', width: 2, height: 2 },
      { x: 1, y: 5, sprite: 'torch_wall' }, { x: 18, y: 5, sprite: 'torch_wall' },
      { x: 15, y: 4, type: 'item', sprite: 'potion', color: '#ff4444', data: { id: 'potion_h1', name: 'Health Elixir', type: 'consumable', effect: {type:'heal', amount:50}, weight: 0.5 } }
    ],
    npcs: [
      {
        id: 'lord_british', name: 'Lord British', x: 9, y: 3,
        spriteSheet: LORD_BRITISH_SPRITE_SHEET, spriteFrame: 'player_south_1',
        color: '#ffdd00',
        behavior: 'static',
        dialogue: 'Welcome! My quarters are to the West. The village lies to the South.'
      }
    ],
    transitions: [
      { x: 9, y: 13, map: 'village', spawn: 'castle_gate' },
      { x: 10, y: 13, map: 'village', spawn: 'castle_gate' },
      { x: 0, y: 2, map: 'castle_bedroom', spawn: 'bedroom_door' } // Door West
    ],
    spawnPoints: { 'castle_gate': { x: 9, y: 12 }, 'bedroom_door': { x: 1, y: 2 } }
  });

  // 2. CASTLE BEDROOM (New Area)
  const castle_bedroom = new GameMap({
    id: 'castle_bedroom',
    name: 'Royal Quarters',
    width: 12, height: 10, safe: true,
    defaultTile: 'castle_floor',
    layout: [
      '############',
      '#..........#',
      '#..BB......#', // Bed
      '#..........#',
      '#.......S..#', // Bookshelf
      '#..........D', // Door (Exit East)
      '#..........#',
      '############',
      '############',
      '############'
    ],
    legend: { '#': 'castle_wall', '.': 'castle_floor', 'D': 'castle_door', 'B': 'castle_floor', 'S': 'castle_floor' },
    objects: [
      { x: 3, y: 2, sprite: 'royal_bed', width: 2, height: 2 },
      { x: 8, y: 4, sprite: 'bookshelf' },
      { x: 2, y: 2, type: 'item', sprite: 'chest', color: '#d4af37', data: { id: 'gold_pouch', name: 'Royal Treasury', type: 'misc', value: 200, weight: 5 } }
    ],
    transitions: [
      { x: 11, y: 5, map: 'castle', spawn: 'bedroom_door' }
    ],
    spawnPoints: { 'bedroom_door': { x: 10, y: 5 } }
  });

  // 3. VILLAGE (Hub)
  const village = new GameMap({
    id: 'village', name: 'Britanny Bay', width: 30, height: 30, safe: true, defaultTile: 'grass',
    layout: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T............................T',
      'T..GGG..................GGG..T',
      'T..GGG..................GGG..T',
      'T...........PPP..............T',
      'T...........PPP..............T',
      'T...........PPP..............T',
      'T...........PPP..............T',
      'T.......................C....T', // C = Cave Entrance
      'T......WWW..........WWW......T',
      'T......W.W..........W.W......T',
      'T......WWW..........WWW......T',
      'T............................T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    legend: { 'T': 'trees', '.': 'grass', 'P': 'path', 'G': 'garden', 'W': 'water', 'C': 'cave_entrance' },
    objects: [
      { x: 15, y: 15, sprite: 'fountain', width: 2, height: 2 }
    ],
    npcs: [
      {
        id: 'villager_1', name: 'Wandering Merchant', x: 12, y: 16,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#c96',
        behavior: 'wander',
        dialogue: 'Beware the cave to the East! I hear strange noises from within.'
      }
    ],
    transitions: [
      { x: 15, y: 4, map: 'castle', spawn: 'castle_gate' },
      { x: 24, y: 8, map: 'dungeon_1', spawn: 'entry' } // Cave Entrance
    ],
    spawnPoints: { 'castle_gate': { x: 15, y: 6 }, 'dungeon_exit': { x: 23, y: 8 } }
  });

  // 4. DUNGEON LEVEL 1 (Combat Area)
  const dungeon_1 = new GameMap({
    id: 'dungeon_1', name: 'Dark Caverns', width: 20, height: 20, safe: false, areaLevel: 1, encounterRate: 0.15,
    defaultTile: 'dungeon_floor',
    layout: [
      '####################',
      '#..................#',
      '#..####......####..#',
      '#..#...........#...#',
      '#..#...........#...#',
      '#..####......####..#',
      '#..................#',
      '#.......E..........#', // E = Exit
      '#..................#',
      '####################'
    ],
    legend: { '#': 'dungeon_wall', '.': 'dungeon_floor', 'E': 'cave_exit' },
    objects: [
      { x: 10, y: 10, sprite: 'torch_wall' },
      { x: 2, y: 2, sprite: 'armory_rack' }
    ],
    transitions: [
      { x: 8, y: 7, map: 'village', spawn: 'dungeon_exit' }
    ],
    spawnPoints: { 'entry': { x: 8, y: 6 } }
  });

  return { maps: { castle, castle_bedroom, village, dungeon_1 }, startingMap: castle };
}

export class GameMap {
  constructor(data) {
    Object.assign(this, data);
    this.tiles = [];
    for (let y = 0; y < this.height; y++) {
      this.tiles.push(new Array(this.width).fill(data.defaultTile || 'grass'));
    }
    if (data.layout && data.legend) this.applyLayout(data.layout, data.legend);
  }

  applyLayout(layout, legend) {
    layout.forEach((row, y) => {
      if (y >= this.height) return;
      for (let x = 0; x < this.width && x < row.length; x++) {
        if (legend[row[x]]) this.tiles[y][x] = legend[row[x]];
      }
    });
  }

  getTile(x, y) { return this.inBounds(x, y) ? this.tiles[y][x] : null; }
  inBounds(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }

  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    if (!TileInfo[tile]?.passable) return false;
    const obj = this.objects.find(o => o.x === x && o.y === y);
    if (obj) {
        if (obj.type === 'item') return true;
        if (obj.passable) return true;
        return false;
    }
    return true;
  }

  getTransition(x, y) { return this.transitions.find(t => t.x === x && t.y === y); }
  getEncounterChance(x, y) { return (this.encounterRate || 0) + (TileInfo[this.getTile(x,y)]?.encounterChance || 0); }
  describeTile(x, y) { return TileInfo[this.getTile(x,y)]?.description || 'Unknown'; }

  getSpawn(tag) {
      if (this.spawnPoints && this.spawnPoints[tag]) return this.spawnPoints[tag];
      return { x: 1, y: 1 }; // Fallback
  }
}