// Feature: Game World Data (Multi-Room Expansion)
import QuestManager from './QuestManager.js';

export const AVATAR_SPRITE = 'assets/sprites/avatar.png';
export const LORD_BRITISH_SPRITE_SHEET = 'assets/sprites/lord_british.png';

export const TileInfo = {
  grass: { name: 'Meadow', desc: 'lush green grass', color: '#3b7f3a', passable: true, encounterChance: 0.05 },
  trees: { name: 'Woodland', desc: 'densely packed trees', color: '#1f3d1b', passable: false },
  water: { name: 'Stream', desc: 'cool, flowing water', color: '#264c7d', passable: false },
  path: { name: 'Path', desc: 'a worn dirt road', color: '#9f884f', passable: true },
  castle_floor: { name: 'Castle Floor', desc: 'sturdy stone blocks', color: '#555555', passable: true },
  castle_wall: { name: 'Wall', desc: 'thick stone fortifications', color: '#333333', passable: false },
  castle_door: { name: 'Door', desc: 'a heavy iron-bound door', color: '#885522', passable: true },
  red_carpet: { name: 'Royal Carpet', desc: 'opulent red velvet', color: '#8b0000', passable: true },
  courtyard: { name: 'Courtyard', desc: 'flagstones and fresh air', color: '#666', passable: true },
  dungeon_floor: { name: 'Dungeon Floor', desc: 'cold, damp stone', color: '#444', passable: true, encounterChance: 0.2 },
  dungeon_wall: { name: 'Dungeon Wall', desc: 'crumbling, dark wall', color: '#222', passable: false },
  cave_entrance: { name: 'Cave Mouth', desc: 'the opening to darkness', color: '#000', passable: true },
  athens_marble: { name: 'Marble Floor', desc: 'smooth, white Attic marble', color: '#e0e0e0', passable: true },
  athens_grass: { name: 'Olive Grove', desc: 'fertile soil and grass', color: '#4a7c44', passable: true, alternate: 'grass' },
  athens_water: { name: 'Azure Sea', desc: 'deep blue Mediterranean waters', color: '#4da6ff', passable: false, alternate: 'water' },
  athens_temple_wall: { name: 'Temple Wall', desc: 'fluted marble column base', color: '#d0d0d0', passable: false },
  athens_roof: { name: 'Temple Roof', desc: 'terracotta tiles', color: '#325aa8', passable: false }
};

