// Feature: Living World (NPC AI + Item Pickup)
import CharacterCreator from './CharacterCreator.js';
import Character from './Character.js?v=2';
import { createWorld, TileInfo } from './GameMap.js?v=16';
import Renderer from './render.js?v=19';
import Player from './Player.js?v=2';
import MovementController from './MovementController.js?v=1';
import CombatEngine from './CombatEngine.js';
import { createEnemy } from './Enemy.js';
import ItemGenerator from './ItemGenerator.js';
import QuestManager from './QuestManager.js?v=2';
import SaveManager, { formatTimestamp } from './SaveManager.js?v=2';
import {
  ORB_QUEST_ID,
  ORB_QUEST_STAGE,
  ORB_QUEST_DECISION,
  createOrbQuestState,
  getOrbQuestStage,
  advanceOrbQuest,
  getOrbQuestStep,
  getMissingRelics,
  syncOrbQuestProgress,
  migrateLegacyOrbQuest,
  getOrbEnding
} from './OrbQuest.js?v=1';
import {
  THRONE_AMBUSH_GROUP,
  findThroneAmbushAggressor,
  getThroneAmbushStatus,
  isThroneAmbushNpc,
  syncThroneAmbushNpcs
} from './ThroneRoomEnemies.js?v=1';
import { initCanvas, resize } from './renderer/canvas.js';
import { loadAtlas } from './renderer/atlas.js';
import { createEmitter } from './renderer/particles.js';

const ctx = initCanvas('game');
const renderer = new Renderer(ctx);
const particles = createEmitter();
renderer.setParticles(particles);
const DEFAULT_PLAYER_SPRITE_SHEET = 'assets/sprites/player_champion_upgraded_walk_sheet_48x64.png?v=1';
const PLAYER_CHAMPION_SPRITE_OPTIONS = {
  columns: 4,
  rows: 4,
  directions: ['south', 'west', 'east', 'north'],
  framePrefix: 'player_champion',
  widthTiles: 1,
  heightTiles: 64 / 48,
  anchorX: 0.5,
  anchorY: 1,
  variants: {
    attack: 'assets/sprites/player_champion_upgraded_attack_sheet_48x64.png?v=1',
    cast: 'assets/sprites/player_champion_upgraded_cast_sheet_48x64.png?v=1'
  }
};

const syncCanvasSize = () => {
  resize();
};

const uiLeftRail = document.getElementById('ui-left-rail');

// --- DIALOGUE UI SETUP ---
const dialogueEl = document.createElement('div');
dialogueEl.id = 'dialogue-ui';
dialogueEl.className = 'panel hidden';
dialogueEl.style.cssText = `
    position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
    width: min(720px, calc(100vw - 48px));
    background: linear-gradient(180deg, rgba(16, 22, 40, 0.97), rgba(10, 14, 25, 0.95));
    border: 1px solid rgba(220, 182, 120, 0.45);
    color: #f3efe3;
    padding: 18px 20px;
    font-family: 'Trebuchet MS', monospace;
    z-index: 100;
    box-shadow: 0 24px 48px rgba(0,0,0,0.55);
    border-radius: 18px;
    backdrop-filter: blur(12px);
`;
dialogueEl.innerHTML = `
    <div id="dialogue-text" style="margin-bottom: 16px; min-height: 1.2em; font-size: 1.1em; line-height: 1.5;"></div>
    <div id="dialogue-keywords" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;"></div>
    <div id="dialogue-input-container" class="hidden"></div>
`;
document.body.appendChild(dialogueEl);

const dialogueText = dialogueEl.querySelector('#dialogue-text');
const dialogueKeywords = dialogueEl.querySelector('#dialogue-keywords');
const dialogueInputContainer = dialogueEl.querySelector('#dialogue-input-container');

// --- JOURNAL UI SETUP ---
const journalEl = document.createElement('div');
journalEl.id = 'journal-panel';
journalEl.className = 'panel hidden';
journalEl.style.cssText = `
    position: relative; width: 100%; max-height: none; height: auto;
    background: linear-gradient(180deg, #f1e2b9, #ddc690);
    color: #2e1d0e; border: 1px solid rgba(92, 60, 30, 0.72); padding: 24px;
    font-family: 'Times New Roman', serif; box-shadow: 16px 16px 40px rgba(0,0,0,0.58);
    z-index: 100; border-radius: 10px;
    overflow-y: auto;
`;
journalEl.innerHTML = `
    <h2 style="text-align: center; border-bottom: 2px solid #5c3c1e; padding-bottom: 10px; margin-top: 0;">Quest Journal</h2>
    <div id="journal-content"></div>
    <div style="text-align: center; margin-top: 20px; font-size: 0.8em;">(Press J to close)</div>
`;
if (uiLeftRail) {
  uiLeftRail.appendChild(journalEl);
} else {
  document.body.appendChild(journalEl);
}

// --- VERTICAL SLICE ENDING UI ---
const endingEl = document.createElement('div');
endingEl.id = 'vertical-slice-ending';
endingEl.className = 'hidden';
endingEl.style.cssText = `
    position: fixed; inset: 0; z-index: 240;
    display: grid; place-items: center;
    padding: 24px;
    background: radial-gradient(circle at 50% 22%, rgba(83, 65, 126, 0.42), rgba(5, 8, 17, 0.94) 62%);
    backdrop-filter: blur(12px);
`;
endingEl.innerHTML = `
  <section style="width:min(760px, 100%); max-height:calc(100vh - 48px); overflow:auto; border:1px solid rgba(220,182,120,.55); border-radius:22px; padding:30px; color:#f5efdf; background:linear-gradient(180deg, rgba(20,27,47,.98), rgba(9,13,24,.98)); box-shadow:0 30px 80px rgba(0,0,0,.65);">
    <div style="font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:#dcb678;">The Stolen Orb</div>
    <h1 style="margin:8px 0 4px; font-size:clamp(30px,5vw,52px);">Vertical Slice Complete</h1>
    <h2 id="ending-title" style="margin:6px 0 18px; color:#f0cd83;"></h2>
    <p id="ending-consequence" style="font-size:17px; line-height:1.65; color:#e9e4d8;"></p>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin:22px 0;">
      <div style="padding:14px; border-radius:12px; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.1);">
        <strong style="display:block; color:#dcb678; margin-bottom:6px;">The Guardian</strong>
        <span id="ending-guardian" style="line-height:1.45;"></span>
      </div>
      <div style="padding:14px; border-radius:12px; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.1);">
        <strong style="display:block; color:#dcb678; margin-bottom:6px;">Your counsel</strong>
        <span id="ending-counsel" style="line-height:1.45;"></span>
      </div>
    </div>
    <p style="font-size:13px; color:#aeb8cf;">Your ending and quest decisions have been saved.</p>
    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:20px;">
      <button data-ending-action="continue" style="padding:11px 16px; border-radius:10px; border:1px solid #dcb678; background:#dcb678; color:#15101d; font-weight:700; cursor:pointer;">Continue exploring</button>
      <button data-ending-action="journal" style="padding:11px 16px; border-radius:10px; border:1px solid rgba(220,182,120,.65); background:transparent; color:#f3e5c6; font-weight:700; cursor:pointer;">Review journal</button>
    </div>
  </section>
`;
document.body.appendChild(endingEl);

window.addEventListener('resize', syncCanvasSize);
window.addEventListener('orientationchange', syncCanvasSize);
syncCanvasSize();

const combatEngine = new CombatEngine(document.getElementById('combat-ui'));
const creator = new CharacterCreator(document.getElementById('character-creator'));
const itemGenerator = new ItemGenerator();

const hud = {
  name: document.getElementById('hud-name'),
  level: document.getElementById('hud-level'),
  hp: document.getElementById('hud-hp'),
  mp: document.getElementById('hud-mp'),
  xp: document.getElementById('hud-xp'),
  area: document.getElementById('hud-area'),
  gold: document.getElementById('hud-gold')
};

const panels = {
  inventory: document.getElementById('inventory-panel'),
  character: document.getElementById('character-panel'),
  menu: document.getElementById('menu-panel'),
  journal: journalEl,
  codex: document.getElementById('codex-panel'),
  orb: document.getElementById('orb-panel'),
  ending: endingEl
};

const inventoryList = document.getElementById('inventory-list');
const inventoryCapacity = document.getElementById('inventory-capacity');
const characterSummary = document.getElementById('character-summary');
const menuLastSave = document.getElementById('menu-last-save');
const messageLogEl = document.getElementById('message-log');
const tooltip = document.getElementById('tooltip');
const objectivePanel = document.getElementById('objective-panel');
const objectiveText = document.getElementById('objective-text');
const objectiveTip = document.getElementById('objective-tip');
const dungeonNavEl = document.getElementById('dungeon-nav');
const codexContent = document.getElementById('codex-content');
const orbContent = document.getElementById('orb-content');

