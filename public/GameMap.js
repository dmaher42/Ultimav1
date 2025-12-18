// Feature: Game World Data (Living World)

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
  courtyard: { name: 'Courtyard', color: '#666', passable: true }
};

export function createWorld() {
  const castle = new GameMap({
    id: 'castle',
    name: 'Castle Britannia',
    width: 20, height: 15, safe: true,
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
    legend: { '#': 'castle_wall', '.': 'castle_floor', 'R': 'red_carpet', 'P': 'castle_floor' },
    objects: [
      { x: 3, y: 2, sprite: 'pillar', height: 2 }, { x: 16, y: 2, sprite: 'pillar', height: 2 },
      { x: 3, y: 9, sprite: 'pillar', height: 2 }, { x: 16, y: 9, sprite: 'pillar', height: 2 },
      { x: 9, y: 2, sprite: 'throne', width: 2, height: 2 },
      { x: 1, y: 5, sprite: 'torch_wall' }, { x: 18, y: 5, sprite: 'torch_wall' },

      // ITEMS (New!)
      {
        x: 4, y: 4,
        type: 'item',
        sprite: 'chest', // Fallback to color if missing
        color: '#d4af37', // Gold color
        data: { id: 'gold_pouch', name: 'Pouch of Gold', type: 'misc', value: 50, weight: 1 }
      },
      {
        x: 15, y: 4,
        type: 'item',
        sprite: 'potion',
        color: '#ff4444',
        data: { id: 'potion_h1', name: 'Health Elixir', type: 'consumable', effect: {type:'heal', amount:50}, weight: 0.5 }
      }
    ],
    npcs: [
      {
        id: 'lord_british', name: 'Lord British', x: 9, y: 3,
        spriteSheet: LORD_BRITISH_SPRITE_SHEET, spriteFrame: 'player_south_1',
        color: '#ffdd00',
        behavior: 'static',
        dialogue: 'Welcome, Avatar! Use T to talk and G to pick up the supplies I have left for you.'
      },
      {
        id: 'guard_captain', name: 'Guard Captain', x: 9, y: 8,
        spriteSheet: 'assets/sprites/guard_captain.png',
        color: '#aaa',
        behavior: 'static',
        dialogue: 'Keep your weapons sheathed in the throne room.'
      }
    ],
    transitions: [ { x: 9, y: 13, map: 'village', spawn: 'castle_gate' }, { x: 10, y: 13, map: 'village', spawn: 'castle_gate' } ]
  });

  const village = new GameMap({
    id: 'village', name: 'Britanny Bay', width: 30, height: 30, safe: true, defaultTile: 'grass',
    layout: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T............................T',
      'T..GGG..................GGG..T',
      'T...........PPP..............T',
      'T...........PPP..............T',
      'T......WWW..........WWW......T',
      'T............................T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    legend: { 'T': 'trees', '.': 'grass', 'P': 'path', 'G': 'garden', 'W': 'water' },
    objects: [ { x: 15, y: 15, sprite: 'fountain', width: 2, height: 2 } ],
    npcs: [
      {
        id: 'villager_1', name: 'Wandering Merchant', x: 12, y: 16,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#c96',
        behavior: 'wander', // This NPC will move!
        dialogue: 'I walk these paths every day. Beautiful, isn\'t it?'
      }
    ],
    transitions: [ { x: 15, y: 4, map: 'castle', spawn: 'castle_entry' } ],
    spawnPoints: { 'castle_gate': { x: 15, y: 6 } }
  });

  return { maps: { castle, village }, startingMap: castle };
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
    // Items are passable, large objects (pillars) are not
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
    if (this.spawnPoints && this.spawnPoints[tag]) {
      return this.spawnPoints[tag];
    }
    return { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
  }
}
