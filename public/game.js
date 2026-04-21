// Feature: Living World (NPC AI + Item Pickup)
import CharacterCreator from './CharacterCreator.js';
import Character from './Character.js';
import { createWorld, TileInfo, LORD_BRITISH_SPRITE_SHEET } from './GameMap.js?v=11';
import Renderer from './render.js?v=11';
import Player from './Player.js';
import CombatEngine from './CombatEngine.js';
import { createEnemy } from './Enemy.js';
import ItemGenerator from './ItemGenerator.js';
import QuestManager from './QuestManager.js';
import SaveManager, { formatTimestamp } from './SaveManager.js';
import { initCanvas, resize, DPR } from './renderer/canvas.js';
import { loadAtlas } from './renderer/atlas.js';
import { createEmitter } from './renderer/particles.js';

const ctx = initCanvas('game');
const renderer = new Renderer(ctx);
const particles = createEmitter();
renderer.setParticles(particles);
const DEFAULT_PLAYER_SPRITE_SHEET = 'assets/sprites/avatar.png';

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
  orb: document.getElementById('orb-panel')
};

const inventoryList = document.getElementById('inventory-list');
const inventoryCapacity = document.getElementById('inventory-capacity');
const characterSummary = document.getElementById('character-summary');
const characterStatsTable = document.getElementById('character-stats');
const statPointsEl = document.getElementById('stat-points');
const statAllocation = document.getElementById('stat-allocation');
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

const activeMovementDirections = new Set();

// --- GAME LOOP FOR AI ---
setInterval(() => {
  if (!state.map || state.inCombat || isPanelOpen()) return;

  // NPC AI: Wandering
  state.map.npcs.forEach(npc => {
    if (npc.behavior === 'wander' && Math.random() < 0.2) { // 20% chance to move per tick
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      attemptNPCMove(npc, dx, dy);
    }
  });

  // Re-render to show NPC movement
  renderGame();
}, 800); // Tick every 800ms

function attemptNPCMove(npc, dx, dy) {
  const targetX = npc.x + dx;
  const targetY = npc.y + dy;

  // Check Bounds
  if (!state.map.inBounds(targetX, targetY)) return;

  // Check Walkability (Walls/Objects)
  if (!state.map.isWalkable(targetX, targetY)) return;

  // Check Player Collision
  if (state.player.position.x === targetX && state.player.position.y === targetY) return;

  // Check Other NPC Collision
  if (state.map.npcs.some(other => other !== npc && other.x === targetX && other.y === targetY)) return;

  // Move
  npc.x = targetX;
  npc.y = targetY;

  // Update Facing (optional, simplistic)
  /* if (dx === 1) npc.facing = 'east'; */
}

// ... (Existing Helper Functions: buildResourcePanel, log, updateHUD, etc.)

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
    "Stat Pts": char.unspentStatPoints
  };
}