inventoryList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-item-action]');
  if (!button) return;
  handleInventoryAction(button.dataset.itemAction, button.dataset.itemId);
});

const state = {
  world: createWorld(),
  map: null,
  player: null,
  character: null,
  discoveredAreas: new Set(),
  lookHighlight: null,
  messageLog: [],
  inCombat: false,
  lastSaveTimestamp: null,
  throneIntroTriggered: false,
  throneIntroComplete: false,
  guardianDefeated: false,
  orbQuest: createOrbQuestState(),
  currentConversationPartner: null,
  pendingTransition: null,
  fx: {
    lastCastleBurst: 0
  }
};

const KEY_TO_DIRECTION = {
  arrowup: 'north',
  w: 'north',
  arrowdown: 'south',
  s: 'south',
  arrowleft: 'west',
  a: 'west',
  arrowright: 'east',
  d: 'east'
};

const DIRECTION_OFFSETS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
  east: { dx: 1, dy: 0 }
};

const NPC_MOVE_DURATION_MS = 260;

const movementController = new MovementController({
  keyToDirection: KEY_TO_DIRECTION,
  canMove: () => canAcceptMovementInput(),
  attemptStep: (direction, { durationMs }) => performMovementStep(direction, durationMs),
  onIntentChange: (direction, active) => renderer.setPlayerMovement(direction, active),
  onIdle: () => renderer.updatePlayerMovementState?.()
});

function canAcceptMovementInput() {
  return Boolean(
    state.player
    && state.map
    && !state.inCombat
    && !isPanelOpen()
  );
}

function resetMovementInput({ snapPlayer = true } = {}) {
  movementController.reset();
  renderer.stopAllMovement({ snapPlayer });
}

function performMovementStep(direction, durationMs) {
  const offset = DIRECTION_OFFSETS[direction];
  if (!offset) return { moved: false };
  return attemptMove(offset.dx, offset.dy, { direction, durationMs });
}

