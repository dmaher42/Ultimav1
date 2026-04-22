// Feature: Game World Data (Multi-Room Expansion)
import QuestManager from './QuestManager.js';

export const AVATAR_SPRITE = 'assets/sprites/avatar.png';
export const LORD_BRITISH_SPRITE_SHEET = 'assets/sprites/lord_british_v2_seated.png';
export const CASTLE_BRITANNIA_SENTINEL_SPRITE = 'assets/sprites/guard_captain.png';
export const CHEST_SPRITE_SHEET = 'assets/sprites/chest.png';

export const TileInfo = {
  grass: { 
    name: 'Grass', desc: 'green fields', color: '#3b7f3a', passable: true
  },
  trees: { name: 'Woodland', desc: 'densely packed trees', color: '#1f3d1b', passable: false },
  water: { name: 'Stream', desc: 'cool, flowing water', color: '#264c7d', passable: false },
  path: { name: 'Path', desc: 'a worn dirt road', color: '#9f884f', passable: true },
  castle_floor: { name: 'Castle Floor', desc: 'sturdy stone blocks', color: '#555555', passable: true },
  castle_wall: { name: 'Wall', desc: 'thick stone fortifications', color: '#333333', passable: false },
  castle_door: { name: 'Door', desc: 'a heavy iron-bound door', color: '#885522', passable: true },
  red_carpet_end: { name: 'Royal Carpet Flourish', desc: 'the ceremonial approach to the throne', color: '#f44336', passable: true },
  courtyard: { name: 'Courtyard', desc: 'flagstones and fresh air', color: '#666', passable: true },
  dungeon_floor: { name: 'Dungeon Floor', desc: 'cold, damp stone', color: '#444', passable: true, encounterChance: 0.2 },
  dungeon_wall: { name: 'Dungeon Wall', desc: 'crumbling, dark wall', color: '#222', passable: false },
  cave_entrance: { name: 'Cave Mouth', desc: 'the opening to darkness', color: '#000', passable: true },
  marble_wall: { 
    name: 'Royal Marble Wall', desc: 'polished white marble with gold veins', color: '#fcfcfc', passable: false,
    variations: ['marble_wall', 'marble_wall_1']
  },
  marble_floor: { 
    name: 'Marble Floor', desc: 'smooth, reflective marble', color: '#ffffff', passable: true,
    variations: ['marble_floor', 'marble_floor_1', 'marble_floor_2', 'marble_floor_3']
  },
  meadow: { 
    name: 'Meadow', desc: 'fertile soil and lush grass', color: '#4a7c44', passable: true, alternate: 'grass'
  },
  azure_water: { name: 'Azure Sea', desc: 'deep blue Mediterranean waters', color: '#4da6ff', passable: false, alternate: 'water' },
  lycaeum_roof: { name: 'Lycaeum Roof', desc: 'terracotta tiles', color: '#325aa8', passable: false },
  dais_floor: { name: 'Royal Dais', desc: 'elevated marble platform', color: '#fffdf5', passable: true },
  marble_edge: { name: 'Marble Edge', desc: 'decorative trim', color: '#f0f0f0', passable: true },
  red_carpet: { 
    name: 'Royal Carpet', desc: 'gold-trimmed ceremonial carpet', color: '#e53935', passable: true,
    variations: ['red_carpet', 'red_carpet_1', 'red_carpet_2']
  },
  royal_carpet: { 
    name: 'Royal Runner', desc: 'gold-trimmed ceremonial carpet', color: '#e53935', passable: true
  },
  ruins_floor: { name: 'Ancient Ruins', desc: 'shattered stone blocks and ivy', color: '#5a5a5a', passable: true, encounterChance: 0.15 }
};

