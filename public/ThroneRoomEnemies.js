export const THRONE_AMBUSH_GROUP = 'throne_ambush';

export const THRONE_AMBUSH_NPC_IDS = Object.freeze([
  'throne_raider_vanguard',
  'throne_raider_left',
  'throne_raider_right'
]);

const GARGOYLE_SHEET = 'assets/sprites/gargoyle_guardian_sheet.svg?v=2';
const GARGOYLE_SHEET_OPTIONS = Object.freeze({
  columns: 4,
  rows: 3,
  directions: ['south', 'east', 'north'],
  framePrefix: 'gargoyle'
});

const THRONE_AMBUSH_NPC_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'throne_raider_vanguard',
    name: 'Gargoyle Vanguard',
    x: 14,
    y: 10,
    facing: 'south',
    spriteSheet: GARGOYLE_SHEET,
    spriteSheetOptions: GARGOYLE_SHEET_OPTIONS,
    spriteFrame: 'gargoyle_south_1',
    spriteTileWidth: 1.52,
    spriteTileHeight: 1.92,
    spriteAnchorX: 0.5,
    spriteAnchorY: 1,
    spriteOffsetTileY: 0.03,
    color: '#8f3345',
    behavior: 'static',
    hostile: true,
    blocksMovement: true,
    enemyGroup: THRONE_AMBUSH_GROUP,
    stageRole: 'throne_enemy',
    visualVariant: 'vanguard',
    visualPhase: 120,
    aggroRadius: 1.7,
    job: 'I lead the strike that will close Britannia’s moongates.',
    hostileLine: 'The moonstone comes with us. Stand aside, surface-born.'
  }),
  Object.freeze({
    id: 'throne_raider_left',
    name: 'Gargoyle Skirmisher',
    x: 10,
    y: 11,
    facing: 'south',
    spriteSheet: GARGOYLE_SHEET,
    spriteSheetOptions: GARGOYLE_SHEET_OPTIONS,
    spriteFrame: 'gargoyle_south_0',
    spriteTileWidth: 1.36,
    spriteTileHeight: 1.76,
    spriteAnchorX: 0.5,
    spriteAnchorY: 1,
    spriteOffsetTileY: 0.04,
    color: '#a43c39',
    behavior: 'static',
    hostile: true,
    blocksMovement: true,
    enemyGroup: THRONE_AMBUSH_GROUP,
    stageRole: 'throne_enemy',
    visualVariant: 'skirmisher',
    visualPhase: 620,
    aggroRadius: 1.35,
    job: 'I hold the western aisle while the Orb is taken.',
    hostileLine: 'No king will seal the gates while our world dies.'
  }),
  Object.freeze({
    id: 'throne_raider_right',
    name: 'Gargoyle Seer',
    x: 19,
    y: 11,
    facing: 'south',
    spriteSheet: GARGOYLE_SHEET,
    spriteSheetOptions: GARGOYLE_SHEET_OPTIONS,
    spriteFrame: 'gargoyle_south_2',
    spriteTileWidth: 1.40,
    spriteTileHeight: 1.82,
    spriteAnchorX: 0.5,
    spriteAnchorY: 1,
    spriteOffsetTileY: 0.02,
    color: '#70405d',
    behavior: 'static',
    hostile: true,
    blocksMovement: true,
    enemyGroup: THRONE_AMBUSH_GROUP,
    stageRole: 'throne_enemy',
    visualVariant: 'seer',
    visualPhase: 1040,
    aggroRadius: 1.35,
    job: 'I watch for the one named in the prophecy.',
    hostileLine: 'The False Prophet has entered the hall.'
  })
]);

function cloneNpc(template) {
  return {
    ...template,
    spriteSheetOptions: { ...template.spriteSheetOptions }
  };
}

export function isThroneAmbushNpc(npc) {
  return Boolean(
    npc
    && npc.enemyGroup === THRONE_AMBUSH_GROUP
    && THRONE_AMBUSH_NPC_IDS.includes(npc.id)
  );
}

export function getThroneAmbushNpcs() {
  return THRONE_AMBUSH_NPC_TEMPLATES.map(cloneNpc);
}

export function shouldShowThroneAmbushEnemies({
  castleCrisisStage = 0,
  throneIntroComplete = false
} = {}) {
  return !throneIntroComplete && Number(castleCrisisStage || 0) < 2;
}

export function syncThroneAmbushNpcs(castleMap, options = {}) {
  if (!castleMap || !Array.isArray(castleMap.npcs)) return [];

  const permanentNpcs = castleMap.npcs.filter((npc) => !isThroneAmbushNpc(npc));
  const hostiles = shouldShowThroneAmbushEnemies(options)
    ? getThroneAmbushNpcs()
    : [];

  castleMap.npcs = [...permanentNpcs, ...hostiles];
  return hostiles;
}

export function findThroneAmbushAggressor(map, x, y) {
  if (!map || !Array.isArray(map.npcs)) return null;

  return map.npcs
    .filter(isThroneAmbushNpc)
    .map((npc) => ({
      npc,
      distance: Math.hypot(Number(x) - npc.x, Number(y) - npc.y)
    }))
    .filter(({ npc, distance }) => distance <= (npc.aggroRadius || 1))
    .sort((a, b) => a.distance - b.distance)[0]?.npc || null;
}

export function getThroneAmbushStatus(map) {
  const hostiles = Array.isArray(map?.npcs)
    ? map.npcs.filter(isThroneAmbushNpc)
    : [];

  return {
    active: hostiles.length > 0,
    count: hostiles.length,
    ids: hostiles.map((npc) => npc.id)
  };
}