function directionFromDelta(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

function getCastleCrisisStage() {
  return state.character?.getQuestStage?.('castle_crisis') || 0;
}

function isThroneRoomAmbushPending() {
  return Boolean(
    state.character
    && !state.throneIntroComplete
    && getCastleCrisisStage() < 2
  );
}

function syncThroneRoomEnemies() {
  const castle = state.world.maps.castle;
  if (!castle) return [];
  return syncThroneAmbushNpcs(castle, {
    castleCrisisStage: getCastleCrisisStage(),
    throneIntroComplete: state.throneIntroComplete
  });
}

function beginThroneRoomAmbush(aggressor = null, { reason = 'proximity' } = {}) {
  if (
    !state.character
    || state.map?.id !== 'castle'
    || state.inCombat
    || !isThroneRoomAmbushPending()
  ) {
    return false;
  }

  resetMovementInput();
  if (getCastleCrisisStage() === 0) {
    setQuestStageAndRefresh('castle_crisis', 1);
  }

  const enemyName = aggressor?.name || 'Gargoyle raiders';
  const battleCry = aggressor?.hostileLine || 'The Orb will leave this hall with us.';
  log(`${enemyName}: “${battleCry}”`);
  if (reason === 'collision') {
    log('The raider blocks your path and lunges.');
  } else if (reason === 'talk') {
    log('Your challenge draws the whole raiding party into battle.');
  } else {
    log('Three gargoyle raiders close around the royal dais.');
  }

  renderer.playHostileAlert?.(aggressor);
  autoSave('throne-ambush-start');
  void startSpecialEncounter(THRONE_AMBUSH_GROUP);
  return true;
}

// --- GAME LOOP FOR AI ---
setInterval(() => {
  if (!state.map || state.inCombat || isPanelOpen()) return;

  state.map.npcs.forEach((npc) => {
    if (npc.behavior === 'wander' && Math.random() < 0.2) {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      attemptNPCMove(npc, dx, dy);
    }
  });

  renderGame();
}, 800);

function attemptNPCMove(npc, dx, dy) {
  const targetX = npc.x + dx;
  const targetY = npc.y + dy;
  if (!state.map.inBounds(targetX, targetY)) return;
  if (!state.map.isWalkable(targetX, targetY)) return;
  if (state.player.position.x === targetX && state.player.position.y === targetY) return;
  if (state.map.npcs.some((other) => other !== npc && other.x === targetX && other.y === targetY)) return;

  const from = renderer.getNpcRenderPosition?.(npc) || { x: npc.x, y: npc.y };
  npc.facing = directionFromDelta(dx, dy);
  npc.motion = {
    fromX: from.x,
    fromY: from.y,
    toX: targetX,
    toY: targetY,
    startedAt: performance.now(),
    durationMs: NPC_MOVE_DURATION_MS
  };
  npc.x = targetX;
  npc.y = targetY;
}

function buildResourcePanel() {
  if (!state.character) return {};
  const char = state.character;
  const maxHP = Math.round(char.maxHP || 0);
  const maxMP = Math.round(char.maxMP || 0);
  const currentHP = Math.round(char.currentHP || 0);
  const currentMP = Math.round(char.currentMP || 0);
  const backpackWeight = (char.backpackWeight || 0).toFixed(1);
  const carryCapacity = ((char.stats?.STR || 10) * 2).toFixed(1);

  return {
    HP: `${currentHP}/${maxHP}`,
    MP: `${currentMP}/${maxMP}`,
    XP: `${char.xp}/${char.xpThreshold}`,
    Load: `${backpackWeight}/${carryCapacity}`,
    'Stat Pts': char.unspentStatPoints
  };
}

function log(message) {
  const stamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const now = Date.now();
  if (state.lastLogMessage === message && now - (state.lastLogAt || 0) < 900) return;
  state.lastLogMessage = message;
  state.lastLogAt = now;
  state.messageLog.push(`${stamp} — ${message}`);
  if (state.messageLog.length > 12) state.messageLog.shift();
  messageLogEl.innerHTML = state.messageLog.map((line) => `<div>${line}</div>`).join('');
  messageLogEl.scrollTop = messageLogEl.scrollHeight;
}

function updateHUD() {
  if (!state.character) return;
  hud.name.textContent = state.character.name;
  hud.level.textContent = `${state.character.level}`;
  hud.hp.textContent = `${state.character.currentHP} / ${state.character.maxHP}`;
  hud.mp.textContent = `${state.character.currentMP} / ${state.character.maxMP}`;
  hud.xp.textContent = `${state.character.xp} / ${state.character.xpThreshold}`;
  hud.area.textContent = state.map ? state.map.name : 'Unknown';
  if (hud.gold) hud.gold.textContent = `${state.character.gold || 0}`;
  updateObjectivePanel();
  updateDungeonNavigator();
}

function getObjectiveState() {
  if (!state.character || !state.map) {
    return {
      hidden: true,
      text: 'Create your hero to begin.',
      tip: 'Hold WASD or Arrow keys to move. T to talk. G to get. O for Orb. X for Codex.'
    };
  }

  if (state.inCombat) {
    const enemyName = combatEngine.enemy?.name || 'your foe';
    const combatSnapshot = typeof combatEngine.getSnapshot === 'function' ? combatEngine.getSnapshot() : null;
    const combatAdvice = typeof combatEngine.getCurrentAdvice === 'function' ? combatEngine.getCurrentAdvice() : null;
    const isThroneAmbush = combatSnapshot?.onboarding || combatEngine.category === THRONE_AMBUSH_GROUP;
    const isGuardianBattle = combatEngine.category === 'dungeon_boss';
    return {
      hidden: false,
      text: isThroneAmbush
        ? `Throne ambush: read ${combatAdvice?.intent || 'the intent'}, then use ${combatAdvice?.counter || 'the highlighted counter'}.`
        : isGuardianBattle
          ? 'The Guardian chose battle. Defeat it to reach the stolen relics.'
          : `Battle ${enemyName}. Use melee, bow, spell, defend, or an item to survive.`,
      tip: isThroneAmbush
        ? `${combatAdvice?.defend || '4 Defend'} can turn the attack aside and create an opening. ${combatAdvice?.shortcuts || 'Use 1-6 for combat actions.'}`
        : 'Combat buttons are available during battle. Storm Cloak blocks Reaper lightning.'
    };
  }

  if (!state.throneIntroComplete) {
    const raid = getThroneAmbushStatus(state.world.maps.castle);
    const raiderLabel = raid.count === 1 ? 'raider blocks' : 'raiders block';
    return {
      hidden: false,
      text: raid.count
        ? `${raid.count} gargoyle ${raiderLabel} the royal dais. Protect Lord British.`
        : 'Clear the throne room ambush, then speak to Lord British.',
      tip: raid.count
        ? 'Move toward a raider or press T while facing one to engage. Combat still uses the Enemy Intent tutorial.'
        : 'Read the Enemy Intent card. Use the highlighted counter, or press 4 Defend to create an opening.'
    };
  }

  const orbStage = getOrbQuestStage(state.character);
  const step = getOrbQuestStep(orbStage);
  let text = step.objective;
  let tip = step.tip;

  if (orbStage === ORB_QUEST_STAGE.RECOVER_RELICS) {
    const missing = getMissingRelics(state.character);
    text = missing.length
      ? `Recover the remaining relic${missing.length > 1 ? 's' : ''}: ${missing.join(' and ')}.`
      : step.objective;
  }

  if (orbStage === ORB_QUEST_STAGE.COMPLETE) {
    const ending = getOrbEnding(state);
    text = `Vertical slice complete — ${ending.title}.`;
    tip = 'Your ending is saved. Press J to review the journey.';
  }

  return { hidden: false, text, tip };
}

function updateObjectivePanel() {
  if (!objectivePanel || !objectiveText || !objectiveTip) return;
  const objective = getObjectiveState();
  objectivePanel.classList.toggle('hidden', objective.hidden);
  objectiveText.textContent = objective.text;
  objectiveTip.textContent = objective.tip;
}

function getDungeonExitTransition() {
  if (!state.map || state.map.id !== 'dungeon_1') return null;
  return state.map.transitions?.find((transition) => transition.map === 'overworld') || null;
}

function getDungeonExitHint() {
  const exit = getDungeonExitTransition();
  if (!exit || !state.player) return null;
  const dx = exit.x - state.player.position.x;
  const dy = exit.y - state.player.position.y;
  const horizontal = dx > 0 ? 'east' : dx < 0 ? 'west' : '';
  const vertical = dy > 0 ? 'south' : dy < 0 ? 'north' : '';
  const direction = horizontal && vertical ? `${vertical}-${horizontal}` : (horizontal || vertical || 'here');
  return { direction, onExit: dx === 0 && dy === 0 };
}

function updateDungeonNavigator() {
  if (!dungeonNavEl) return;
  const hint = getDungeonExitHint();
  if (!hint) {
    dungeonNavEl.classList.add('hidden');
    dungeonNavEl.innerHTML = '';
    return;
  }
  dungeonNavEl.classList.remove('hidden');
  const prompt = state.pendingTransition || hint.onExit
    ? 'Press Enter to leave for the Britannian Wilderness.'
    : `Exit is ${hint.direction}. Move carefully.`;
  dungeonNavEl.innerHTML = `<strong>Dark Caverns Exit</strong><div class="subtle">${prompt}</div>`;
}

function refreshQuestViews() {
  updateObjectivePanel();
  if (!panels.journal.classList.contains('hidden')) renderJournal();
}

function setQuestStageAndRefresh(questId, stage) {
  if (!state.character) return false;
  let changed = false;
  if (questId === ORB_QUEST_ID) {
    changed = advanceOrbQuest(state.character, stage);
  } else if (state.character.getQuestStage(questId) !== stage) {
    state.character.setQuestStage(questId, stage);
    changed = true;
  }
  refreshQuestViews();
  return changed;
}

function isPanelOpen() {
  return Object.values(panels).some((panel) => panel && !panel.classList.contains('hidden'))
    || !dialogueEl.classList.contains('hidden');
}

function closeAllPanels() {
  if (typeof combatEngine?.closeItemMenu === 'function') combatEngine.closeItemMenu();
  Object.values(panels).forEach((panel) => panel?.classList.add('hidden'));
  dialogueEl.classList.add('hidden');
  hideTooltip();
}

function closeTopOverlay() {
  if (state.inCombat && typeof combatEngine?.isItemMenuOpen === 'function' && combatEngine.isItemMenuOpen()) {
    combatEngine.closeItemMenu();
    return true;
  }
  if (!dialogueEl.classList.contains('hidden')) {
    dialogueEl.classList.add('hidden');
    state.currentConversationPartner = null;
    return true;
  }
  const openPanel = Object.entries(panels).find(([, panel]) => panel && !panel.classList.contains('hidden'));
  if (openPanel) {
    openPanel[1].classList.add('hidden');
    return true;
  }
  return false;
}

function openPanel(name) {
  if (!panels[name]) return;
  resetMovementInput();
  if (name === 'orb' && !state.character?.hasItem('orb_of_moons')) {
    log('The Orb of Moons has not yet been recovered.');
    return;
  }
  if (name === 'inventory') renderInventory();
  if (name === 'character') renderCharacterSheet();
  if (name === 'menu') updateMenuStatus();
  if (name === 'journal') renderJournal();
  if (name === 'codex') renderCodex();
  if (name === 'orb') renderOrbChooser();
  panels[name].classList.remove('hidden');
}

function renderJournal() {
  const content = journalEl.querySelector('#journal-content');
  content.innerHTML = '';
  if (!state.character) return;

  const quests = state.character.quests;
  let hasQuests = false;

  Object.keys(quests).forEach((questId) => {
    const stage = quests[questId];
    if (stage <= 0) return;
    const questData = QuestManager.getQuest(questId);
    if (!questData) return;

    hasQuests = true;
    const entry = document.createElement('div');
    entry.className = 'quest-entry';
    const completionStage = QuestManager.getCompletionStage(questId);
    let stageText = questData.stages?.[stage] || questData.stages?.[0] || 'Unknown progress.';

    if (questId === ORB_QUEST_ID && stage >= ORB_QUEST_STAGE.COMPLETE) {
      const ending = getOrbEnding(state);
      stageText += `<br><br><strong>${ending.title}</strong><br>${ending.guardianSummary}<br>Final counsel: ${ending.counsel}.`;
    }

    entry.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
        <div>
          <h3 style="margin:0 0 4px; color:#4a2c10;">${questData.title}</h3>
          <p style="margin:0; font-style:italic; color:#5a4326;">${questData.description}</p>
        </div>
        <span style="font-size:11px; font-weight:bold; color:${stage >= completionStage ? '#2f6b36' : '#7a5a22'};">${stage >= completionStage ? 'Completed' : 'Active'}</span>
      </div>
      <div style="margin-top:8px; padding:10px; border-radius:8px; background:rgba(255,255,255,.3); border:1px solid rgba(92,60,30,.18); font-size:.92em; line-height:1.45;">
        ${stageText}
      </div>
    `;
    content.appendChild(entry);
  });

  if (!hasQuests) {
    content.innerHTML = '<p style="text-align:center; color:#666; margin-top:32px;">No active quests.</p>';
  }
}

function togglePanel(name) {
  if (!panels[name]) return;
  if (panels[name].classList.contains('hidden')) {
    closeAllPanels();
    openPanel(name);
  } else {
    panels[name].classList.add('hidden');
  }
}

function showVerticalSliceEnding() {
  if (!state.orbQuest?.complete) return;
  resetMovementInput();
  const ending = getOrbEnding(state);
  endingEl.querySelector('#ending-title').textContent = ending.title;
  endingEl.querySelector('#ending-consequence').textContent = ending.consequence;
  endingEl.querySelector('#ending-guardian').textContent = ending.guardianSummary;
  endingEl.querySelector('#ending-counsel').textContent = ending.counsel;
  closeAllPanels();
  endingEl.classList.remove('hidden');
}

function renderGame() {
  if (!state.map || !state.player) return;

  if (state.lookHighlight && state.lookHighlight.expires < Date.now()) {
    state.lookHighlight = null;
  }

  renderer.render(state.map, state.player, {
    highlight: state.lookHighlight,
    npcs: state.map.npcs,
    objects: state.map.objects,
    hud: {
      resources: buildResourcePanel(),
      castleLevel: state.character?.level || 1
    }
  });
  updateObjectivePanel();
  updateDungeonNavigator();
}

function renderCodex() {
  if (!codexContent) return;
  codexContent.innerHTML = `
    <p style="margin-top: 0;">The codex records how to survive Britannia's deeper threats.</p>
    <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
      <li><strong>Gargoyle:</strong> aggressive melee pressure. Use bow shots to keep distance.</li>
      <li><strong>Reaper:</strong> lightning bolts. A Storm Cloak can nullify the shock.</li>
      <li><strong>Drake:</strong> high HP and fire breath. Spell damage works best when safe.</li>
      <li><strong>Gazer:</strong> burst magic. Defend if it starts charging.</li>
    </ul>
  `;
}

function renderOrbChooser() {
  if (!orbContent) return;
  const destinations = getOrbDestinations();
  if (!destinations.length) {
    orbContent.innerHTML = '<p>No destinations are currently attuned.</p>';
    return;
  }
  orbContent.innerHTML = `
    <p style="margin-top: 0;">Choose a moon gate destination.</p>
    <div class="inventory-list">
      ${destinations.map((dest) => `
        <div class="inventory-item">
          <div class="inventory-item-header">
            <strong>${dest.label}</strong>
            <span>${dest.mapId === state.map?.id ? 'Here' : 'Go'}</span>
          </div>
          <div style="font-size: 12px; color: #cdd9ff;">${dest.note}</div>
          <button data-orb-destination="${dest.mapId}" ${dest.mapId === state.map?.id ? 'disabled' : ''}>Travel</button>
        </div>
      `).join('')}
    </div>
  `;
}

function getOrbDestinations() {
  const mapList = [
    { mapId: 'castle', label: 'Castle Britannia', spawn: 'castle_gate', note: 'Return to Lord British.' },
    { mapId: 'castle_bedroom', label: 'Royal Quarters', spawn: 'bedroom_door', note: 'Search the bedroom for supplies.' },
    { mapId: 'village', label: 'Britanny Bay', spawn: 'village_road', note: 'Visit the village and the cave path.' },
    { mapId: 'lycaeum_entrance', label: 'The Lycaeum', spawn: 'lycaeum_gateway', note: 'Speak with Mariah.' },
    { mapId: 'dungeon_1', label: 'Dark Caverns', spawn: 'entry', note: 'Return to the stolen relics.' }
  ];
  return mapList.filter((entry) => state.world.maps[entry.mapId]);
}

function celebrateCastle(force = false) {
  if (!state.map || state.map.id !== 'castle' || !state.player) return;
  const now = performance.now();
  if (!force && state.fx.lastCastleBurst && now - state.fx.lastCastleBurst < 1200) return;
  state.fx.lastCastleBurst = now;

  const { x, y } = state.player.position;
  requestAnimationFrame(() => {
    const rect = renderer.getMapScreenRect();
    if (!rect.width) return;
    const centerX = rect.x + (x + 0.5) * renderer.tileSize;
    const centerY = rect.y + (y + 0.5) * renderer.tileSize;

    renderer.shakeCamera(4, 0.2);
    for (let i = 0; i < 20; i += 1) {
      particles.spawn(centerX, centerY, {
        vx: (Math.random() - 0.5) * 20,
        vy: -25 - Math.random() * 15,
        life: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 2,
        color: '#ffd700'
      });
    }
  });
}

function showTooltip(event, text) {
  tooltip.textContent = text;
  tooltip.classList.remove('hidden');
  tooltip.style.left = `${event.clientX + 10}px`;
  tooltip.style.top = `${event.clientY + 10}px`;
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

function getItemTooltip(item) {
  const lines = [item.name, item.type];
  if (item.stats) {
    const stats = Object.entries(item.stats)
      .filter(([, value]) => Number.isFinite(value) && value !== 0)
      .map(([key, value]) => `${key}: ${value}`);
    if (stats.length) lines.push(stats.join(', '));
  }
  if (item.effect?.type) lines.push(`Effect: ${item.effect.type}`);
  if (item.effects) lines.push('Special effect');
  return lines.join('\n');
}

function renderInventory() {
  if (!state.character) return;
  inventoryList.innerHTML = '';
  state.character.inventory.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'inventory-item';
    const equipped = state.character.equipment[item.type]
      && state.character.equipment[item.type].id === item.id;
    const canEquip = ['weapon', 'armor', 'accessory'].includes(item.type);
    const canUse = Boolean(
      item.effect?.type
      || item.useAction
      || item.type === 'consumable'
      || item.id === 'orb_of_moons'
      || item.id === 'tactics_codex'
    );
    div.innerHTML = `
      <div class="inventory-item-header">
        <strong>${item.name}</strong>
        <span>x${item.quantity || 1}${equipped ? ' equipped' : ''}</span>
      </div>
      <div style="font-size: 12px; color: #cdd9ff; white-space: pre-wrap;">${getItemTooltip(item)}</div>
      <div class="inventory-item-actions">
        ${canEquip ? `<button data-item-action="equip" data-item-id="${item.id}">${equipped ? 'Equipped' : 'Equip'}</button>` : ''}
        ${canUse ? `<button data-item-action="use" data-item-id="${item.id}">Use</button>` : ''}
      </div>
    `;
    inventoryList.appendChild(div);
  });
  inventoryCapacity.textContent = `${state.character.backpackWeight.toFixed(1)} / ${(state.character.stats.STR * 2).toFixed(1)}`;
}

function renderCharacterSheet() {
  if (!state.character) return;
  const eq = state.character.equipment;
  characterSummary.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">Lvl ${state.character.level} ${state.character.name}</div>
    <div style="margin-bottom: 8px;">HP ${state.character.currentHP}/${state.character.maxHP} | MP ${state.character.currentMP}/${state.character.maxMP}</div>
    <div style="margin-bottom: 8px;">Gold ${state.character.gold || 0}</div>
    <div style="font-size: 12px; color: #cdd9ff;">
      Weapon: ${eq.weapon?.name || 'None'}<br />
      Armor: ${eq.armor?.name || 'None'}<br />
      Accessory: ${eq.accessory?.name || 'None'}
    </div>
  `;
}

function updateMenuStatus() {
  if (menuLastSave) menuLastSave.textContent = formatTimestamp(state.lastSaveTimestamp);
}

function useConsumable(item) {
  if (!item || !state.character) return false;
  if (item.effect?.type === 'heal') {
    state.character.heal(item.effect.amount);
    log(`You drink ${item.name} and recover ${item.effect.amount} HP.`);
    state.character.removeItem(item.id, 1);
    updateHUD();
    renderInventory();
    renderCharacterSheet();
    autoSave('item-used');
    return true;
  }
  if (item.effect?.type === 'restore_mana') {
    state.character.restoreMana(item.effect.amount);
    log(`You drink ${item.name} and recover ${item.effect.amount} MP.`);
    state.character.removeItem(item.id, 1);
    updateHUD();
    renderInventory();
    renderCharacterSheet();
    autoSave('item-used');
    return true;
  }
  return false;
}

function equipInventoryItem(itemId) {
  if (!state.character) return;
  const result = state.character.equipItem(itemId);
  if (!result.success) {
    log(result.reason || 'Could not equip item.');
  } else {
    log('Item equipped.');
    updateHUD();
    renderInventory();
    renderCharacterSheet();
    autoSave('item-equipped');
  }
}

function openCodexFromItem() {
  closeAllPanels();
  openPanel('codex');
}

function openOrbFromItem() {
  closeAllPanels();
  openPanel('orb');
}

function handleInventoryAction(action, itemId) {
  if (!state.character) return;
  const item = state.character.findItem(itemId);
  if (!item) return;

  if (action === 'equip') {
    equipInventoryItem(itemId);
    return;
  }

  if (item.effect?.type === 'heal' || item.effect?.type === 'restore_mana') {
    if (useConsumable(item)) return;
  }

  if (item.id === 'storm_cloak' || item.type === 'accessory') {
    equipInventoryItem(itemId);
    return;
  }

  if (item.id === 'tactics_codex' || item.effect?.type === 'open_codex' || item.useAction === 'open_codex') {
    openCodexFromItem();
    return;
  }

  if (item.id === 'orb_of_moons' || item.effect?.type === 'orb_travel' || item.useAction === 'orb_travel') {
    openOrbFromItem();
    return;
  }

  log('Nothing happens.');
}

function removeMapObjectByItemId(map, itemId) {
  if (!map?.objects) return;
  map.objects = map.objects.filter((object) => object.data?.id !== itemId);
}

function removeGuardianFromDungeon() {
  const dungeon = state.world.maps.dungeon_1;
  if (!dungeon?.npcs) return;
  dungeon.npcs = dungeon.npcs.filter((npc) => npc.id !== 'gargoyle_guardian');
}

function applyOrbQuestWorldState() {
  if (!state.character) return;
  const dungeon = state.world.maps.dungeon_1;
  if (!dungeon) return;

  if (state.character.hasItem('orb_of_moons')) {
    removeMapObjectByItemId(dungeon, 'orb_of_moons');
  }
  if (state.character.hasItem('gargoyle_tablet')) {
    removeMapObjectByItemId(dungeon, 'gargoyle_tablet');
  }
  if (state.orbQuest?.guardianResolution === 'combat') {
    removeGuardianFromDungeon();
  }
}

function changeMap(mapId, spawnTag, x, y) {
  const map = state.world.maps[mapId];
  if (!map || !state.player) return;
  resetMovementInput();
  if (mapId === 'castle') syncThroneRoomEnemies();
  state.map = map;
  state.discoveredAreas.add(mapId);
  const shouldFaceNorth = mapId === 'castle'
    && spawnTag === 'castle_gate'
    && !(x !== undefined && y !== undefined);

  if (x !== undefined && y !== undefined) {
    state.player.map = map;
    state.player.setPosition(x, y);
  } else {
    state.player.setMap(map, spawnTag);
  }
  if (shouldFaceNorth) state.player.facing = 'north';

  state.pendingTransition = null;
  updateHUD();
  renderGame();
  autoSave('area-transition');
}

function getNPCAt(x, y) {
  if (!state.map?.npcs) return null;
  return state.map.npcs.find((npc) => npc.x === x && npc.y === y) || null;
}

function getItemAt(x, y) {
  if (!state.map?.objects) return null;
  return state.map.objects.find((object) => object.type === 'item' && object.x === x && object.y === y) || null;
}

function attemptMove(dx, dy, { direction = directionFromDelta(dx, dy), durationMs = 118 } = {}) {
  if (!state.player || !state.map || state.inCombat) return { moved: false };
  if (isPanelOpen() && dialogueEl.classList.contains('hidden')) return { moved: false };

  state.player.face(direction);
  const targetX = state.player.position.x + dx;
  const targetY = state.player.position.y + dy;

  if (!state.map.inBounds(targetX, targetY)) {
    const transitioned = handleEdgeWarp(dx, dy);
    if (!transitioned) renderGame();
    return { moved: false, transitioned };
  }

  const npc = getNPCAt(targetX, targetY);
  if (npc) {
    if (isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()) {
      renderer.playBlockedStep?.(direction);
      const encounterStarted = beginThroneRoomAmbush(npc, { reason: 'collision' });
      renderGame();
      return {
        moved: false,
        blocked: true,
        reason: 'hostile',
        encounterStarted
      };
    }

    const now = Date.now();
    if (!state.lastBlockedLog || now - state.lastBlockedLog > 900) {
      log(`Blocked by: ${npc.name}. Press T to talk.`);
      state.lastBlockedLog = now;
    }
    renderer.playBlockedStep?.(direction);
    renderGame();
    return { moved: false, blocked: true, reason: 'npc' };
  }

  const moved = state.player.move(dx, dy, { durationMs });
  if (!moved) {
    const tile = state.map.getTile(targetX, targetY);
    const def = TileInfo[tile];
    const now = Date.now();
    if (def && (!state.lastBlockedLog || now - state.lastBlockedLog > 900)) {
      log(`Blocked: ${def.name}`);
      state.lastBlockedLog = now;
    }
    renderer.playBlockedStep?.(direction);
    renderGame();
    return { moved: false, blocked: true, reason: 'terrain' };
  }

  renderer.beginPlayerStep?.(direction, durationMs);

  const item = getItemAt(targetX, targetY);
  if (item) {
    log(`You see ${item.data ? item.data.name : 'an item'} here. (Press G to get)`);
  }

  if (!dialogueEl.classList.contains('hidden')) {
    dialogueEl.classList.add('hidden');
    state.currentConversationPartner = null;
  }
  renderGame();
  updateHUD();
  handleTileEvents();
  return { moved: true };
}

function handleEdgeWarp(dx, dy) {
  const direction = directionFromDelta(dx, dy);
  const adj = state.map.adjacencies?.[direction];
  if (!adj) return false;

  const targetMapId = typeof adj === 'string' ? adj : adj.map;
  const xOffset = typeof adj === 'string' ? 0 : (adj.xOffset || 0);
  const yOffset = typeof adj === 'string' ? 0 : (adj.yOffset || 0);
  const targetMap = state.world.maps[targetMapId];
  if (!targetMap) return false;

  let newX = state.player.position.x + xOffset;
  let newY = state.player.position.y + yOffset;

  if (direction === 'north') newY = targetMap.height - 1;
  if (direction === 'south') newY = 0;
  if (direction === 'west') newX = targetMap.width - 1;
  if (direction === 'east') newX = 0;

  newX = Math.max(0, Math.min(targetMap.width - 1, newX));
  newY = Math.max(0, Math.min(targetMap.height - 1, newY));

  if (typeof adj === 'string' || !adj.silent) {
    log(`You travel ${direction} towards ${targetMap.name || targetMapId}.`);
  }

  changeMap(targetMapId, null, newX, newY);
  return true;
}

function handleTalk() {
  if (!state.player) return;
  const offset = DIRECTION_OFFSETS[state.player.facing || 'south'];
  const targetX = state.player.position.x + offset.dx;
  const targetY = state.player.position.y + offset.dy;
  const npc = getNPCAt(targetX, targetY);
  if (npc && isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()) {
    beginThroneRoomAmbush(npc, { reason: 'talk' });
    return;
  }
  if (npc) {
    showDialogue(npc);
  } else {
    log('There is no one there.');
  }
}

function handleGet() {
  if (!state.player || !state.map?.objects) return;
  const { x, y } = state.player.position;
  const objIndex = state.map.objects.findIndex(
    (object) => object.type === 'item' && object.x === x && object.y === y
  );
  if (objIndex === -1) {
    log('There is nothing here to take.');
    return;
  }

  const object = state.map.objects[objIndex];
  const itemData = object.data || { name: 'Unknown Item', type: 'misc', weight: 1 };
  const isOrbRelic = itemData.id === 'orb_of_moons' || itemData.id === 'gargoyle_tablet';

  if (isOrbRelic && !state.orbQuest?.guardianResolution) {
    log('The Guardian bars access to the relics. Resolve the confrontation first.');
    if (getOrbQuestStage(state.character) >= ORB_QUEST_STAGE.REACH_CAVERNS) {
      setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.FACE_GUARDIAN);
    }
    return;
  }

  const added = state.character.addItem(itemData);
  if (!added) {
    log('You cannot carry that.');
    return;
  }

  state.map.objects.splice(objIndex, 1);
  log(`You picked up: ${itemData.name}`);

  if (isOrbRelic) {
    syncOrbQuestProgress(state);
    const missing = getMissingRelics(state.character);
    if (missing.length) {
      log(`Journal Updated: recover ${missing.join(' and ')}.`);
    } else {
      log('Journal Updated: both relics recovered. Return to Mariah.');
    }
    autoSave('orb-relic-recovered');
  } else {
    autoSave('item-picked-up');
  }

  renderGame();
  updateHUD();
  renderInventory();
  refreshQuestViews();
}

function getDialogueOpening(npc) {
  const orbStage = getOrbQuestStage(state.character);

  if (npc.id === 'mariah') {
    if (orbStage === ORB_QUEST_STAGE.SEEK_MARIAH) {
      return 'Lord British sent you? Then ask me of the PROPHECY. We must understand why the Gargoyles took the Orb.';
    }
    if (orbStage === ORB_QUEST_STAGE.TRANSLATE_TABLET && state.character.hasItem('gargoyle_tablet')) {
      return 'You carry the Gargoyle Tablet. Speak the keyword TABLET, and I shall attempt its translation.';
    }
    if (orbStage >= ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH) {
      return 'The warning is now known. Lord British must hear what the Gargoyles believe the False Prophet will do.';
    }

    const wisdomStage = state.character.getQuestStage('wisdom_of_lycaeum');
    if (wisdomStage >= 2) {
      return 'The scrolls of Truth contain mysteries yet to be unraveled. Bring me any evidence of the Gargoyles’ purpose.';
    }
    return "I am Mariah. Many in the Lycaeum speak of your arrival. Tell me, what lies at the heart of our wisdom?";
  }

  if (npc.id === 'lord_british') {
    if (orbStage === ORB_QUEST_STAGE.NOT_STARTED) {
      return 'The throne room is safe, but Britannia faces a deeper crisis. Ask me of the ORB.';
    }
    if (orbStage === ORB_QUEST_STAGE.SEEK_MARIAH) {
      return 'Go to the Lycaeum, Avatar. Ask Mariah about the PROPHECY behind this theft.';
    }
    if (orbStage >= ORB_QUEST_STAGE.REACH_CAVERNS && orbStage < ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH) {
      return 'Follow the truth wherever it leads. Return when the Orb and the Gargoyles’ purpose are understood.';
    }
    if (orbStage === ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH) {
      return 'You have returned with grave knowledge. Tell me of this MISUNDERSTANDING.';
    }
    if (orbStage === ORB_QUEST_STAGE.CHOOSE_RESPONSE) {
      return 'Britannia must now decide. Counsel PEACE, CAUTION, or DEFENCE.';
    }
    if (orbStage === ORB_QUEST_STAGE.COMPLETE) {
      const ending = getOrbEnding(state);
      return `Your counsel has shaped our first response. ${ending.consequence}`;
    }
  }

  if (npc.id === 'gargoyle_guardian') {
    if (state.orbQuest?.guardianResolution === 'diplomacy') {
      return 'You listened when another might have struck. Take the relics, but do not forget that two worlds now watch your choices.';
    }
    if (state.orbQuest?.guardianResolution === 'combat') {
      return 'The Guardian no longer stands here.';
    }
    return 'Stay back, False Prophet! Seek UNDERSTANDING of our plight, or choose to FIGHT for the Orb.';
  }

  if (typeof npc.dialogue === 'function') return npc.dialogue(state);
  return npc.dialogue || 'Greetings traveler.';
}

function showDialogue(npc) {
  if (!npc || !state.character) return;
  if (isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()) {
    beginThroneRoomAmbush(npc, { reason: 'talk' });
    return;
  }
  resetMovementInput();
  state.currentConversationPartner = npc;
  dialogueEl.classList.remove('hidden');
  dialogueInputContainer.classList.remove('hidden');

  if (
    npc.id === 'gargoyle_guardian'
    && !state.orbQuest?.guardianResolution
    && getOrbQuestStage(state.character) >= ORB_QUEST_STAGE.REACH_CAVERNS
  ) {
    setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.FACE_GUARDIAN);
  }

  dialogueText.textContent = `“${getDialogueOpening(npc)}”`;
  updateDialogueKeywords(npc);
}

function getContextualDialogueKeywords(npc) {
  const orbStage = getOrbQuestStage(state.character);
  const contextual = [];

  if (npc.id === 'lord_british') {
    if (orbStage === ORB_QUEST_STAGE.NOT_STARTED) contextual.push('ORB');
    if (orbStage === ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH) contextual.push('MISUNDERSTANDING');
    if (orbStage === ORB_QUEST_STAGE.CHOOSE_RESPONSE) contextual.push('PEACE', 'CAUTION', 'DEFENCE');
  }

  if (npc.id === 'mariah') {
    if (orbStage === ORB_QUEST_STAGE.SEEK_MARIAH) contextual.push('PROPHECY');
    if (orbStage === ORB_QUEST_STAGE.TRANSLATE_TABLET && state.character.hasItem('gargoyle_tablet')) {
      contextual.push('TABLET');
    }
  }

  if (npc.id === 'gargoyle_guardian' && !state.orbQuest?.guardianResolution) {
    contextual.push('UNDERSTANDING', 'FIGHT');
  }

  return contextual;
}

function updateDialogueKeywords(npc) {
  dialogueKeywords.innerHTML = '';
  const defaults = ['NAME', 'JOB'];
  const npcKeywords = npc.responses ? Object.keys(npc.responses) : [];
  const keywords = [...new Set([
    ...defaults,
    ...getContextualDialogueKeywords(npc),
    ...npcKeywords,
    'BYE'
  ])];

  keywords.forEach((keyword) => {
    const button = document.createElement('button');
    button.textContent = keyword;
    button.style.cssText = `
      background: rgba(74, 60, 42, 0.6);
      color: #dcb678;
      border: 1px solid rgba(220,182,120,0.4);
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
      font-family: inherit;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;
    button.onmouseover = () => {
      button.style.background = 'rgba(220,182,120,0.2)';
      button.style.borderColor = 'rgba(220,182,120,0.8)';
    };
    button.onmouseout = () => {
      button.style.background = 'rgba(74, 60, 42, 0.6)';
      button.style.borderColor = 'rgba(220,182,120,0.4)';
    };
    button.onclick = () => handleDialogueSubmit(keyword);
    dialogueKeywords.appendChild(button);
  });
}

function completeOrbQuest(decision) {
  if (!Object.values(ORB_QUEST_DECISION).includes(decision)) return false;
  if (getOrbQuestStage(state.character) !== ORB_QUEST_STAGE.CHOOSE_RESPONSE) return false;

  state.orbQuest.finalDecision = decision;
  state.orbQuest.complete = true;
  setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.COMPLETE);
  autoSave('vertical-slice-complete');
  log('The Stolen Orb is complete. Your counsel has been recorded.');
  showVerticalSliceEnding();
  return true;
}

function handleDialogueSubmit(selectedKeyword) {
  const npc = state.currentConversationPartner;
  const input = (selectedKeyword || '').trim().toUpperCase();
  if (!npc || !input || !state.character) return;

  if (input === 'BYE') {
    dialogueEl.classList.add('hidden');
    state.currentConversationPartner = null;
    return;
  }

  let response = 'I do not know of that.';
  if (input === 'NAME') {
    response = `I am called ${npc.name}.`;
  } else if (input === 'JOB') {
    response = npc.job || 'I have no specific trade to speak of.';
  } else if (npc.responses?.[input]) {
    response = npc.responses[input];
  }

  const orbStage = getOrbQuestStage(state.character);

  if (npc.id === 'mariah') {
    const wisdomStage = state.character.getQuestStage('wisdom_of_lycaeum');
    if (wisdomStage < 2 && (input === 'TRUTH' || input === 'KNOWING NOTHING')) {
      response = 'Indeed. Truth is the bedrock of our virtue. Take this Codex of Wisdom.';
      completeMariahQuest();
    }

    if (input === 'PROPHECY' && orbStage === ORB_QUEST_STAGE.SEEK_MARIAH) {
      state.orbQuest.mariahBriefed = true;
      setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.REACH_CAVERNS);
      response = 'The Gargoyles name a False Prophet who enters through a red moongate and brings ruin. Find their Guardian in the Dark Caverns, but listen before you decide what their fear means.';
      log('Journal Updated: seek the Gargoyle Guardian in the Dark Caverns.');
      autoSave('orb-mariah-briefing');
    }

    if (
      input === 'TABLET'
      && orbStage === ORB_QUEST_STAGE.TRANSLATE_TABLET
      && state.character.hasItem('gargoyle_tablet')
    ) {
      state.orbQuest.tabletTranslated = true;
      syncOrbQuestProgress(state);
      if (state.character.getQuestStage('wisdom_of_lycaeum') < 3) {
        state.character.setQuestStage('wisdom_of_lycaeum', 3);
      }
      response = "The runes warn that the 'False Prophet' will take their light and doom their world. They stole the Orb not for conquest, but to prevent us from reaching them. Lord British must hear this.";
      log("Journal Updated: the 'False Prophet' warning has been translated.");
      autoSave('orb-tablet-translated');
    }
  }

  if (npc.id === 'lord_british') {
    const crisisStage = state.character.getQuestStage('castle_crisis');
    if (crisisStage === 2) {
      setQuestStageAndRefresh('castle_crisis', 4);
      log("Lord British nods. 'I am deeply in your debt, Avatar.'");
      state.character.applyStatPoints({ STR: 1, DEX: 1 });
      log('Gained +1 Strength and +1 Dexterity for your valor!');
    }

    if (
      ['ORB', 'QUEST', 'GARGOYLES'].includes(input)
      && orbStage === ORB_QUEST_STAGE.NOT_STARTED
    ) {
      setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.SEEK_MARIAH);
      response = 'The Orb of Moons was taken during the attack. Go first to the Lycaeum and ask Mariah about the PROPHECY behind the theft.';
      log('Quest started: The Stolen Orb. Seek Mariah at the Lycaeum.');
      autoSave('orb-quest-start');
    }

    if (input === 'MISUNDERSTANDING' && orbStage === ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH) {
      setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.CHOOSE_RESPONSE);
      response = 'Then Justice requires more than victory. Should Britannia seek PEACE, proceed with CAUTION, or strengthen its DEFENCE?';
      log('Final decision: counsel Lord British on Britannia’s response.');
      autoSave('orb-final-choice-opened');
    }

    if (orbStage === ORB_QUEST_STAGE.CHOOSE_RESPONSE) {
      const decisionByKeyword = {
        PEACE: ORB_QUEST_DECISION.PEACE,
        CAUTION: ORB_QUEST_DECISION.CAUTION,
        DEFENCE: ORB_QUEST_DECISION.DEFENCE,
        DEFENSE: ORB_QUEST_DECISION.DEFENCE
      };
      const decision = decisionByKeyword[input];
      if (decision) {
        response = 'Your counsel is heard. Britannia will act, and history will judge what follows.';
        dialogueText.textContent = `“${response}”`;
        completeOrbQuest(decision);
        return;
      }
    }
  }

  if (npc.id === 'gargoyle_guardian' && !state.orbQuest?.guardianResolution) {
    if (input === 'UNDERSTANDING' || input === 'PROPHET') {
      state.orbQuest.guardianResolution = 'diplomacy';
      state.guardianDefeated = true;
      setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.RECOVER_RELICS);
      response = 'Then hear this: our world is fading, and your people’s stones draw away its light. Take the Orb and Tablet, but carry our warning to your king.';
      log('Path of Understanding: the Guardian allows you to pass without bloodshed.');
      autoSave('guardian-diplomacy');
    } else if (input === 'FIGHT') {
      dialogueEl.classList.add('hidden');
      state.currentConversationPartner = null;
      log('The Guardian raises its weapon. The dispute will be settled in battle.');
      autoSave('guardian-combat-start');
      void startSpecialEncounter('dungeon_boss');
      return;
    }
  }

  dialogueText.textContent = `“${response}”`;
  updateDialogueKeywords(npc);
  refreshQuestViews();
}

function completeMariahQuest() {
  log("Mariah smiles. 'The path to Truth is yours to walk.'");
  setQuestStageAndRefresh('wisdom_of_lycaeum', 2);
  state.character.applyStatPoints({ INT: 2 });
  if (!state.character.hasItem('tactics_codex')) {
    const codex = itemGenerator.createTacticsCodex();
    state.character.addItem(codex);
    log(`Received: ${codex.name}`);
  }
  log('Gained +2 Intelligence!');
  updateHUD();
  renderCharacterSheet();
  renderInventory();
  autoSave('wisdom-quest-complete');
}

function handleTileEvents() {
  const { x, y } = state.player.position;

  if (state.map.id === 'castle' && isThroneRoomAmbushPending()) {
    const aggressor = findThroneAmbushAggressor(state.map, x, y);
    if (aggressor) {
      beginThroneRoomAmbush(aggressor, { reason: 'proximity' });
      return;
    }
  }

  const transition = state.map.getTransition(x, y);
  if (transition) {
    if (state.map.id === 'dungeon_1') {
      state.pendingTransition = transition;
      updateDungeonNavigator();
      return;
    }
    changeMap(transition.map, transition.spawn);
    return;
  }

  if (state.pendingTransition) {
    state.pendingTransition = null;
    updateDungeonNavigator();
  }

  const orbStage = getOrbQuestStage(state.character);
  if (
    state.map.id === 'dungeon_1'
    && x === 6
    && y === 8
    && orbStage >= ORB_QUEST_STAGE.REACH_CAVERNS
    && orbStage <= ORB_QUEST_STAGE.FACE_GUARDIAN
    && !state.orbQuest?.guardianResolution
  ) {
    setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.FACE_GUARDIAN);
    const guardian = state.map.npcs.find((npc) => npc.id === 'gargoyle_guardian');
    log('The Guardian blocks the passage. Choose UNDERSTANDING or FIGHT.');
    autoSave('guardian-confrontation');
    if (guardian) showDialogue(guardian);
    return;
  }

  if (!state.map.safe && Math.random() < state.map.getEncounterChance(x, y)) {
    void startEncounter();
  }
}

async function startEncounter(category = null) {
  if (state.inCombat) return;
  if (isPanelOpen()) closeAllPanels();
  resetMovementInput();
  state.inCombat = true;
  let result = null;
  let enemy = null;

  try {
    const level = state.map.areaLevel || 1;
    enemy = createEnemy(category || state.map.encounterGroup || state.map.id, level);
    result = await combatEngine.start(state.player, enemy, {
      map: state.map,
      category,
      onUpdate: updateObjectivePanel
    });
    await resolveCombat(result, enemy, category);
  } catch (error) {
    console.error('Combat encounter failed:', error);
  } finally {
    state.inCombat = false;
    resetMovementInput();
    updateObjectivePanel();
    renderGame();
  }
}

async function startSpecialEncounter(category) {
  if (category === THRONE_AMBUSH_GROUP) {
    log('Combat lesson: read the Enemy Intent, use the highlighted counter, or press 4 to defend and create an opening.');
    updateObjectivePanel();
  }
  await startEncounter(category);
}

async function resolveCombat(result, enemy, category = null) {
  if (!state.character || !result || !enemy) return;

  if (result.outcome === 'victory') {
    const xp = result.xp || enemy.xpReward || 0;
    const { leveledUp } = state.character.gainXP(xp);
    if (xp > 0) log(`Gained ${xp} experience.`);

    if (result.loot?.length) {
      result.loot.forEach((item) => {
        if (item.type === 'currency') {
          state.character.gainGold(item.quantity || 0);
          log(`Found ${item.quantity} ${item.name}.`);
        } else if (state.character.addItem(item, item.quantity || 1)) {
          log(`Found ${item.name}.`);
        } else {
          log(`${item.name} was too heavy to carry.`);
        }
      });
    }

    if (leveledUp) {
      log(`Level up! You reached level ${state.character.level}.`);
      autoSave('level-up');
    }

    if (
      category === THRONE_AMBUSH_GROUP
      || (enemy.id === 'gargoyle' && state.map?.id === 'castle')
    ) {
      state.throneIntroComplete = true;
      setQuestStageAndRefresh('castle_crisis', 2);
      syncThroneRoomEnemies();
      renderer.playHostileDefeat?.();
      log('The gargoyle raiding party breaks. The throne room is clear.');
      log('Speak with Lord British when you are ready.');
      renderGame();
      autoSave('throne-ambush');
    }

    if (enemy.id === 'gargoyle_guardian' || category === 'dungeon_boss') {
      state.orbQuest.guardianResolution = 'combat';
      state.guardianDefeated = true;
      setQuestStageAndRefresh(ORB_QUEST_ID, ORB_QUEST_STAGE.RECOVER_RELICS);
      removeGuardianFromDungeon();
      log('The Guardian falls. The Orb and Tablet are now within reach.');
      autoSave('guardian-combat-victory');
    }
  } else if (result.outcome === 'defeat') {
    log('You awaken at the village, bruised but alive.');
    state.character.applyDeathPenalty();
    state.character.currentHP = Math.max(
      state.character.currentHP,
      Math.floor(state.character.maxHP * 0.6)
    );
    state.character.currentMP = Math.max(
      state.character.currentMP,
      Math.floor(state.character.maxMP * 0.4)
    );
    changeMap(state.map?.id === 'castle' ? 'castle' : 'village', state.map?.id === 'castle' ? 'castle_gate' : 'village_road');
  } else if (result.outcome === 'fled') {
    log('You fled from battle.');
  }

  updateHUD();
  renderInventory();
  renderCharacterSheet();
}

function saveGame(reason = 'manual', silent = false) {
  if (!state.character || !state.player || !state.map) return false;
  const success = SaveManager.save(state);

  if (success) {
    state.lastSaveTimestamp = Date.now();
    if (!silent) log(`Game saved (${reason}).`);
  } else if (!silent) {
    log('Saving failed.');
  }
  return success;
}

function autoSave(reason) {
  saveGame(reason, true);
}

function restoreOrbQuestState(data, character) {
  const savedQuestState = data.questState?.orbQuest;
  if (savedQuestState) {
    return createOrbQuestState(savedQuestState);
  }
  return migrateLegacyOrbQuest(character, data.flags || {});
}

function loadGame(manual = false) {
  const data = SaveManager.load();
  if (!data) {
    if (manual) log('No saved game found.');
    return false;
  }

  const character = new Character(data.character);
  const player = new Player(character);
  const mapId = data.mapId;
  const currentMap = state.world.maps[mapId] || state.world.startingMap;
  const position = data.playerPosition;

  if (position && currentMap.isWalkable(position.x, position.y)) {
    player.setPosition(position.x, position.y);
    player.map = currentMap;
  } else {
    player.setMap(currentMap, currentMap.id === 'castle' ? 'castle_gate' : undefined);
  }
  if (currentMap.id === 'castle') player.facing = 'north';

  state.character = character;
  state.player = player;
  state.map = currentMap;
  state.orbQuest = restoreOrbQuestState(data, character);
  syncOrbQuestProgress(state);
  state.guardianDefeated = Boolean(data.flags?.guardianDefeated || state.orbQuest.guardianResolution);
  state.throneIntroComplete = Boolean(
    data.flags?.throneIntroComplete
    || character.getQuestStage('castle_crisis') >= 2
  );
  state.lastSaveTimestamp = data.timestamp || null;
  state.discoveredAreas.add(currentMap.id);

  syncThroneRoomEnemies();
  applyOrbQuestWorldState();
  resetMovementInput();
  renderInventory();
  renderCharacterSheet();
  updateHUD();
  renderGame();
  if (currentMap.id === 'castle') celebrateCastle();
  log(manual ? 'Save data loaded.' : 'Journey resumed from last save.');

  if (state.orbQuest.complete) {
    requestAnimationFrame(showVerticalSliceEnding);
  }
  return true;
}

function setupEventListeners() {
  document.addEventListener('keydown', (event) => {
    if (
      event.target instanceof HTMLInputElement
      || event.target instanceof HTMLTextAreaElement
      || event.target instanceof HTMLSelectElement
      || event.target?.isContentEditable
    ) return;
    const key = event.key.toLowerCase();

    if (!dialogueEl.classList.contains('hidden')) {
      if (['escape', ' ', 'enter'].includes(key)) {
        event.preventDefault();
        dialogueEl.classList.add('hidden');
        state.currentConversationPartner = null;
      }
      return;
    }

    if (state.inCombat) {
      if (key === 'escape' && combatEngine.isItemMenuOpen()) {
        event.preventDefault();
        combatEngine.closeItemMenu();
        return;
      }
      if (combatEngine.handleKeyAction(key)) event.preventDefault();
      return;
    }

    if (key === 'escape') {
      event.preventDefault();
      closeTopOverlay();
      return;
    }

    if (key === 'enter' && state.pendingTransition && !isPanelOpen()) {
      event.preventDefault();
      const transition = state.pendingTransition;
      changeMap(transition.map, transition.spawn);
      log('You deliberately leave the Dark Caverns.');
      return;
    }

    if (KEY_TO_DIRECTION[key]) {
      event.preventDefault();
      if (!canAcceptMovementInput()) {
        movementController.reset();
        return;
      }
      movementController.handleKeyDown(key, { repeated: event.repeat });
      return;
    }

    switch (key) {
      case 't': handleTalk(); break;
      case 'g': handleGet(); break;
      case 'i': togglePanel('inventory'); break;
      case 'c': togglePanel('character'); break;
      case 'm': togglePanel('menu'); break;
      case 'j': togglePanel('journal'); break;
      case 'o': togglePanel('orb'); break;
      case 'x': togglePanel('codex'); break;
      default: break;
    }
  });

  document.addEventListener('keyup', (event) => {
    movementController.handleKeyUp(event.key);
  });

  window.addEventListener('blur', () => resetMovementInput());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetMovementInput();
  });

  document.addEventListener('click', (event) => {
    const endingAction = event.target.closest('[data-ending-action]');
    if (endingAction) {
      endingEl.classList.add('hidden');
      if (endingAction.dataset.endingAction === 'journal') {
        closeAllPanels();
        openPanel('journal');
      }
      return;
    }

    const closeButton = event.target.closest('[data-close]');
    if (closeButton) {
      closeAllPanels();
      return;
    }

    const orbButton = event.target.closest('button[data-orb-destination]');
    if (orbButton && !orbButton.disabled) {
      const mapId = orbButton.dataset.orbDestination;
      const destination = getOrbDestinations().find((entry) => entry.mapId === mapId);
      if (!destination) return;
      changeMap(destination.mapId, destination.spawn);
      closeAllPanels();
      log(`The Orb of Moons carries you to ${destination.label}.`);
    }
  });
}

window.gameApp = {
  state,
  renderer,
  creator,
  itemGenerator,
  SaveManager,
  combatEngine,
  movementController,
  startEncounter,
  startSpecialEncounter,
  resolveCombat,
  changeMap,
  renderGame,
  showDialogue,
  handleDialogueSubmit,
  handleGet,
  attemptMove,
  resetMovementInput,
  getObjectiveState,
  syncThroneRoomEnemies,
  beginThroneRoomAmbush,
  applyOrbQuestWorldState,
  showVerticalSliceEnding,
  syncOrbQuestProgress
};

async function bootstrap() {
  try {
    const atlas = await loadAtlas(null, './assets/atlas.json');
    renderer.setAtlas(atlas);
    await renderer.loadPlayerSprite(DEFAULT_PLAYER_SPRITE_SHEET, PLAYER_CHAMPION_SPRITE_OPTIONS);
  } catch (error) {
    console.warn('Failed to load assets:', error);
  }

  renderer.start();
  setupEventListeners();

  if (loadGame(false)) return;

  const character = await creator.open();
  if (!character) return;

  state.character = character;
  state.player = new Player(character);
  state.orbQuest = createOrbQuestState();

  let starterWeapon = null;
  for (let i = 0; i < 8 && !starterWeapon; i += 1) {
    const candidate = itemGenerator.createWeapon(1);
    if (state.character.canEquip(candidate)) starterWeapon = candidate;
  }
  if (!starterWeapon) {
    starterWeapon = {
      id: 'starter-rusty-blade',
      name: 'Rusty Blade',
      type: 'weapon',
      stats: { attack: 4, str_req: 8 },
      value: 0,
      stackable: false,
      weight: 1.4
    };
  }
  if (state.character.addItem(starterWeapon)) {
    state.character.equipItem(starterWeapon.id);
    log(`You begin with ${starterWeapon.name}.`);
  }

  state.map = state.world.startingMap;
  changeMap('castle', 'castle_gate');
  state.player.facing = 'north';
  state.character.addItem(itemGenerator.createHealthPotion(1));
  renderGame();
}

bootstrap();

window.render_game_to_text = () => {
  const player = state.player;
  const enemy = combatEngine.enemy;
  const objective = state.character ? getObjectiveState() : null;
  const combatSnapshot = typeof combatEngine.getSnapshot === 'function'
    ? combatEngine.getSnapshot()
    : null;
  const orbStage = state.character ? getOrbQuestStage(state.character) : ORB_QUEST_STAGE.NOT_STARTED;
  const renderPosition = player?.getRenderPosition?.() || player?.position || null;

  return JSON.stringify({
    origin: 'top-left',
    mapId: state.map?.id || null,
    mapName: state.map?.name || null,
    player: player ? {
      x: player.position.x,
      y: player.position.y,
      renderX: renderPosition?.x ?? player.position.x,
      renderY: renderPosition?.y ?? player.position.y,
      facing: player.facing,
      moving: player.isVisuallyMoving?.() || false,
      hp: state.character?.currentHP ?? null,
      mp: state.character?.currentMP ?? null,
      level: state.character?.level ?? null
    } : null,
    movement: movementController.getState(),
    combat: state.inCombat ? {
      active: true,
      enemy: enemy ? { name: enemy.name, hp: enemy.currentHP, maxHp: enemy.maxHP } : null,
      mode: combatEngine.playerMode || 'melee',
      turn: combatSnapshot?.turn || null,
      intent: combatSnapshot?.intent || null,
      recommendedAction: combatSnapshot?.recommendedAction || null,
      onboarding: Boolean(combatSnapshot?.onboarding),
      stagger: combatSnapshot ? {
        current: combatSnapshot.enemyStagger,
        threshold: combatSnapshot.staggerThreshold
      } : null,
      opening: combatSnapshot?.playerOpening || 0,
      battlefield: combatSnapshot?.battlefield || null
    } : { active: false },
    objective: objective ? {
      text: objective.text,
      tip: objective.tip
    } : null,
    quests: state.character?.quests || {},
    orbQuest: state.character ? {
      stage: orbStage,
      ...state.orbQuest,
      ending: state.orbQuest?.complete ? getOrbEnding(state) : null
    } : null,
    verticalSliceComplete: Boolean(state.orbQuest?.complete),
    hostileNpcs: state.map?.npcs?.filter((npc) => npc.hostile).map((npc) => ({
      id: npc.id,
      name: npc.name,
      x: npc.x,
      y: npc.y,
      enemyGroup: npc.enemyGroup
    })) || [],
    inventory: state.character?.inventory?.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: item.quantity || 1
    })) || []
  });
};

window.advanceTime = (ms = 0) => {
  renderGame();
  return Promise.resolve(ms);
};