function log(message) {
  const stamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const now = Date.now();
  if (state.lastLogMessage === message && now - (state.lastLogAt || 0) < 900) {
    return;
  }
  state.lastLogMessage = message;
  state.lastLogAt = now;
  state.messageLog.push(`${stamp} — ${message}`);
  if (state.messageLog.length > 12) state.messageLog.shift();
  messageLogEl.innerHTML = state.messageLog.map(line => `<div>${line}</div>`).join('');
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
      tip: 'WASD to move. T to talk. G to get. O for Orb. X for Codex.'
    };
  }

  if (state.inCombat) {
    const enemyName = combatEngine.enemy?.name || 'your foe';
    return {
      hidden: false,
      text: `Battle ${enemyName}. Use melee, bow, spell, defend, or an item to survive.`,
      tip: 'Combat buttons are available during battle. Storm Cloak blocks Reaper lightning.'
    };
  }

  const orbStage = state.character.getQuestStage('orb_quest');
  const codexStage = state.character.getQuestStage('wisdom_of_lycaeum');

  if (!state.throneIntroComplete) {
    return {
      hidden: false,
      text: 'Clear the throne room ambush, then speak to Lord British.',
      tip: 'Move with WASD. Stand on items and press G to get.'
    };
  }

  if (orbStage === 0) {
    return {
      hidden: false,
      text: 'Talk to Lord British in Castle Britannia to begin the Orb of the Moons quest.',
      tip: 'Press T while facing an NPC to talk.'
    };
  }

  if (orbStage === 1) {
    return {
      hidden: false,
      text: 'Travel east to the Dark Caverns and recover the Orb of Moons.',
      tip: 'Use map exits or the Orb once it is unlocked.'
    };
  }

  if (orbStage === 2) {
    return {
      hidden: false,
      text: 'Return the Orb of Moons to Lord British in Castle Britannia.',
      tip: 'Press O to open the Orb travel menu when it is ready.'
    };
  }

  if (state.character.getQuestStage('castle_crisis') < 4) {
    return {
      hidden: false,
      text: 'Survive the attack and speak with Lord British in the throne room.',
      tip: 'The journal (J) tracks quest progress.'
    };
  }
  if (state.character.getQuestStage('wisdom_of_lycaeum') < 2) {
    return {
      hidden: false,
      text: 'Visit Mariah in the Lycaeum and answer her challenge to gain strategic wisdom.',
      tip: 'Look for the Lycaeum to the West of the castle.'
    };
  }

  return {
    hidden: false,
    text: 'Use the Orb of Moons to travel between Castle Britannia, the Lycaeum, Britanny Bay, and the Dark Caverns.',
    tip: 'I opens inventory, C opens the character sheet, X opens the Codex.'
  };
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
  return state.map.transitions?.find((transition) => transition.map === 'village') || null;
}

function getDungeonExitHint() {
  const exit = getDungeonExitTransition();
  if (!exit || !state.player) return null;
  const dx = exit.x - state.player.position.x;
  const dy = exit.y - state.player.position.y;
  const horizontal = dx > 0 ? 'east' : dx < 0 ? 'west' : '';
  const vertical = dy > 0 ? 'south' : dy < 0 ? 'north' : '';
  const direction = horizontal && vertical ? `${vertical}-${horizontal}` : (horizontal || vertical || 'here');
  return {
    direction,
    onExit: dx === 0 && dy === 0
  };
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
    ? 'Press Enter to leave for Britanny Bay.'
    : `Exit is ${hint.direction}. Move carefully.`;
  dungeonNavEl.innerHTML = `<strong>Dark Caverns Exit</strong><div class="subtle">${prompt}</div>`;
}

function refreshQuestViews() {
  updateObjectivePanel();
  if (!panels.journal.classList.contains('hidden')) {
    renderJournal();
  }
}

function setQuestStageAndRefresh(questId, stage) {
  if (!state.character) return;
  state.character.setQuestStage(questId, stage);
  refreshQuestViews();
}

function isPanelOpen() {
  return Object.values(panels).some(p => !p.classList.contains('hidden')) || !dialogueEl.classList.contains('hidden');
}

function closeAllPanels() {
  if (typeof combatEngine?.closeItemMenu === 'function') {
    combatEngine.closeItemMenu();
  }
  Object.values(panels).forEach(p => p.classList.add('hidden'));
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
    return true;
  }
  const openPanel = Object.entries(panels).find(([, panel]) => !panel.classList.contains('hidden'));
  if (openPanel) {
    openPanel[1].classList.add('hidden');
    return true;
  }
  return false;
}