export function createWorld() {
  // 1. MAIN CASTLE HALL (Upgraded with Athens Marble)
  const castle = new GameMap({
    id: 'castle',
    name: 'Castle Britannia',
    width: 30, height: 20, safe: true,
    layout: [
      '##############################',
      '##############################',
      '##........WWWWWWWWWW........##',
      '##......WWWWWWWWWWWWWW......##',
      'D...........................##',
      '##......WWWWWWWWWWWWWW......##',
      '##......WMMMMMMMMMMMMW......##',
      '##.......WMMMMMMMMMMW.......##',
      '##......WWMMMTTTTMMMWW......##',
      '##........WWWWTTWWWW........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '##.........WWRRRRWW.........##',
      '#########DDDDDDDDDDDD#########',
      '##############################'
    ],
    legend: { '#': 'marble_wall', '.': 'marble_floor', 'R': 'red_carpet', 'T': 'red_carpet_end', 'M': 'dais_floor', 'W': 'marble_edge', 'D': 'castle_door' },
    objects: [
      // Processional colonnade framing the central aisle.
      { x: 6, y: 3, sprite: 'pillar', height: 3 },
      { x: 23, y: 3, sprite: 'pillar', height: 3 },
      { x: 6, y: 9, sprite: 'pillar', height: 3 },
      { x: 23, y: 9, sprite: 'pillar', height: 3 },
      { x: 6, y: 15, sprite: 'pillar', height: 3 },
      { x: 23, y: 15, sprite: 'pillar', height: 3 },

      // Throne wall set piece inspired by the reference image.
      { x: 11, y: 0, sprite: 'royal_drapes', width: 8, height: 4, passable: true, shadow: false },
      { x: 14, y: 1, sprite: 'royal_crest', width: 2, height: 3, passable: true, shadow: false },
      
        // Majestic throne centerpiece
        { 
          x: 14, y: 6,
          sprite: 'throne', 
          width: 3.35, height: 3.45,
          anchorX: 0.5,
          anchorY: 1,
          shadow: true
        },

      // Braziers flanking the dais like the reference hall.
      { x: 10, y: 6, sprite: 'royal_brazier', width: 1, height: 2 },
      { x: 19, y: 6, sprite: 'royal_brazier', width: 1, height: 2 },
      
      // Royal Banners
      { x: 9, y: 2, sprite: 'banner', height: 4, shadow: false },
      { x: 20, y: 2, sprite: 'banner', height: 4, shadow: false },

      // Torches (Light sources)
      { x: 8, y: 3, sprite: 'torch_wall' }, { x: 21, y: 3, sprite: 'torch_wall' },
      { x: 2, y: 6, sprite: 'torch_wall' }, { x: 27, y: 6, sprite: 'torch_wall' },
      { x: 2, y: 12, sprite: 'torch_wall' }, { x: 27, y: 12, sprite: 'torch_wall' },
      { x: 2, y: 17, sprite: 'torch_wall' }, { x: 27, y: 17, sprite: 'torch_wall' }
    ],
    npcs: [
        {
          id: 'lord_british', name: 'Lord British', x: 14, y: 7,
          spriteSheet: LORD_BRITISH_SPRITE_SHEET,
          spriteFrame: 'player_south_1',
          spriteTileWidth: 1.38,
          spriteTileHeight: 1.5,
          spriteAnchorX: 0.5,
          spriteAnchorY: 1,
          spriteOffsetTileY: -1.47,
          shadow: false,
          color: '#ffdd00',
          behavior: 'static',
          job: 'I am but a steward of these Eight Virtues, Avatar. To rule is to serve, and to serve is to sacrifice.',
        responses: {
          'BRITANNIA': 'Our land is troubled by the Gargoyle incursions. They strike with a precision that suggests a deep-seated grievance.',
          'GARGOYLE': 'Winged creatures of the underworld. They were once thought simple beasts, but they coordinate their attacks around our Shrines.',
          'VIRTUE': 'The Eight Virtues are the foundation of our civilization: Compassion, Honesty, Honor, Humility, Justice, Sacrifice, Spirituality, and Valor.',
          'ORB': 'The Orb of Moons is a powerful relic that governs travel. Its theft has disrupted the sacred Moongates.',
          'SHRINES': 'The Shrines of Virtue have been seized by the attackers. Their disruption is an affront to all that we hold sacred.',
          'MOONSTONES': 'Small pieces of the moons themselves, used to ground the Moongates. They have been disturbed.',
          'LYCAEUM': 'To the West lies the Keep of Truth. Speak with Mariah there; she is the foremost scholar in the realm.',
          'TABLET': 'A Gargoyle tablet? This... this contradicts everything we thought we knew. If they act out of sacrifice, what does that make our "defense"?',
          'MISUNDERSTANDING': 'I have always strove for Justice. If our actions have caused their world to bleed, then we are not the heroes of this tale.'
        },
        dialogue: (state) => {
          const stage = state.character.getQuestStage('orb_quest');
          if (stage === 1) return "Go to the Lycaeum, Avatar. Seek Mariah and ask her about the PROPHECY.";
          if (stage >= 2) return "You have returned! Use the keyword ORB to discuss our next steps.";
          return "Welcome, Avatar. Britain is safe for now, but the world at large is in peril.";
        }
      },
      {
        id: 'guard_left', name: 'Royal Sentinel', x: 12, y: 8,
        spriteSheet: 'assets/sprites/guard_captain.png',
        spriteFrame: 'player_south_1',
        color: '#ffcc00',
        behavior: 'static',
        job: 'Hail, seeker of Virtue.',
      },
      {
        id: 'guard_right', name: 'Royal Sentinel', x: 17, y: 8,
        spriteSheet: 'assets/sprites/guard_captain.png',
        spriteFrame: 'player_south_1',
        color: '#ffcc00',
        behavior: 'static',
        job: 'The King awaits your word.',
      },
      {
        id: 'castle_guard', name: 'Sentinel', x: 11, y: 15,
        spriteSheet: CASTLE_BRITANNIA_SENTINEL_SPRITE,
        spriteFrame: 'player_south_1',
        spriteTileWidth: 1.2,
        spriteTileHeight: 1.35,
        spriteAnchorX: 0.5,
        spriteAnchorY: 1,
        spriteOffsetTileY: -1.28,
        color: '#ffcc00',
        behavior: 'static',
        job: 'I stand watch over the gates of Castle Britannia.',
        responses: {
          'GARGOYLES': 'I saw them with my own eyes during the raid. They fly faster than any bird and strike with the strength of ten men.',
          'CASTLE': 'This castle is the heart of the realm. We will hold it, no matter the cost.',
          'LORD BRITISH': 'His Majesty is concerned for the people. He has spent many nights in the upper library, searching for answers.',
          'DANGER': 'The roads are no longer safe, traveler. Stick to the paths and keep your sword sharp.'
        },
        dialogue: "Stand back, citizen. The castle is on high alert."
      }
    ],
    adjacencies: { south: { map: 'overworld', xOffset: 15, silent: true } },
    transitions: [
      { x: 0, y: 4, map: 'castle_bedroom', spawn: 'bedroom_door' }
    ],
    spawnPoints: { 'castle_gate': { x: 14, y: 18 }, 'bedroom_door': { x: 2, y: 1 } }
  });

  // 2. LYCAEUM ENTRANCE (Formerly Athens Entrance)
  const lycaeum_entrance = new GameMap({
    id: 'lycaeum_entrance',
    name: 'The Lycaeum',
    width: 20, height: 20, safe: true,
    defaultTile: 'meadow',
    layout: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W..................W',
      'W...MMMMMMMMMMMM...W',
      'W...M..........M....',
      'W...M...MMMM...M....',
      'W...M...M..M...M....',
      'W...M...M..M...M....',
      'W...M...MMMM...M....',
      'W...M..........M....',
      'W...MMMMMMMMMMMM...W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..................W',
      'W..................W',
      'WWWWWWWWWWWWWWWWWWWW'
    ],
    legend: { 'W': 'azure_water', '.': 'meadow', 'M': 'marble_floor' },
    layersData: [
        {
          zIndex: 1,
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
          legend: { 'R': 'lycaeum_roof', '.': 'none' }
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
        id: 'mariah', name: 'Mariah', x: 10, y: 10,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#fff',
        behavior: 'wander',
        job: 'I am a scholar of the Lycaeum. I study the mysteries of the Codex and the lore of our land.',
        responses: {
          'LYCAEUM': 'This is the Keep of Truth, where all knowledge is preserved and protected.',
          'CODEX': 'The Codex of Ultimate Wisdom is the greatest prize any seeker can find, though its location remains a mystery.',
          'WISDOM': 'True wisdom often begins with an admission of its absence, and the pursuit of Truth above all else.',
          'TRUTH': 'Ah, you have understood the challenge. Truth is the bedrock of our virtue. Knowing that we know nothing is the first step toward true understanding.',
          'GARGOYLES': 'There are reports they carry an ancient prophecy of their own, one that speaks of a "False Prophet" who brings ruin to their world.',
          'PROPHECY': 'The Gargoyles believe in a savior who will rescue them from destruction, yet their scrolls describe this savior\'s shadow as a doom-bringer to others.',
          'MOONSTONES': 'They are harmonic oscillators. The theft of the Orb suggests they are trying to realign the Moongates for their own purposes.',
          'SHRINES': 'They are focusing on the Shrines because the Shrines are the gateways to the Codex.',
          'TABLET': 'Let me see that... these runes speak of a "Great Dissolution" and a "Sacrifice" needed to save their world. They think we are the monsters, Avatar.',
          'FALSE PROPHET': 'It is a title they give to the one who takes their light. If you have the Orb, you are that prophet in their eyes.'
        },
        dialogue: 'The wisdom of Britannia is ancient, yet ever new. Seek the TRUTH, and the path will open.'
      }
    ],
    adjacencies: { east: { map: 'overworld', yOffset: 20, silent: true } },
    transitions: [],
    spawnPoints: { 'lycaeum_gateway': { x: 9, y: 11 }, 'east_edge': { x: 18, y: 10 } }
  });

  const castle_bedroom = new GameMap({
    id: 'castle_bedroom',
    name: 'Royal Quarters',
    width: 12, height: 10, safe: true,
    defaultTile: 'castle_floor',
    layout: [
      '############',
      '#..........#',
      '#..BB......#',
      '#..........#',
      '#.......S..#',
      '#..........D',
      '#..........#',
      '############',
      '############',
      '############'
    ],
    legend: { '#': 'castle_wall', '.': 'castle_floor', 'D': 'castle_door', 'B': 'castle_floor', 'S': 'castle_floor' },
    objects: [
      { x: 3, y: 2, sprite: 'royal_bed', width: 2, height: 2 },
      { x: 8, y: 4, sprite: 'bookshelf' },
      { x: 2, y: 2, type: 'item', sprite: 'chest', color: '#d4af37', data: { id: 'storm_cloak', name: 'Storm Cloak', type: 'accessory', stats: { defense: 3, str_req: 8 }, effects: { magicShield: 0.5, lightningShield: 1, fireShield: 0.25 }, value: 120, weight: 1.2 } }
    ],
    transitions: [
      { x: 11, y: 5, map: 'castle', spawn: 'bedroom_door' }
    ],
    spawnPoints: { 'bedroom_door': { x: 10, y: 5 } }
  });

  const village = new GameMap({
    id: 'village', name: 'Britanny Bay', width: 30, height: 30, safe: true, defaultTile: 'grass',
    layout: [
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '....WWW................WWW....',
      '...W...W..............W...W...',
      '..W.....W............W.....W..',
      '...W...W..............W...W...',
      '....WWW................WWW....',
      '..............................',
      '..............................',
      '...........PPPPPPP............',
      '...........P.....P............',
      '...........P..F..P............',
      '...........P.....P............',
      '...........PPPPPPP............',
      '..............................',
      '..............................',
      '..............................',
      '..GGGGGGGG..........GGGGGGGG..',
      '..G......G..........G......G..',
      '..G..WW..G..........G..WW..G..',
      '..G..W.W.G..........G..W.W.G..',
      '..G..WW..G..........G..WW..G..',
      '..G......G..........G......G..',
      '..GGGGGGGG..........GGGGGGGG..',
      '..............................',
      '..............................',
      '..............................',
      '..............................'
    ],
    legend: { 'T': 'trees', '.': 'grass', 'P': 'path', 'G': 'path', 'W': 'water', 'F': 'path' },
    objects: [
      { x: 15, y: 13, sprite: 'fountain', width: 2, height: 2 }
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
      },
      {
        id: 'villager_1', name: 'Citizen', x: 5, y: 15,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#966',
        behavior: 'wander',
        job: 'I am but a simple resident of Britanny Bay.',
        responses: {
          'GARGOYLES': 'They say the shrines were glowing red before the attack. My cousin in the North saw a winged beast carry away a sacred stone.',
          'SHRINE': 'The Shrine of Compassion lies nearby, but none dare visit it since the shadows appeared.',
          'TOWN': 'Britanny is a quiet place usually, but the fear is palpable now.',
          'RUMORS': 'I saw a wounded Gargoyle near the woods. It didn\'t attack; it just looked at me with such... sadness. I didn\'t tell the guards.'
        },
        dialogue: "It is a dark time for Britannia, is it not?"
      }
    ],
    adjacencies: { north: { map: 'overworld', xOffset: 15, silent: true } },
    transitions: [],
    spawnPoints: { 'village_road': { x: 15, y: 1 }, 'north_edge': { x: 15, y: 1 } }
  });

  const overworld = new GameMap({
    id: 'overworld',
    name: 'The Britannian Wilderness',
    width: 60, height: 60, safe: false, encounterRate: 0.1,
    defaultTile: 'grass',
    layout: [
      'TTTTTTTTTTTTTTT                               TTTTTTTTTTTTTTT',
      'TTTTT..........                               ..........TTTTT',
      'TTT............                               ............TTT',
      'TT.............                               .............TT',
      'T...............          ..........          ..............T',
      'T...............        ..............        ..............T',
      'T..............       ..WWWWWWWWWWWWWW..       .............T',
      'T..............      ..WWWWWWWWWWWWWWWW..      .............T',
      'T...TTTTT......      ..WWWWWWWWWWWWWWWW..      ......TTTTT..T',
      'T..TTTTTTT.....      ..WWWWWWWWWWWWWWWW..      .....TTTTTT..T',
      'T..TTTTTTTT....       ..WWWWWWWWWWWWWW..       ....TTTTTTT..T',
      'T...TTTTTT.....         ..............         .....TTTTT...T',
      'T.....TTT......           ..........           ......TTT....T',
      'T..............                               ..............T',
      'T..............                               ..............T',
      'T..............                               ..............T',
      'T..........                                       ..........T',
      'T.......                                             .......T',
      'T....                                                   ....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................            XXXXX            .............T',
      ' .................           XXXXXXX           .............T',
      ' .................           XXXXXXX           .............T',
      ' .................            XXXXX            .............T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      ' .................                                     .....T',
      'T..............                                        .....T',
      'T..............                                        .....T',
      'T..............                                        .....T',
      'T.......TTTTT..                                 ..TTTTT.....T',
      'T......TTTTTTTT.                               .TTTTTTTT....T',
      'T.....TTTTTTTTTT.                             .TTTTTTTTTT...T',
      'T....TTTTTTTTTTTT.                           .TTTTTTTTTTTT..T',
      'T...TTTTTTTTTTTTTT.                         .TTTTTTTTTTTTTT.T',
      'T..TTTTTTTTTTTTTTTT.                       .TTTTTTTTTTTTTTT.T',
      'T.TTTTTTTTTTTTTTTTTT.                     .TTTTTTTTTTTTTTTT.T',
      'TTTTTTTTTTTTTTTTTTTTT.                   .TTTTTTTTTTTTTTTTT.T',
      'TTTTTTTTTTTTTTTTTTTTTT.                 .TTTTTTTTTTTTTTTTTT.T',
      'TTTTTTTTTTTTTTTTTTTTTTT.               .TTTTTTTTTTTTTTTTTTT.T',
      'TTTTTTTTTTTTTTTTTTTTTTTT.             .TTTTTTTTTTTTTTTTTTTT.T',
      'T................                                      .....T',
      'T................                                      .....T',
      'T................                                      .....T',
      'TTTTTTTTTTTTTTT                               TTTTTTTTTTTTTTT'
    ],
    legend: { 'T': 'trees', '.': 'grass', ' ': 'grass', 'W': 'water', 'X': 'ruins_floor' },
    objects: [
      { x: 23, y: 1, sprite: 'pillar', height: 2 }, { x: 30, y: 1, sprite: 'pillar', height: 2 },
      { x: 1, y: 25, sprite: 'statue' }, { x: 1, y: 28, sprite: 'statue' },
      { x: 23, y: 58, sprite: 'fountain' }, { x: 30, y: 58, sprite: 'fountain' },
      { x: 52, y: 30, sprite: 'cave_entrance' },
      { x: 10, y: 10, sprite: 'chapel_altar', name: 'Shrine of Compassion' },
      { x: 50, y: 50, sprite: 'chapel_altar', name: 'Shrine of Honesty' },
      { x: 30, y: 25, sprite: 'pillar', name: 'The Ancient Spire' }
    ],
    npcs: [
      {
        id: 'hermit', name: 'Iolo the Hermit', x: 45, y: 10,
        spriteSheet: 'assets/sprites/villager.png',
        color: '#ffcc99',
        behavior: 'wander',
        job: 'I play my lute and watch the stars. The Gargoyles do not bother me, for I have nothing they desire.',
        responses: {
          'LUTE': 'A fine instrument. It speaks a language that transcends words.',
          'STARS': 'They tell of a change in the winds. The False Prophet is mentioned in the celestial alignment.'
        },
        dialogue: "Greetings, traveler. The wilderness has a voice, if one listens closely."
      }
    ],
    adjacencies: {
        north: { map: 'castle', xOffset: -15, silent: true },
        south: { map: 'village', xOffset: -15, silent: true },
        west: { map: 'lycaeum_entrance', yOffset: -20, silent: true },
        east: 'dungeon_1'
    },
    transitions: [
      { x: 52, y: 30, map: 'dungeon_1', spawn: 'entry' }
    ],
    spawnPoints: {
      'castle_entrance': { x: 25, y: 2 },
      'lycaeum_gateway': { x: 2, y: 27 },
      'village_road': { x: 25, y: 57 },
      'dungeon_entrance': { x: 52, y: 31 }
    }
  });

  const dungeon_1 = new GameMap({
    id: 'dungeon_1', name: 'Dark Caverns', width: 30, height: 20, safe: false, areaLevel: 3, 
    encounterGroup: 'dungeon',
    defaultTile: 'dungeon_floor',
    layout: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X..............X.............X',
      'X..............X.............X',
      'X...XXXXXX.....X.............X',
      'X...X....X.....X.............X',
      'X...X....X.....X...XXXXXX....X',
      'X...X....X.....X...X....X....X',
      'X...X.G..X.....X...X.O..X....X',
      'X...X....X.....XXXXXXXXXX....X',
      'X...XXXXXX...................X',
      'X............................X',
      'X............................X',
      'X............................X',
      'X............................X',
      'X............................X',
      'X............................X',
      'X............................X',
      'X............................X',
      'E............................X',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    ],
    legend: { 'X': 'dungeon_wall', '.': 'dungeon_floor', 'E': 'cave_exit', 'O': 'dungeon_floor', 'G': 'dungeon_floor' },
    objects: [
        { x: 25, y: 7, type: 'item', data: { id: 'orb_of_moons', name: 'Orb of Moons', type: 'quest', lore: 'A glowing stone that resonates with the moons.' } },
        { x: 23, y: 7, type: 'item', data: { id: 'gargoyle_tablet', name: 'Gargoyle Tablet', type: 'quest', lore: 'A heavy stone slab covered in unreadable, geometric runes.' } }
    ],
    npcs: [
      {
        id: 'gargoyle_guardian', name: 'Guardian', x: 6, y: 7,
        spriteSheet: 'assets/sprites/gargoyle_guardian_sheet.svg',
        spriteSheetOptions: { columns: 4, rows: 3, directions: ['south', 'east', 'north'], framePrefix: 'gargoyle' },
        spriteFrame: 'gargoyle_south_0',
        color: '#f44',
        behavior: 'static',
        job: 'I protect the sacred artifact from the reach of the Doom-Bringer.',
        responses: {
          'PROPHET': 'The prophecy speaks of one who appears from a red moongate to destroy our home. We call them the False Prophet.',
          'SHRINE': 'The stones belong to our world. You have stolen them for your own glory.',
          'STONE': 'The stones must be returned if both worlds are to survive.',
          'PEOPLE': 'My people have suffered enough. We only seek to preserve what remains of our history.',
          'WAR': 'This is a war for survival. Do you not see the destruction your people have wrought?',
          'TABLET': 'You hold our history in your hands. Do you seek to destroy it as you have destroyed our peace?',
          'SACRIFICE': 'The prophecy demands a sacrifice to balance the scales. One world must fade so the other may breathe.'
        },
        dialogue: "Stay back, False Prophet! You shall not take the Orb while I still draw breath... unless you truly seek UNDERSTANDING of our plight."
      }
    ],
    transitions: [
      { x: 0, y: 18, map: 'overworld', spawn: 'dungeon_entrance' }
    ],
    spawnPoints: { 'entry': { x: 1, y: 18 } }
  });

  return { maps: { castle, lycaeum_entrance, castle_bedroom, village, dungeon_1, overworld }, startingMap: castle };
}

export class GameMap {
  constructor(data) {
    Object.assign(this, data);
    this.npcs = data.npcs || [];
    this.objects = data.objects || [];
    this.layers = data.layers || [];
    this.adjacencies = data.adjacencies || {};
    if (!this.layers.length) {
        this.tiles = [];
        for (let y = 0; y < this.height; y++) {
          this.tiles.push(new Array(this.width).fill(data.defaultTile || 'grass'));
        }
    }

    if (data.layout && data.legend) {
        this.applyLayout(data.layout, data.legend);
    }
    
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
    const info = TileInfo[tile];
    if (!info || info.passable === false) return false;

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
      return { x: 1, y: 1 };
  }
}