export function createWorld() {
  // 1. MAIN CASTLE HALL (Upgraded with Athens Marble)
  const castle = new GameMap({
    id: 'castle',
    name: 'Castle Britannia',
    width: 20, height: 15, safe: true,
    layout: [
      '####################',
      '#..................#',
      'D..PP..........PP..#',
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
      '#########DD#########',
      '####################'
    ],
    legend: { '#': 'athens_temple_wall', '.': 'athens_marble', 'R': 'red_carpet', 'P': 'athens_marble', 'D': 'castle_door' },
    objects: [
      { x: 3, y: 2, sprite: 'pillar', height: 2 }, { x: 16, y: 2, sprite: 'pillar', height: 2 },
      { x: 3, y: 9, sprite: 'pillar', height: 2 }, { x: 16, y: 9, sprite: 'pillar', height: 2 },
      { x: 9, y: 2, sprite: 'throne', width: 2, height: 2 },
      { x: 1, y: 5, sprite: 'torch_wall' }, { x: 18, y: 5, sprite: 'torch_wall' }
    ],
    npcs: [
      {
        id: 'lord_british', name: 'Lord British', x: 9, y: 3,
        spriteSheet: LORD_BRITISH_SPRITE_SHEET, spriteFrame: 'player_south_1',
        color: '#ffdd00',
        behavior: 'static',
        dialogue: (state) => {
          const stage = state.character.getQuestStage('orb_quest');
          return QuestManager.resolveDialogue('orb_quest', stage);
        }
      }
    ],
    transitions: [
      { x: 9, y: 13, map: 'athens_entrance', spawn: 'castle_gate' },
      { x: 10, y: 13, map: 'athens_entrance', spawn: 'castle_gate' },
      { x: 0, y: 2, map: 'castle_bedroom', spawn: 'bedroom_door' }
    ],
    spawnPoints: { 'castle_gate': { x: 9, y: 12 }, 'bedroom_door': { x: 1, y: 2 } }
  });

  // 2. ATHENS ENTRANCE (Showcase Area)
  const athens_entrance = new GameMap({
    id: 'athens_entrance',
    name: 'Athens Entrance',
    width: 20, height: 20, safe: true,
    defaultTile: 'athens_grass',
    layout: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W..................W',
      'W...MMMMMMMMMMMM...W',
      'W...M..........M...W',
      'W...M...MMMM...M...W',
      'W...M...M..M...M...W',
      'W...M...M..M...M...W',
      'W...M...MMMM...M...W',
      'W...M..........M...W',
      'W...MMMMMMMMMMMM...W',
      'W..................W',
      'W..................W',
      'WWWWWWWWWWWWWWWWWWWW'
    ],
    legend: { 'W': 'athens_water', '.': 'athens_grass', 'M': 'athens_marble' },
    layersData: [
       {
         zIndex: 1, // Roof Layer
         layout: [
           '                    ',
           '   RRRRRRRRRRRRRR   ',
           '   R............R   ',
           '   R............R   ',
           '   R............R   ',
           '   R............R   ',
           '   R............R   ',
           '   RRRRRRRRRRRRRR   '
         ],
         legend: { 'R': 'athens_roof', '.': 'none' }
       }
    ],
    objects: [
      { x: 3, y: 3, sprite: 'pillar', height: 2 }, { x: 16, y: 3, sprite: 'pillar', height: 2 },
      { x: 3, y: 8, sprite: 'pillar', height: 2 }, { x: 16, y: 8, sprite: 'pillar', height: 2 },
      { x: 9, y: 5, sprite: 'fountain', width: 2, height: 2 },
      { x: 7, y: 3, sprite: 'statue' }, { x: 12, y: 3, sprite: 'statue' }
    ],
    npcs: [
      {
        id: 'philosopher_1', name: 'Socrates', x: 10, y: 10,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#fff',
        behavior: 'wander',
        dialogue: 'The only true wisdom is in knowing you know nothing.'
      }
    ],
    transitions: [
      { x: 9, y: 12, map: 'castle', spawn: 'castle_gate' },
      { x: 10, y: 12, map: 'castle', spawn: 'castle_gate' }
    ],
    spawnPoints: { 'castle_gate': { x: 9, y: 11 } }
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
        id: 'alchemist_1', name: 'Wandering Alchemist', x: 15, y: 14,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#4a4',
        behavior: 'static',
        dialogue: (state) => {
            const hasGold = (state.character.gold >= 50);
            return `Greetings traveler! I sell Health Potions for 50 gold. ${hasGold ? 'Would you like one? (Interact again to buy)' : 'You look a bit short on coin.'}`;
        }
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
      '#..#######...####..#',
      '#..#........#...#..#',
      '#..#..#######...#..#',
      '#..#..#.........#..#',
      '#..#..#...#######..#',
      '#..#..#...#.....#..#',
      '#..#..#####..O..#..#', // O = Orb Room
      '#..#.........#..#..#',
      '#..###########..#..#',
      '#...............#..#',
      '#######...#######..#',
      '#..................#',
      '#.......E..........#',
      '####################'
    ],
    legend: { '#': 'dungeon_wall', '.': 'dungeon_floor', 'E': 'cave_exit', 'O': 'dungeon_floor' },
    objects: [
      { x: 10, y: 10, sprite: 'torch_wall' },
      { x: 13, y: 3, sprite: 'armory_rack' },
      { x: 13, y: 8, type: 'item', sprite: 'fountain', color: '#88f', data: { id: 'orb_of_moons', name: 'Orb of Moons', type: 'quest_item', weight: 1 } }
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
    this.npcs = data.npcs || [];
    this.objects = data.objects || [];
    this.layers = data.layers || [];
    
    // Initialize primary tiles layer if not provided via layers
    if (!this.layers.length) {
        this.tiles = [];
        for (let y = 0; y < this.height; y++) {
          this.tiles.push(new Array(this.width).fill(data.defaultTile || 'grass'));
        }
    }

    if (data.layout && data.legend) {
        this.applyLayout(data.layout, data.legend);
    }
    
    // Support initialization of specific layers from data
    if (data.layersData) {
        data.layersData.forEach(l => {
            const layerTiles = [];
            for (let y = 0; y < this.height; y++) {
                layerTiles.push(new Array(this.width).fill(l.default || 'none'));
            }
            if (l.layout && l.legend) {
                this.applyLayoutToGrid(l.layout, l.legend, layerTiles);
            }
            this.layers.push({ zIndex: l.zIndex || 0, tiles: layerTiles });
        });
    }
  }

  applyLayout(layout, legend) {
    this.applyLayoutToGrid(layout, legend, this.tiles);
  }

  applyLayoutToGrid(layout, legend, grid) {
    if (!grid) return;
    layout.forEach((row, y) => {
      if (y >= this.height) return;
      for (let x = 0; x < this.width && x < row.length; x++) {
        if (legend[row[x]]) grid[y][x] = legend[row[x]];
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