function openPanel(name) {
  if (!panels[name]) return;
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

    const quests = state.character.quests;
    let hasQuests = false;

    Object.keys(quests).forEach(questId => {
        const stage = quests[questId];
        if (stage > 0) {
            hasQuests = true;
            const questData = QuestManager.getQuest(questId);
            if (questData) {
                const entry = document.createElement('div');
                entry.className = 'quest-entry';
                const stageText = questData.stages?.[stage] || questData.stages?.[0] || 'Unknown progress.';
                const stageKeys = Object.keys(questData.stages || {}).map((key) => Number(key)).filter((key) => Number.isFinite(key));
                const completionStage = stageKeys.length ? Math.max(...stageKeys) : 0;
                entry.innerHTML = `
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                      <div>
                        <h3 style="margin: 0 0 4px 0; color: #4a2c10;">${questData.title}</h3>
                        <p style="margin: 0; font-style: italic; color: #5a4326;">${questData.description}</p>
                      </div>
                      <span style="font-size: 11px; font-weight: bold; color: ${stage >= completionStage ? '#2f6b36' : '#7a5a22'};">${stage >= completionStage ? 'Completed' : 'Active'}</span>
                    </div>
                    <div style="margin-top: 8px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.3); border: 1px solid rgba(92, 60, 30, 0.18); font-size: 0.92em; line-height: 1.45;">
                      ${stageText}
                    </div>
                `;
                content.appendChild(entry);
            }
        }
    });

    if (!hasQuests) {
        content.innerHTML = '<p style="text-align: center; color: #666; margin-top: 32px;">No active quests.</p>';
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

function renderGame() {
  if (!state.map || !state.player) return;

  if (state.lookHighlight && state.lookHighlight.expires < Date.now()) {
    state.lookHighlight = null;
  }

  // Check for item under player to show hint
  const item = getItemAt(state.player.position.x, state.player.position.y);
  if (item) {
     // Optional: show a small "G" icon or text overlay?
     // For now, we rely on the log or visual cue
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
          <button data-orb-destination="${dest.mapId}">Travel</button>
        </div>
      `).join('')}
    </div>
  `;
}

function getOrbDestinations() {
  const mapList = [
    { mapId: 'castle', label: 'Castle Britannia', spawn: 'castle_gate', note: 'Return to Lord British.' },
    { mapId: 'castle_bedroom', label: 'Royal Quarters', spawn: 'bedroom_door', note: 'Search the bedroom for supplies.' },
    { mapId: 'village', label: 'Britanny Bay', spawn: 'castle_gate', note: 'Visit the village and the cave path.' },
    { mapId: 'lycaeum_entrance', label: 'The Lycaeum', spawn: 'lycaeum_gateway', note: 'Speak with Mariah.' },
    { mapId: 'dungeon_1', label: 'Dark Caverns', spawn: 'entry', note: 'Challenge the dungeon denizens.' }
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
    for (let i = 0; i < 20; i++) {
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

// ... (Keep existing Inventory/Character helper functions: showTooltip, hideTooltip, getItemTooltip, renderInventory, renderCharacterSheet, updateMenuStatus, useConsumable)
// Assuming these are standard; I will include abbreviated versions to save space, but ensure logic is preserved.

function showTooltip(event, text) {
  tooltip.textContent = text;
  tooltip.classList.remove('hidden');
  tooltip.style.left = `${event.clientX + 10}px`;
  tooltip.style.top = `${event.clientY + 10}px`;
}
function hideTooltip() { tooltip.classList.add('hidden'); }
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
    const equipped = state.character.equipment[item.type] && state.character.equipment[item.type].id === item.id;
    const canEquip = ['weapon', 'armor', 'accessory'].includes(item.type);
    const canUse = Boolean(item.effect?.type || item.useAction || item.type === 'consumable' || item.id === 'orb_of_moons' || item.id === 'tactics_codex');
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
    if (useConsumable(item)) {
      return;
    }
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

// ... (Map Management)

function changeMap(mapId, spawnTag, x, y) {
  const map = state.world.maps[mapId];
  if (!map) return;
  state.map = map;
  state.discoveredAreas.add(mapId);
  
  if (x !== undefined && y !== undefined) {
    state.player.map = map;
    state.player.setPosition(x, y);
  } else {
    state.player.setMap(map, spawnTag);
  }

  state.pendingTransition = null;
  activeMovementDirections.clear();
  renderer.stopAllMovement();
  updateHUD();
  renderGame();
  autoSave('area-transition');
}

function getNPCAt(x, y) {
  if (!state.map || !state.map.npcs) return null;
  return state.map.npcs.find(npc => npc.x === x && npc.y === y);
}

function getItemAt(x, y) {
    if (!state.map || !state.map.objects) return null;
    return state.map.objects.find(obj => obj.type === 'item' && obj.x === x && obj.y === y);
}

function attemptMove(dx, dy) {
  if (!state.player || state.inCombat) return;
  if (isPanelOpen() && dialogueEl.classList.contains('hidden')) return;

  const targetX = state.player.position.x + dx;
  const targetY = state.player.position.y + dy;

  // Check Bounds (Edge Warping)
  if (!state.map.inBounds(targetX, targetY)) {
      handleEdgeWarp(dx, dy);
      return;
  }

  // Check NPC Collision
  const npc = getNPCAt(targetX, targetY);
  if (npc) {
    const now = Date.now();
    if (!state.lastBlockedLog || now - state.lastBlockedLog > 1000) {
      log(`Blocked by: ${npc.name}.`);
      state.lastBlockedLog = now;
    }
    // Update facing
    if (dx === 1) state.player.facing = 'east';
    if (dx === -1) state.player.facing = 'west';
    if (dy === 1) state.player.facing = 'south';
    if (dy === -1) state.player.facing = 'north';
    renderGame();
    return;
  }

  const moved = state.player.move(dx, dy);
  if (!moved) {
    const tile = state.map.getTile(targetX, targetY);
    const def = TileInfo[tile];
    if (def) log(`Blocked: ${def.name}`);
    renderGame();
    return;
  }

  // Check if standing on item
  const item = getItemAt(targetX, targetY);
  if (item) {
      log(`You see ${item.data ? item.data.name : 'an item'} here. (Press G to get)`);
  }

  if (!dialogueEl.classList.contains('hidden')) dialogueEl.classList.add('hidden');
  renderGame();
  updateHUD();
  handleTileEvents();
}

function handleEdgeWarp(dx, dy) {
    let direction = null;
    if (dy === -1) direction = 'north';
    if (dy === 1) direction = 'south';
    if (dx === -1) direction = 'west';
    if (dx === 1) direction = 'east';

    const adj = state.map.adjacencies?.[direction];
    if (!adj) return;

    // Support both legacy string IDs and new object configurations
    const targetMapId = typeof adj === 'string' ? adj : adj.map;
    const xOffset = adj.xOffset || 0;
    const yOffset = adj.yOffset || 0;

    const targetMap = state.world.maps[targetMapId];
    if (!targetMap) return;

    let newX = state.player.position.x + xOffset;
    let newY = state.player.position.y + yOffset;

    // Boundary warping logic
    if (direction === 'north') {
        newY = targetMap.height - 1;
    } else if (direction === 'south') {
        newY = 0;
    } else if (direction === 'west') {
        newX = targetMap.width - 1;
    } else if (direction === 'east') {
        newX = 0;
    }

    // Safety clamping
    newX = Math.max(0, Math.min(targetMap.width - 1, newX));
    newY = Math.max(0, Math.min(targetMap.height - 1, newY));

    // Optional: Suppress log for seamless feel
    if (!adj.silent) {
        log(`You travel ${direction} towards ${targetMap.name || targetMapId}.`);
    }
    
    changeMap(targetMapId, null, newX, newY);
}

function handleTalk() {
  if (!state.player) return;
  const offset = DIRECTION_OFFSETS[state.player.facing || 'south'];
  const targetX = state.player.position.x + offset.dx;
  const targetY = state.player.position.y + offset.dy;

  const npc = getNPCAt(targetX, targetY);
  if (npc) {
    showDialogue(npc);
  } else {
    log("There is no one there.");
  }
}

function handleGet() {
    if (!state.player) return;
    const { x, y } = state.player.position;

    // Find item at feet
    const objIndex = state.map.objects.findIndex(o => o.type === 'item' && o.x === x && o.y === y);
    if (objIndex === -1) {
        log("There is nothing here to take.");
        return;
    }

    const obj = state.map.objects[objIndex];
    const itemData = obj.data || { name: 'Unknown Item', type: 'misc', weight: 1 };

    // Handle Quest Item Logic
    if (itemData.id === 'orb_of_moons') {
         setQuestStageAndRefresh('orb_quest', 2);
         log("Journal Updated! You found the Orb.");
         autoSave('quest-progress');
    }

    if (itemData.id === 'gargoyle_tablet') {
         setQuestStageAndRefresh('orb_quest', 3);
         log("Journal Updated! You found a cryptic Gargoyle Tablet.");
         autoSave('quest-progress');
    }

    // Add to inventory
    const added = state.character.addItem(itemData);
    if (added) {
        log(`You picked up: ${itemData.name}`);
        // Remove from map
        state.map.objects.splice(objIndex, 1);
        renderGame();
        updateHUD();
        renderInventory(); // update if open
        updateObjectivePanel();
    } else {
        log("You cannot carry that.");
    }
}

function showDialogue(npc) {
  state.currentConversationPartner = npc;
  dialogueEl.classList.remove('hidden');
  dialogueInputContainer.classList.remove('hidden');
  
  let initialText = '...';
  if (npc.id === 'mariah') {
      const stage = state.character.getQuestStage('wisdom_of_lycaeum');
      if (stage >= 2) {
          if (state.character.hasItem('gargoyle_tablet')) {
              initialText = "I see you have found a relic from the Dark Caverns. Use the keyword TABLET and I shall translate it for you.";
          } else {
              initialText = 'The scrolls of Truth contain mysteries yet to be unraveled. Seek evidence of the Gargoyles\' purpose.';
          }
      } else {
          initialText = "I am Mariah. Many in the Lycaeum speak of your arrival. It is said the 'False Prophet' has come to Britannia... but I see only an Avatar who seeks Truth. Tell me, what lies at the heart of our wisdom?";
      }
  } else if (typeof npc.dialogue === 'function') {
      initialText = npc.dialogue(state);
  } else {
      initialText = npc.dialogue || 'Greetings traveler.';
  }

  dialogueText.innerHTML = `"${initialText}"`;
  updateDialogueKeywords(npc);
}

function updateDialogueKeywords(npc) {
    dialogueKeywords.innerHTML = '';
    const defaults = ['NAME', 'JOB', 'BYE'];
    const npcKeywords = npc.responses ? Object.keys(npc.responses) : [];
    
    [...defaults, ...npcKeywords].forEach(kw => {
        const btn = document.createElement('button');
        btn.textContent = kw;
        btn.style.cssText = `
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
        btn.onmouseover = () => {
            btn.style.background = 'rgba(220,182,120,0.2)';
            btn.style.borderColor = 'rgba(220,182,120,0.8)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'rgba(74, 60, 42, 0.6)';
            btn.style.borderColor = 'rgba(220,182,120,0.4)';
        };
        btn.onclick = () => {
            handleDialogueSubmit(kw);
        };
        dialogueKeywords.appendChild(btn);
    });
}

function handleDialogueSubmit(selectedKeyword) {
    const npc = state.currentConversationPartner;
    const input = (selectedKeyword || '').toUpperCase();
    if (!npc || !input) return;

    let response = "I do not know of that.";

    // Universal Keywords
    if (input === 'BYE') {
        dialogueEl.classList.add('hidden');
        state.currentConversationPartner = null;
        return;
    }
    if (input === 'NAME') {
        response = `I am called ${npc.name}.`;
    } else if (input === 'JOB') {
        response = npc.job || "I have no specific trade to speak of.";
    } else if (npc.responses && npc.responses[input]) {
        response = npc.responses[input];
    }

    // Quest Specific Transitions
    if (npc.id === 'mariah') {
        const stage = state.character.getQuestStage('wisdom_of_lycaeum');
        if (stage < 2 && (input === 'TRUTH' || input === 'KNOWING NOTHING')) {
            response = "Indeed. Truth is the bedrock of our virtue. You have proven your commitment to understanding. Take this Codex of Wisdom.";
            completeMariahQuest();
        }
        
        if (input === 'TABLET' && state.character.hasItem('gargoyle_tablet')) {
            response = "Let me see... 'Dune-sa-Sacrifice... The Book of Light... The Prophet brings death.' Good heavens, Avatar. They believe you are here to destroy their world! They stole the Orb only to prevent us from reaching their home.";
            setQuestStageAndRefresh('orb_quest', 4);
            setQuestStageAndRefresh('wisdom_of_lycaeum', 3);
            log("Journal Updated: The 'False Prophet' prophecy revealed.");
        }
    }

    // Quest Milestone Starters (Traditional Ultima Style)
    if (npc.id === 'lord_british') {
        const crisisStage = state.character.getQuestStage('castle_crisis');
        if (crisisStage === 2) {
            setQuestStageAndRefresh('castle_crisis', 4); // Saved LB
            log("Lord British nods. 'I am deeply in your debt, Avatar.'");
            state.character.applyStatPoints({ STR: 1, DEX: 1 });
            log("Gained +1 Strength and +1 Dexterity for your valor!");
        }

        if (input === 'ORB' || input === 'QUEST' || input === 'GARGOYLES') {
            const stage = state.character.getQuestStage('orb_quest');
            if (stage === 0) {
                setQuestStageAndRefresh('orb_quest', 1);
                log("Quest Objective Updated: Seek the Lycaeum.");
                autoSave('quest-start');
                response = "The Orb of Moons is a sacred relic, yet it was taken by creatures of muscle and wing. Go to the Lycaeum and speak with Mariah; she may interpret the purpose behind this theft.";
            }
        }

        if (input === 'MISUNDERSTANDING') {
            const stage = state.character.getQuestStage('orb_quest');
            if (stage === 4) {
                setQuestStageAndRefresh('orb_quest', 5);
                log("Quest Objective Updated: Contemplate the future of Britannia.");
                autoSave('quest-doubt');
            }
        }
    }

    if (npc.id === 'gargoyle_guardian') {
        if (input === 'PROPHET' || input === 'UNDERSTANDING') {
            const stage = state.character.getQuestStage('orb_quest');
            if (stage < 3) {
                setQuestStageAndRefresh('orb_quest', 3);
                state.guardianDefeated = true; // Non-violent resolution
                log("The Guardian lowers their weapon. 'Perhaps you are not the one the scrolls foretold.'");
                log("Moral Achievement: Path of Understanding.");
                response = "If you speak the Truth, then take the Orb. But know that our world bleeds as yours does. We only wish to stop the fading of our sun. Look to the TABLET for the full tale.";
            }
        }
    }

    dialogueText.innerHTML = `"${response}"`;
}

function completeMariahQuest() {
    log("Mariah smiles. 'The path to Truth is yours to walk.'");
    setQuestStageAndRefresh('wisdom_of_lycaeum', 2);
    state.character.applyStatPoints({ INT: 2 });
    const codex = itemGenerator.createTacticsCodex();
    state.character.addItem(codex);
    log(`Received: ${codex.name}`);
    log("Gained +2 Intelligence!");
    updateHUD();
    renderCharacterSheet();
    renderInventory();
    autoSave('quest-complete');
}

// Dialogue is now keyword-driven via button chips




function handleTileEvents() {
  const { x, y } = state.player.position;

  // Castle Crisis Stage 1 Trigger (Throne Room Ambush)
  if (state.map.id === 'castle' && state.character.getQuestStage('castle_crisis') === 0 && x === 14 && y === 11) {
    setQuestStageAndRefresh('castle_crisis', 1);
    log('A gargoyle bursts into the throne room!');
    startSpecialEncounter('throne_ambush');
    return;
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

  // Boss Trigger for Orb Quest (Moral Crack: The Guardian)
  if (state.map.id === 'dungeon_1' && x === 6 && y === 8 && state.character.getQuestStage('orb_quest') === 1) {
      if (!state.guardianDefeated) {
          log("The air turns cold... The Guardian blocks your path!");
          log("You may attempt to TALK or FIGHT.");
          startSpecialEncounter('dungeon_boss');
          return;
      }
  }

  if (!state.map.safe && Math.random() < state.map.getEncounterChance(x, y)) {
    startEncounter();
  }
}

async function startEncounter(category = null) {
  if (state.inCombat) return;
  if (isPanelOpen()) {
    closeAllPanels();
  }
  if (activeMovementDirections.size) {
    activeMovementDirections.clear();
    renderer.stopAllMovement();
  }
  state.inCombat = true;
  
  const level = state.map.areaLevel || 1;
  const enemy = createEnemy(category || state.map.encounterGroup || state.map.id, level);
  const result = await combatEngine.start(state.player, enemy);
  await resolveCombat(result, enemy);
  
  // Flag guardian as defeated if victory
  if (category === 'dungeon_boss' && result.outcome === 'victory') {
      state.guardianDefeated = true;
  }
  if (category === 'throne_ambush' && result.outcome === 'victory') {
      state.throneIntroComplete = true;
  }

  state.inCombat = false;
  renderGame();
}

async function startSpecialEncounter(category) {
    await startEncounter(category);
}

async function resolveCombat(result, enemy) {
  if (!state.character) return;
  if (result.outcome === 'victory') {
    const xp = result.xp || enemy.xpReward;
    const { leveledUp } = state.character.gainXP(xp);
    log(`Gained ${xp} experience.`);
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
    updateHUD();
    renderInventory();
    renderCharacterSheet();
    if (leveledUp) {
      log(`Level up! You reached level ${state.character.level}.`);
      autoSave('level-up');
    }
    if (enemy.id === 'gargoyle' && state.map?.id === 'castle') {
      setQuestStageAndRefresh('castle_crisis', 2);
      log('The throne room is clear. You should speak with Lord British.');
      renderGame();
      autoSave('throne-ambush');
    }
    
    if (enemy.id === 'gargoyle_guardian' || category === 'dungeon_boss') {
        state.guardianDefeated = true;
        setQuestStageAndRefresh('orb_quest', 3);
        log('The Guardian falls. The Orb is within reach.');
    }
  } else if (result.outcome === 'defeat') {
    log('You awaken at the village, bruised but alive.');
    state.character.applyDeathPenalty();
    state.character.currentHP = Math.max(state.character.currentHP, Math.floor(state.character.maxHP * 0.6));
    state.character.currentMP = Math.max(state.character.currentMP, Math.floor(state.character.maxMP * 0.4));
    changeMap(state.map?.id === 'castle' ? 'castle' : 'village', 'castle_gate');
  } else if (result.outcome === 'fled') {
    log('You fled from battle.');
  }
  updateHUD();
}

function saveGame(reason = 'manual', silent = false) {
  if (!state.character || !state.player || !state.map) return false;
  
  const success = SaveManager.save(state);
  
  if (success) {
    state.lastSaveTimestamp = Date.now();
    if (!silent) {
      log(`Game saved (${reason}).`);
    }
  } else if (!silent) {
    log('Saving failed.');
  }
  return success;
}

function autoSave(reason) {
  saveGame(reason, true);
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

  // Handle position restoration
  const pos = data.playerPosition;
  if (pos && currentMap.isWalkable(pos.x, pos.y)) {
      player.setPosition(pos.x, pos.y);
      player.map = currentMap; // Ensure map reference is set!
  } else {
      player.setMap(currentMap, 'castle_gate');
  }

  state.character = character;
  state.player = player;
  state.map = currentMap;
  state.guardianDefeated = data.flags?.guardianDefeated || false;

  activeMovementDirections.clear();
  renderer.stopAllMovement();
  renderInventory();
  renderCharacterSheet();
  updateHUD();
  renderGame();
  celebrateCastle();
  log(manual ? 'Save data loaded.' : 'Journey resumed from last save.');
  return true;
}

function setupEventListeners() {
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.toLowerCase();

    if (!dialogueEl.classList.contains('hidden')) {
        if (['escape',' ','enter'].includes(key)) {
            event.preventDefault();
            dialogueEl.classList.add('hidden');
        }
        return;
    }

    if (state.inCombat) {
      if (key === 'escape' && combatEngine.isItemMenuOpen()) {
        event.preventDefault();
        combatEngine.closeItemMenu();
      }
      return;
    }

    if (key === 'escape') {
      event.preventDefault();
      if (closeTopOverlay()) {
        return;
      }
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
        const dir = KEY_TO_DIRECTION[key];
        renderer.setPlayerMovement(dir, true);
        const { dx, dy } = DIRECTION_OFFSETS[dir];
        attemptMove(dx, dy);
        return;
    }

    switch (key) {
      case 't': handleTalk(); break;
      case 'g': handleGet(); break; // NEW COMMAND
      case 'i': togglePanel('inventory'); break;
      case 'c': togglePanel('character'); break;
      case 'm': togglePanel('menu'); break;
      case 'j': togglePanel('journal'); break;
      case 'o': togglePanel('orb'); break;
      case 'x': togglePanel('codex'); break;
    }
  });

  document.addEventListener('keyup', (e) => {
      const dir = KEY_TO_DIRECTION[e.key.toLowerCase()];
      if (dir) renderer.setPlayerMovement(dir, false);
  });

  document.addEventListener('click', (event) => {
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

// ... (Bootstrap)
window.gameApp = { state, renderer, creator, itemGenerator, SaveManager };
async function bootstrap() {
    try {
        const atlas = await loadAtlas(null, './assets/atlas.json');
        renderer.setAtlas(atlas);
        await renderer.loadPlayerSprite(DEFAULT_PLAYER_SPRITE_SHEET);
    } catch (e) {
        console.warn('Failed to load assets:', e);
    }
    renderer.start();
    setupEventListeners();
    
    if (loadGame(false)) {
        return;
    }

    // Default Start
    const char = await creator.open();
    if(char) {
        state.character = char;
        state.player = new Player(char);
        let starterWeapon = null;
        for (let i = 0; i < 8 && !starterWeapon; i += 1) {
          const candidate = itemGenerator.createWeapon(1);
          if (state.character.canEquip(candidate)) {
            starterWeapon = candidate;
          }
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
        // Give starter items
        state.character.addItem(itemGenerator.createHealthPotion(1));
        renderGame();
    }
}

bootstrap();

window.render_game_to_text = () => {
  const player = state.player;
  const enemy = combatEngine.enemy;
  const objective = state.character ? getObjectiveState() : null;
  return JSON.stringify({
    origin: 'top-left',
    mapId: state.map?.id || null,
    mapName: state.map?.name || null,
    player: player ? {
      x: player.position.x,
      y: player.position.y,
      facing: player.facing,
      hp: state.character?.currentHP ?? null,
      mp: state.character?.currentMP ?? null,
      level: state.character?.level ?? null
    } : null,
    combat: state.inCombat ? {
      active: true,
      enemy: enemy ? { name: enemy.name, hp: enemy.currentHP, maxHp: enemy.maxHP } : null,
      mode: combatEngine.playerMode || 'melee'
    } : { active: false },
    objective: objective ? {
      text: objective.text,
      tip: objective.tip
    } : null,
    quests: state.character?.quests || {},
    inventory: state.character?.inventory?.map((item) => ({ id: item.id, name: item.name, type: item.type, quantity: item.quantity || 1 })) || []
  });
};

window.advanceTime = (ms = 0) => {
  renderGame();
  return Promise.resolve(ms);
};
