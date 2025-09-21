// Feature: Village area + transitions (Castle↔Village↔Forest)
import CharacterCreator from './CharacterCreator.js';
import Character from './Character.js';
import { createWorld, TileInfo, LORD_BRITISH_SPRITE_SHEET } from './GameMap.js';
import Renderer from './render.js';
import Player from './Player.js';
import CombatEngine from './CombatEngine.js';
import { createEnemy } from './Enemy.js';
import ItemGenerator from './ItemGenerator.js';
import SaveManager, { formatTimestamp } from './SaveManager.js';
import { initCanvas, resize, DPR } from './renderer/canvas.js';
import { loadAtlas } from './renderer/atlas.js';
import { createEmitter } from './renderer/particles.js';

const ctx = initCanvas('game');
const renderer = new Renderer(ctx);
const particles = createEmitter();
renderer.setParticles(particles);
const DEFAULT_PLAYER_SPRITE_SHEET = 'assets/sprites/Male-17-3-1758428284774-d1ea43dc.png';
const syncCanvasSize = () => {
  resize();
};

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
  area: document.getElementById('hud-area')
};

const panels = {
  inventory: document.getElementById('inventory-panel'),
  character: document.getElementById('character-panel'),
  menu: document.getElementById('menu-panel')
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

function buildResourcePanel() {
  if (!state.character) {
    return {};
  }
  const character = state.character;
  const maxHP = Math.round(character.maxHP ?? character.currentHP ?? 0);
  const maxMP = Math.round(character.maxMP ?? character.currentMP ?? 0);
  const currentHP = Math.round(character.currentHP ?? 0);
  const currentMP = Math.round(character.currentMP ?? 0);
  const xpThreshold = character.xpThreshold ?? 0;
  const backpackWeight = Number.isFinite(character.backpackWeight) ? character.backpackWeight : 0;
  const carryCapacity = Number.isFinite(character.stats?.STR)
    ? character.stats.STR * 2
    : backpackWeight;
  const statPoints = Number.isFinite(character.unspentStatPoints) ? character.unspentStatPoints : 0;
  return {
    HP: `${currentHP}/${maxHP}`,
    MP: `${currentMP}/${maxMP}`,
    XP: `${character.xp}/${xpThreshold}`,
    Load: `${backpackWeight.toFixed(1)}/${carryCapacity.toFixed(1)}`,
    "Stat Pts": statPoints
  };
}

function log(message) {
  const stamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.messageLog.push(`${stamp} — ${message}`);
  if (state.messageLog.length > 12) {
    state.messageLog.shift();
  }
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
}

function isPanelOpen() {
  return Object.values(panels).some((panel) => !panel.classList.contains('hidden'));
}

function closeAllPanels() {
  Object.values(panels).forEach((panel) => panel.classList.add('hidden'));
  hideTooltip();
}

function openPanel(name) {
  if (!panels[name]) return;
  if (name === 'inventory') {
    renderInventory();
  } else if (name === 'character') {
    renderCharacterSheet();
  } else if (name === 'menu') {
    updateMenuStatus();
  }
  panels[name].classList.remove('hidden');
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
  const highlight = state.lookHighlight
    ? {
        x: state.lookHighlight.x,
        y: state.lookHighlight.y,
        expires: state.lookHighlight.expires,
        color: state.lookHighlight.color
      }
    : null;
  const npcs = Array.isArray(state.map.npcs) ? state.map.npcs : [];
  const objects = Array.isArray(state.map.objects) ? state.map.objects : [];
  const hud = {
    resources: buildResourcePanel(),
    castleLevel: state.character?.level || 1
  };
  renderer.render(state.map, state.player, { highlight, npcs, objects, hud });
}

function celebrateCastle(force = false) {
  if (!state.map || state.map.id !== 'castle' || !state.player) return;
  const now = performance.now();
  if (!force && state.fx.lastCastleBurst && now - state.fx.lastCastleBurst < 1200) {
    return;
  }
  state.fx.lastCastleBurst = now;
  const { x, y } = state.player.position;
  requestAnimationFrame(() => {
    const rect = renderer.getMapScreenRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const centerX = rect.x + (x + 0.5) * renderer.tileSize;
    const centerY = rect.y + (y + 0.5) * renderer.tileSize;
    renderer.shakeCamera(6, 0.2);
    renderer.flashRectangle(rect.x, rect.y, rect.width, rect.height, 0.6, 90);
    for (let i = 0; i < 28; i += 1) {
      particles.spawn(centerX, centerY, {
        vx: (Math.random() - 0.5) * 28,
        vy: -32 - Math.random() * 18,
        life: 0.6 + Math.random() * 0.4,
        size: 1 + Math.random() * 1.5,
        gravity: 60,
        blend: 'lighter'
      });
    }
  });
}

function showTooltip(event, text) {
  tooltip.textContent = text;
  tooltip.classList.remove('hidden');
  const rect = tooltip.getBoundingClientRect();
  let left = event.clientX + 12;
  let top = event.clientY + 12;
  if (left + rect.width > window.innerWidth) {
    left = event.clientX - rect.width - 12;
  }
  if (top + rect.height > window.innerHeight) {
    top = event.clientY - rect.height - 12;
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

function getItemTooltip(item) {
  const lines = [`${item.name} (${item.type})`];
  if (item.type === 'weapon') {
    const current = state.character.equipment.weapon;
    const attack = item.stats?.attack || 0;
    const diff = attack - (current?.stats?.attack || 0);
    lines.push(`Attack: ${attack} (${diff >= 0 ? '+' : ''}${diff})`);
    if (item.stats?.str_req) {
      lines.push(`STR Req: ${item.stats.str_req}`);
    }
  } else if (item.type === 'armor') {
    const current = state.character.equipment.armor;
    const defense = item.stats?.defense || 0;
    const diff = defense - (current?.stats?.defense || 0);
    lines.push(`Defense: ${defense} (${diff >= 0 ? '+' : ''}${diff})`);
    if (item.stats?.str_req) {
      lines.push(`STR Req: ${item.stats.str_req}`);
    }
  } else if (item.type === 'consumable') {
    if (item.effect?.type === 'heal') {
      lines.push(`Restores ${item.effect.amount} HP`);
    } else if (item.effect?.type === 'restore_mana') {
      lines.push(`Restores ${item.effect.amount} MP`);
    }
  }
  lines.push(`Weight: ${(item.weight || 1).toFixed(1)}`);
  lines.push(`Value: ${item.value}`);
  return lines.join('\n');
}

function renderInventory() {
  if (!state.character) return;
  inventoryList.innerHTML = '';
  if (state.character.inventory.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'Backpack is empty.';
    inventoryList.appendChild(empty);
  } else {
    state.character.inventory.forEach((item) => {
      const element = document.createElement('div');
      element.className = 'inventory-item';
      const header = document.createElement('div');
      header.className = 'inventory-item-header';
      const name = document.createElement('strong');
      name.textContent = item.name;
      name.addEventListener('mouseenter', (event) => showTooltip(event, getItemTooltip(item)));
      name.addEventListener('mouseleave', hideTooltip);
      const qty = document.createElement('span');
      qty.textContent = `x${item.quantity || 1}`;
      header.appendChild(name);
      if (item.stackable) {
        header.appendChild(qty);
      }
      element.appendChild(header);
      const details = document.createElement('div');
      details.textContent = `${item.type}`;
      element.appendChild(details);
      const actions = document.createElement('div');
      actions.className = 'inventory-item-actions';
      if (['weapon', 'armor', 'accessory'].includes(item.type)) {
        const equipButton = document.createElement('button');
        equipButton.textContent = 'Equip';
        equipButton.addEventListener('click', () => {
          const result = state.character.equipItem(item.id);
          if (result.success) {
            log(`Equipped ${item.name}.`);
            renderInventory();
            renderCharacterSheet();
            updateHUD();
            hideTooltip();
          } else {
            log(result.reason || 'Cannot equip item.');
          }
        });
        actions.appendChild(equipButton);
      }
      if (item.type === 'consumable') {
        const useButton = document.createElement('button');
        useButton.textContent = 'Use';
        useButton.addEventListener('click', () => {
          useConsumable(item);
        });
        actions.appendChild(useButton);
      }
      const dropButton = document.createElement('button');
      dropButton.textContent = 'Drop';
      dropButton.addEventListener('click', () => {
        state.character.removeItem(item.id, item.stackable ? item.quantity : 1);
        log(`Dropped ${item.name}.`);
        renderInventory();
        updateHUD();
        hideTooltip();
      });
      actions.appendChild(dropButton);
      element.appendChild(actions);
      inventoryList.appendChild(element);
    });
  }
  const equipped = state.character.equippedWeight.toFixed(1);
  const backpack = state.character.backpackWeight.toFixed(1);
  inventoryCapacity.textContent = `Equipped: ${equipped}/${state.character.stats.STR} · Backpack: ${backpack}/${(state.character.stats.STR * 2).toFixed(1)}`;
}

function renderCharacterSheet() {
  if (!state.character) return;
  const equipment = state.character.equipment;
  const equipmentText = [
    `Weapon: ${equipment.weapon ? equipment.weapon.name : 'None'}`,
    `Armor: ${equipment.armor ? equipment.armor.name : 'None'}`
  ].join(' · ');
  characterSummary.innerHTML = `<div>${state.character.name} — Level ${state.character.level}</div><div>${equipmentText}</div>`;
  characterStatsTable.innerHTML = '';
  Character.STAT_KEYS.forEach((stat) => {
    const row = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = stat;
    const value = document.createElement('td');
    value.textContent = state.character.stats[stat];
    row.appendChild(label);
    row.appendChild(value);
    characterStatsTable.appendChild(row);
  });
  const derived = [
    ['Max HP', state.character.maxHP],
    ['Max MP', state.character.maxMP],
    ['Attack', state.character.attack],
    ['Defense', state.character.defense]
  ];
  derived.forEach(([name, value]) => {
    const row = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = name;
    const val = document.createElement('td');
    val.textContent = value;
    row.appendChild(label);
    row.appendChild(val);
    characterStatsTable.appendChild(row);
  });
  statPointsEl.textContent = `Unspent stat points: ${state.character.unspentStatPoints}`;
  statAllocation.innerHTML = '';
  if (state.character.unspentStatPoints > 0) {
    Character.STAT_KEYS.forEach((stat) => {
      const button = document.createElement('button');
      button.textContent = `+ ${stat}`;
      button.addEventListener('click', () => {
        if (state.character.applyStatPoints({ [stat]: 1 })) {
          log(`${stat} increased to ${state.character.stats[stat]}.`);
          updateHUD();
          renderCharacterSheet();
          renderInventory();
          autoSave('stat-allocation');
        }
      });
      statAllocation.appendChild(button);
    });
  } else {
    const hint = document.createElement('span');
    hint.textContent = 'Gain experience to earn more points.';
    statAllocation.appendChild(hint);
  }
}

function updateMenuStatus() {
  menuLastSave.textContent = formatTimestamp(state.lastSaveTimestamp);
}

function useConsumable(item) {
  if (item.type !== 'consumable') return;
  if (item.effect?.type === 'heal') {
    const before = state.character.currentHP;
    state.character.heal(item.effect.amount);
    const healed = state.character.currentHP - before;
    log(`Recovered ${healed} HP.`);
  } else if (item.effect?.type === 'restore_mana') {
    const before = state.character.currentMP;
    state.character.restoreMana(item.effect.amount);
    const restored = state.character.currentMP - before;
    log(`Recovered ${restored} MP.`);
  }
  state.character.removeItem(item.id, 1);
  renderInventory();
  updateHUD();
  hideTooltip();
}

function changeMap(mapId, spawnTag) {
  const map = state.world.maps[mapId];
  if (!map) return;
  state.map = map;
  if (!state.discoveredAreas.has(mapId)) {
    log(`Discovered ${map.name}.`);
  }
  state.discoveredAreas.add(mapId);
  Object.values(state.world.maps).forEach((area) => {
    if (state.discoveredAreas.has(area.id) || area.safe) {
      area.discovered = true;
    }
  });
  state.player.setMap(map, spawnTag);
  activeMovementDirections.clear();
  renderer.stopAllMovement();
  updateHUD();
  renderGame();
  celebrateCastle();
  autoSave('area-transition');
}

function attemptMove(dx, dy) {
  if (!state.player || state.inCombat) return;
  if (isPanelOpen()) return;
  const moved = state.player.move(dx, dy);
  if (!moved) {
    const targetTile = state.map.getTile(state.player.position.x + dx, state.player.position.y + dy);
    if (targetTile) {
      const def = TileInfo[targetTile] || TileInfo.grass;
      log(`Cannot move there: ${def.name}.`);
    }
    renderGame();
    return;
  }
  renderGame();
  updateHUD();
  handleTileEvents();
}

function handleTileEvents() {
  const { x, y } = state.player.position;
  const transition = state.map.getTransition(x, y);
  if (transition) {
    changeMap(transition.map, transition.spawn);
    return;
  }
  if (!state.map.safe) {
    const chance = state.map.getEncounterChance(x, y);
    if (Math.random() < chance) {
      startEncounter();
    }
  }
}

function handleLook(dx, dy) {
  if (!state.player) return;
  const lookPos = state.player.look(dx, dy);
  if (!state.map.inBounds(lookPos.x, lookPos.y)) {
    log('Beyond the boundaries of the world.');
    return;
  }
  state.lookHighlight = { x: lookPos.x, y: lookPos.y, expires: Date.now() + 2500 };
  const description = state.map.describeTile(lookPos.x, lookPos.y);
  log(description);
  renderGame();
}

async function startEncounter() {
  if (state.inCombat) return;
  if (isPanelOpen()) {
    closeAllPanels();
  }
  if (activeMovementDirections.size) {
    activeMovementDirections.clear();
    renderer.stopAllMovement();
  }
  state.inCombat = true;
  const enemy = createEnemy(state.map.id, state.map.areaLevel);
  const result = await combatEngine.start(state.player, enemy);
  await resolveCombat(result, enemy);
  state.inCombat = false;
  renderGame();
}

async function resolveCombat(result, enemy) {
  if (!state.character) return;
  if (result.outcome === 'victory') {
    const xp = result.xp || enemy.xpReward;
    const { leveledUp } = state.character.gainXP(xp);
    log(`Gained ${xp} experience.`);
    if (result.loot?.length) {
      result.loot.forEach((item) => {
        if (state.character.addItem(item, item.quantity || 1)) {
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
  } else if (result.outcome === 'defeat') {
    log('You awaken at the forest glade, bruised but alive.');
    state.character.applyDeathPenalty();
    state.character.currentHP = Math.max(state.character.currentHP, Math.floor(state.character.maxHP * 0.6));
    state.character.currentMP = Math.max(state.character.currentMP, Math.floor(state.character.maxMP * 0.4));
    changeMap('forest', 'forest_path');
  } else if (result.outcome === 'fled') {
    log('You fled from battle.');
  }
  updateHUD();
}

function saveGame(reason = 'manual', silent = false) {
  if (!state.character || !state.player || !state.map) return false;
  const payload = {
    character: {
      ...state.character.toJSON(),
      position: { ...state.player.position }
    },
    world: {
      current_map: state.map.id,
      discovered_areas: Array.from(state.discoveredAreas)
    }
  };
  const success = SaveManager.save(payload);
  if (success) {
    state.lastSaveTimestamp = Date.now();
    updateMenuStatus();
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
  const currentMap = state.world.maps[data.world?.current_map] || state.world.startingMap;
  player.setMap(currentMap, data.character.position ? undefined : 'village');
  if (data.character.position && currentMap.isWalkable(data.character.position.x, data.character.position.y)) {
    player.setPosition(data.character.position.x, data.character.position.y);
  }
  state.character = character;
  state.player = player;
  state.map = currentMap;
  activeMovementDirections.clear();
  renderer.stopAllMovement();
  state.discoveredAreas = new Set(data.world?.discovered_areas || []);
  state.discoveredAreas.add(currentMap.id);
  Object.values(state.world.maps).forEach((map) => {
    map.discovered = map.safe || state.discoveredAreas.has(map.id);
  });
  state.lastSaveTimestamp = data.timestamp || Date.now();
  state.fx.lastCastleBurst = 0;
  updateMenuStatus();
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
    if (state.inCombat) return;
    const normalizedKey = event.key.toLowerCase();
    const direction = KEY_TO_DIRECTION[normalizedKey];

    if (event.shiftKey && direction) {
      event.preventDefault();
      const offset = DIRECTION_OFFSETS[direction];
      handleLook(offset.dx, offset.dy);
      return;
    }

    if (direction) {
      event.preventDefault();
      if (!state.player) return;
      if (!activeMovementDirections.has(direction)) {
        activeMovementDirections.add(direction);
        renderer.setPlayerMovement(direction, true);
      }
      const offset = DIRECTION_OFFSETS[direction];
      attemptMove(offset.dx, offset.dy);
      return;
    }

    switch (normalizedKey) {
      case 'f3':
        event.preventDefault();
        renderer.toggleDebugOverlay();
        break;
      case 'u':
        if (renderer.isDebugVisible()) {
          event.preventDefault();
          celebrateCastle(true);
        }
        break;
      case 'i':
        event.preventDefault();
        togglePanel('inventory');
        break;
      case 'c':
        event.preventDefault();
        togglePanel('character');
        break;
      case 'm':
        event.preventDefault();
        togglePanel('menu');
        break;
      case 'escape':
        closeAllPanels();
        break;
      default:
        break;
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const normalizedKey = event.key.toLowerCase();
    const direction = KEY_TO_DIRECTION[normalizedKey];
    if (!direction) return;
    if (activeMovementDirections.has(direction)) {
      activeMovementDirections.delete(direction);
    }
    renderer.setPlayerMovement(direction, false);
  });

  window.addEventListener('blur', () => {
    if (activeMovementDirections.size) {
      activeMovementDirections.forEach((direction) => {
        renderer.setPlayerMovement(direction, false);
      });
      activeMovementDirections.clear();
    }
    renderer.stopAllMovement();
  });

  document.querySelectorAll('.panel button[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.close;
      if (panels[name]) {
        panels[name].classList.add('hidden');
      }
    });
  });

  document.getElementById('menu-save').addEventListener('click', () => {
    saveGame('manual');
  });

  document.getElementById('menu-load').addEventListener('click', () => {
    loadGame(true);
  });

  document.getElementById('menu-clear').addEventListener('click', () => {
    SaveManager.clear();
    state.lastSaveTimestamp = null;
    updateMenuStatus();
    log('Save data cleared.');
  });
}

function giveStarterGear(character) {
  const weapon = itemGenerator.createWeapon(1);
  weapon.name = 'Training Sword';
  if (character.addItem(weapon)) {
    character.equipItem(weapon.id);
  }
  const armor = itemGenerator.createArmor(1);
  armor.name = 'Traveler Coat';
  if (character.addItem(armor)) {
    character.equipItem(armor.id);
  }
  character.addItem(itemGenerator.createHealthPotion(1), 2);
  character.addItem(itemGenerator.createManaPotion(1));
}

async function bootstrap() {
  console.log('Bootstrap starting...');
  
  // Expose renderer for debugging
  window.renderer = renderer;
  
  try {
    const atlasCandidates = [];
    try {
      atlasCandidates.push(new URL('./assets/atlas.json', import.meta.url).href);
    } catch (error) {
      console.warn('Failed to resolve atlas relative to module.', error);
    }
    atlasCandidates.push('./assets/atlas.json');
    console.log('Atlas candidates:', atlasCandidates);
    
    let atlas = null;
    let lastError = null;
    for (const candidate of atlasCandidates) {
      if (!candidate || lastError?.metadataUrl === candidate) continue;
      try {
        console.log(`Attempting to load atlas from: ${candidate}`);
        atlas = await loadAtlas(null, candidate);
        console.log('Atlas loaded successfully:', !!atlas.img, !!atlas.meta);
        break;
      } catch (error) {
        lastError = Object.assign(error, { metadataUrl: candidate });
        console.warn(`Atlas load failed from ${candidate}`, error);
      }
    }
    if (!atlas) {
      throw lastError || new Error('Failed to load atlas metadata.');
    }
    renderer.setAtlas(atlas);
    console.log('Atlas set on renderer. Assets loaded:', renderer.assetsLoaded);
    try {
      await renderer.loadPlayerSprite(DEFAULT_PLAYER_SPRITE_SHEET);
      console.log('Player sprite sheet loaded:', DEFAULT_PLAYER_SPRITE_SHEET);
    } catch (spriteError) {
      console.warn('Failed to load default player sprite sheet:', spriteError);
    }
    renderer.ensureSpriteSheet(LORD_BRITISH_SPRITE_SHEET).catch((error) => {
      console.warn('Failed to preload Lord British sprite sheet:', error);
    });
  } catch (error) {
    console.error('Failed to load texture atlas.', error);
    return;
  }

  console.log('Starting renderer...');
  renderer.start();
  console.log('Renderer started. Running:', renderer.running);
  
  setupEventListeners();
  if (loadGame(false)) {
    return;
  }
  log('Welcome to Britannia Reborn. Create your hero.');
  const character = await creator.open();
  if (!character) return;
  giveStarterGear(character);
  state.character = character;
  state.player = new Player(character);
  state.map = state.world.startingMap;
  activeMovementDirections.clear();
  renderer.stopAllMovement();
  changeMap(state.map.id, 'castle_gate');
  renderInventory();
  renderCharacterSheet();
  updateHUD();
  renderGame();
  celebrateCastle();
  saveGame('new-adventurer', true);
  log('Use WASD or arrows to explore.');
  console.log('Bootstrap completed successfully');
}

bootstrap();
