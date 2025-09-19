// public/game.js - Tiny Ultima-like slice with a baker NPC and simple crafting.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hud = {
  fps: document.getElementById('hud-fps'),
  time: document.getElementById('hud-time'),
  room: document.getElementById('hud-room'),
  inventory: document.getElementById('hud-inventory')
};

const panel = {
  root: document.getElementById('interaction-panel'),
  title: document.getElementById('panel-title'),
  body: document.getElementById('panel-body'),
  actions: document.getElementById('panel-actions'),
  dialogue: document.getElementById('panel-dialogue'),
  talk: document.getElementById('panel-talk'),
  close: document.getElementById('panel-close')
};

const outlineCanvas = document.createElement('canvas');
const outlineCtx = outlineCanvas.getContext('2d');
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');

const STATE = {
  viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
  assets: {},
  rooms: [],
  room: null,
  player: null,
  camera: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
  keys: new Set(),
  lastFrame: performance.now(),
  fps: 0,
  timeOfDay: 8.5,
  timeRate: 0.25,
  ambient: 0.4,
  activeInteraction: null,
  tempWaypoints: [],
  worldFlags: {}
};

const ITEM_CATALOG = {
  flour: { id: 'flour', name: 'Bag of Flour' },
  water: { id: 'water', name: 'Bucket of Water' },
  flourPile: { id: 'flourPile', name: 'Pile of Flour' },
  dough: { id: 'dough', name: 'Bread Dough' },
  loaf: { id: 'loaf', name: 'Fresh Loaf' }
};

const QUEST_CATALOG = {
  bakers_helper: {
    id: 'bakers_helper',
    name: "Baker's Helper",
    stages: ['Talk to Mera', 'Bake a loaf together', 'Deliver the bread']
  },
  morning_customers: {
    id: 'morning_customers',
    name: 'Morning Customers',
    stages: ['Prepare stock', 'Serve the first guest']
  }
};

// TODO: Drop hand-painted sprites into public/assets/** to replace these placeholders.
const ASSET_MANIFEST = {
  player: { path: 'assets/sprites/player.png', width: 56, height: 84, color: '#78b7ff', label: 'PLAYER' },
  baker: { path: 'assets/sprites/baker.png', width: 56, height: 84, color: '#ff9cbc', label: 'BAKER' },
  table: { path: 'assets/props/table.png', width: 140, height: 80, color: '#cba36e', label: 'TABLE' },
  oven: { path: 'assets/props/oven.png', width: 110, height: 110, color: '#ffad62', label: 'OVEN' },
  flour: { path: 'assets/props/flour.png', width: 90, height: 96, color: '#e5e0d6', label: 'FLOUR' },
  barrel: { path: 'assets/props/barrel.png', width: 90, height: 96, color: '#6c8aa5', label: 'WATER' },
  shelf: { path: 'assets/props/shelf.png', width: 160, height: 110, color: '#8c6f53', label: 'SHELF' }
};

function resizeCanvas() {
  STATE.viewport.width = window.innerWidth;
  STATE.viewport.height = window.innerHeight;
  STATE.viewport.dpr = window.devicePixelRatio || 1;
  canvas.width = STATE.viewport.width * STATE.viewport.dpr;
  canvas.height = STATE.viewport.height * STATE.viewport.dpr;
  canvas.style.width = `${STATE.viewport.width}px`;
  canvas.style.height = `${STATE.viewport.height}px`;
  ctx.setTransform(STATE.viewport.dpr, 0, 0, STATE.viewport.dpr, 0, 0);
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
  lightCtx.setTransform(STATE.viewport.dpr, 0, 0, STATE.viewport.dpr, 0, 0);
  if (STATE.camera) {
    STATE.camera.width = STATE.viewport.width;
    STATE.camera.height = STATE.viewport.height;
  }
}

window.addEventListener('resize', resizeCanvas);

async function loadAssets() {
  const entries = await Promise.all(
    Object.entries(ASSET_MANIFEST).map(async ([key, def]) => {
      const image = await loadSprite(def).catch(() => createPlaceholder(def));
      return [key, image];
    })
  );
  return Object.fromEntries(entries);
}
function loadSprite(def) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Missing asset ${def.path}, using placeholder.`);
      resolve(createPlaceholder(def));
    };
    img.src = def.path;
    setTimeout(() => {
      if (!img.complete) {
        resolve(createPlaceholder(def));
      }
    }, 1500);
  });
}

function createPlaceholder(def) {
  const c = document.createElement('canvas');
  c.width = def.width;
  c.height = def.height;
  const cctx = c.getContext('2d');
  cctx.fillStyle = def.color;
  cctx.fillRect(0, 0, c.width, c.height);
  cctx.strokeStyle = 'rgba(0,0,0,0.4)';
  cctx.lineWidth = 4;
  cctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  cctx.fillStyle = 'rgba(0,0,0,0.6)';
  cctx.font = 'bold 12px sans-serif';
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  cctx.fillText(def.label, c.width / 2, c.height / 2);
  return c;
}

function setupInput() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
      STATE.keys.add(key);
      event.preventDefault();
    }
    if (key === 'e') {
      event.preventDefault();
      attemptInteract();
    }
  });
  window.addEventListener('keyup', (event) => {
    STATE.keys.delete(event.key.toLowerCase());
  });

  panel.close.addEventListener('click', () => {
    STATE.activeInteraction = null;
    refreshPanel();
  });

  panel.talk.addEventListener('click', () => {
    if (STATE.activeInteraction?.kind === 'npc') {
      talkToNpc(STATE.activeInteraction.target);
    }
  });
}

function initWorld(assets) {
  STATE.assets = assets;
  const room = {
    id: 'bakery',
    name: 'Bakery Kitchen',
    width: 1600,
    height: 1200,
    props: [],
    npcs: [],
    obstacles: []
  };

  const oven = {
    id: 'stone_oven',
    name: 'Stone Oven',
    kind: 'prop',
    x: 990,
    y: 520,
    width: 120,
    height: 120,
    sprite: assets.oven,
    solid: true,
    state: 'idle',
    timer: 0
  };

  const table = {
    id: 'prep_table',
    name: 'Preparation Table',
    kind: 'prop',
    x: 780,
    y: 600,
    width: 140,
    height: 86,
    sprite: assets.table,
    solid: true,
    state: 'empty'
  };

  const flourSacks = {
    id: 'flour_sacks',
    name: 'Flour Sacks',
    kind: 'prop',
    x: 620,
    y: 520,
    width: 110,
    height: 120,
    sprite: assets.flour,
    solid: true,
    resource: 'flour'
  };

  const waterBarrel = {
    id: 'water_barrel',
    name: 'Water Barrel',
    kind: 'prop',
    x: 620,
    y: 720,
    width: 110,
    height: 120,
    sprite: assets.barrel,
    solid: true,
    resource: 'water'
  };

  const shelf = {
    id: 'spice_shelf',
    name: 'Spice Shelf',
    kind: 'prop',
    x: 1080,
    y: 640,
    width: 150,
    height: 110,
    sprite: assets.shelf,
    solid: true
  };

  room.props.push(oven, table, flourSacks, waterBarrel, shelf);

  const baker = {
    id: 'npc_mera',
    name: 'Mera the Baker',
    kind: 'npc',
    x: 900,
    y: 680,
    width: 56,
    height: 84,
    sprite: assets.baker,
    solid: true,
    profile: 'Village baker. Warm, practical, expects honest effort.',
    memory: 'Met the new helper this morning.',
    log: []
  };

  room.npcs.push(baker);

  room.obstacles.push(
    { x: 520, y: 480, width: 420, height: 40 },
    { x: 520, y: 860, width: 460, height: 40 },
    { x: 520, y: 480, width: 40, height: 420 },
    { x: 940, y: 480, width: 40, height: 420 },
    { x: 520, y: 900, width: 540, height: 40 },
    { x: 520, y: 440, width: 540, height: 40 }
  );

  STATE.rooms = [room];
  STATE.room = room;
  STATE.player = {
    name: 'Avatar',
    x: 820,
    y: 760,
    width: 56,
    height: 84,
    speed: 220,
    inventory: ['flour', 'water'],
    quests: [],
    facing: 'south'
  };

  STATE.camera.x = STATE.player.x - STATE.viewport.width / 2;
  STATE.camera.y = STATE.player.y - STATE.viewport.height / 2;
  STATE.camera.width = STATE.viewport.width;
  STATE.camera.height = STATE.viewport.height;
  room.oven = oven;
  room.table = table;

  updateHud();
  refreshPanel();
}
function attemptInteract() {
  const target = findInteractable();
  if (!target) {
    STATE.activeInteraction = null;
    refreshPanel();
    return;
  }
  if (STATE.activeInteraction && STATE.activeInteraction.target === target) {
    STATE.activeInteraction = null;
  } else {
    STATE.activeInteraction = {
      target,
      kind: target.kind,
      lastDialogue: target.kind === 'npc' ? 'Mera dusts flour off her hands.' : ''
    };
  }
  refreshPanel();
}

function findInteractable() {
  if (!STATE.room) return null;
  const px = STATE.player.x + STATE.player.width / 2;
  const py = STATE.player.y + STATE.player.height / 2;
  let best = null;
  let bestDist = Infinity;
  const consider = [...STATE.room.props, ...STATE.room.npcs];
  for (const target of consider) {
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const dist = Math.hypot(px - tx, py - ty);
    if (dist < 150 && dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  return best;
}

function refreshPanel() {
  const interaction = STATE.activeInteraction;
  if (!interaction) {
    panel.root.hidden = true;
    return;
  }

  const target = interaction.target;
  panel.root.hidden = false;
  panel.title.textContent = target.name;
  panel.body.textContent = describeTarget(target);
  panel.dialogue.textContent = interaction.lastDialogue || '';
  panel.actions.innerHTML = '';

  const actions = buildActions(target);
  actions.forEach((action) => {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.addEventListener('click', () => {
      action.handler();
      refreshPanel();
      updateHud();
    });
    panel.actions.appendChild(button);
  });

  if (interaction.kind === 'npc') {
    panel.talk.disabled = false;
    panel.talk.style.display = 'inline-flex';
  } else {
    panel.talk.style.display = 'none';
  }
}

function describeTarget(target) {
  if (target.kind === 'npc') {
    return 'A cheerful baker with flour on her sleeves. Maybe she has advice.';
  }
  if (target.id === 'prep_table') {
    return `Prep table — current state: ${target.state === 'empty' ? 'clean' : target.state === 'flourPile' ? 'flour ready' : 'soft dough'}.`;
  }
  if (target.id === 'stone_oven') {
    const status = target.state === 'idle' ? 'idle hearth' : target.state === 'baking' ? 'baking dough' : 'ready loaf!';
    return `Stone oven • ${status}.`;
  }
  if (target.resource === 'flour') {
    return 'Sacks of flour stacked and waiting to be scooped.';
  }
  if (target.resource === 'water') {
    return 'A chilled barrel filled with fresh well water.';
  }
  return 'Wooden furniture adds warmth to the kitchen.';
}

function buildActions(target) {
  const actions = [];
  if (target.kind === 'npc') {
    actions.push({
      label: 'Trade Loaf',
      handler: () => {
        if (removeItem('loaf')) {
          addMessage('You hand Mera a loaf. She promises to pay later.');
          addQuestProgress('morning_customers', 2);
          STATE.activeInteraction.lastDialogue = 'Thank you! I will sell this at the stall.';
        } else {
          STATE.activeInteraction.lastDialogue = 'Bring me a fresh loaf and I will gladly buy it.';
        }
      }
    });
    return actions;
  }

  if (target.id === 'prep_table') {
    if (playerHas('flour') && target.state === 'empty') {
      actions.push({
        label: 'Sprinkle Flour',
        handler: () => {
          removeItem('flour');
          target.state = 'flourPile';
          addMessage('You spread flour across the table.');
        }
      });
    }
    if (playerHas('water') && target.state === 'flourPile') {
      actions.push({
        label: 'Add Water',
        handler: () => {
          removeItem('water');
          target.state = 'dough';
          addMessage('You knead the flour and water into dough.');
        }
      });
    }
    if (target.state === 'dough') {
      actions.push({
        label: 'Collect Dough',
        handler: () => {
          target.state = 'empty';
          addItem('dough');
          addMessage('Fresh dough rests in your satchel.');
        }
      });
    }
  }

  if (target.id === 'stone_oven') {
    if (playerHas('dough') && target.state === 'idle') {
      actions.push({
        label: 'Load Dough',
        handler: () => {
          removeItem('dough');
          target.state = 'baking';
          target.timer = 4.5;
          addMessage('You slide the dough into the glowing oven.');
        }
      });
    }
    if (target.state === 'baking') {
      actions.push({
        label: 'Peek Inside',
        handler: () => {
          STATE.activeInteraction.lastDialogue = 'The dough is rising. Give it another moment.';
        }
      });
    }
    if (target.state === 'ready') {
      actions.push({
        label: 'Take Loaf',
        handler: () => {
          target.state = 'idle';
          target.timer = 0;
          addItem('loaf');
          addQuestProgress('bakers_helper', 2);
          addMessage('You lift a golden loaf from the oven.');
        }
      });
    }
  }

  if (target.resource === 'flour') {
    actions.push({
      label: 'Scoop Flour',
      handler: () => {
        addItem('flour');
        addMessage('You scoop a bag of flour.');
      }
    });
  }
  if (target.resource === 'water') {
    actions.push({
      label: 'Draw Water',
      handler: () => {
        addItem('water');
        addMessage('You draw a bucket of cool water.');
      }
    });
  }

  return actions;
}
function playerHas(itemId) {
  return STATE.player.inventory.includes(itemId);
}

function addItem(itemId) {
  STATE.player.inventory.push(itemId);
}

function removeItem(itemId) {
  const index = STATE.player.inventory.indexOf(itemId);
  if (index !== -1) {
    STATE.player.inventory.splice(index, 1);
    return true;
  }
  return false;
}

function addQuestProgress(questId, stage) {
  const existing = STATE.player.quests.find((q) => q.id === questId);
  if (!existing) {
    STATE.player.quests.push({ id: questId, stage: stage || 1 });
    return;
  }
  if (stage && stage > existing.stage) {
    existing.stage = stage;
  }
}

function addMessage(text) {
  panel.dialogue.textContent = text;
}

async function talkToNpc(npc) {
  const snapshot = buildSnapshot(npc);
  panel.talk.disabled = true;
  panel.dialogue.textContent = 'Consulting the guild of bakers...';
  try {
    const response = await fetch('/npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      console.error('NPC JSON parse error', text);
      panel.dialogue.textContent = '⚠️ The baker mutters nonsense (invalid JSON).';
      return;
    }
    if (payload.error) {
      panel.dialogue.textContent = `⚠️ ${payload.error}`;
      return;
    }
    if (!validateNpcPayload(payload)) {
      panel.dialogue.textContent = '⚠️ The baker pauses; her reply made no sense.';
      return;
    }
    npc.log.push(payload.dialogue);
    if (npc.log.length > 4) npc.log.shift();
    npc.memory = npc.log.join(' | ').slice(-180);
    STATE.activeInteraction.lastDialogue = payload.dialogue;
    handleNpcActions(payload.actions, npc);
    panel.dialogue.textContent = payload.dialogue;
  } catch (err) {
    console.error(err);
    panel.dialogue.textContent = '⚠️ The wind drowns out her words (network error).';
  } finally {
    panel.talk.disabled = false;
  }
}

function validateNpcPayload(payload) {
  return payload && typeof payload.dialogue === 'string' && Array.isArray(payload.actions);
}

function handleNpcActions(actions, npc) {
  actions.forEach((action) => {
    switch (action.type) {
      case 'set_flag':
        if (action.flag) {
          STATE.worldFlags[action.flag] = action.value ?? true;
        }
        break;
      case 'give_item':
        if (action.item_id && ITEM_CATALOG[action.item_id]) {
          addItem(action.item_id);
          panel.dialogue.textContent += `\nReceived ${ITEM_CATALOG[action.item_id].name}.`;
        }
        break;
      case 'start_quest':
        if (action.quest_id) {
          addQuestProgress(action.quest_id, action.stage || 1);
        }
        break;
      case 'advance_quest':
        if (action.quest_id) {
          addQuestProgress(action.quest_id, action.stage || 2);
        }
        break;
      case 'set_waypoint':
        if (typeof action.x === 'number' && typeof action.y === 'number') {
          STATE.tempWaypoints.push({
            x: action.x,
            y: action.y,
            label: action.label || 'Waypoint',
            timer: 8
          });
        }
        break;
      default:
        break;
    }
  });
}

function buildSnapshot(npc) {
  const room = STATE.room;
  const oven = room.oven;
  return {
    npc_id: npc.id,
    npc_profile: npc.profile,
    npc_memory: npc.memory,
    player_state: {
      name: STATE.player.name,
      inventory: [...STATE.player.inventory]
    },
    location: {
      room: room.name,
      player: { x: Math.round(STATE.player.x), y: Math.round(STATE.player.y) },
      oven_status: oven.state
    },
    time_of_day: Number(STATE.timeOfDay.toFixed(2)),
    active_quests: STATE.player.quests.map((q) => ({ id: q.id, stage: q.stage }))
  };
}

function update(dt) {
  if (!STATE.room) return;
  updateTimeOfDay(dt);
  updatePlayer(dt);
  updateOven(dt);
  updateCamera();
  updateWaypoints(dt);
  updateHud();
}

function updateTimeOfDay(dt) {
  STATE.timeOfDay = (STATE.timeOfDay + dt * STATE.timeRate) % 24;
  const daylight = (Math.sin(((STATE.timeOfDay - 6) / 24) * Math.PI * 2) + 1) / 2;
  STATE.ambient = 0.25 + (1 - daylight) * 0.55;
}

function updatePlayer(dt) {
  const speed = STATE.player.speed;
  let vx = 0;
  let vy = 0;
  if (STATE.keys.has('w')) vy -= 1;
  if (STATE.keys.has('s')) vy += 1;
  if (STATE.keys.has('a')) vx -= 1;
  if (STATE.keys.has('d')) vx += 1;
  if (vx || vy) {
    const length = Math.hypot(vx, vy) || 1;
    vx = (vx / length) * speed * dt;
    vy = (vy / length) * speed * dt;
    moveWithCollision(STATE.player, vx, vy);
    if (Math.abs(vx) > Math.abs(vy)) {
      STATE.player.facing = vx > 0 ? 'east' : 'west';
    } else {
      STATE.player.facing = vy > 0 ? 'south' : 'north';
    }
  }
}

function updateOven(dt) {
  const oven = STATE.room.oven;
  if (oven.state === 'baking') {
    oven.timer -= dt;
    if (oven.timer <= 0) {
      oven.state = 'ready';
      oven.timer = 0;
      addMessage('The loaf is ready!');
    }
  }
  STATE.worldFlags.oven_status = oven.state;
}

function moveWithCollision(entity, dx, dy) {
  const room = STATE.room;
  const colliders = [...room.obstacles, ...room.props.filter((p) => p.solid), ...room.npcs.filter((n) => n.solid)];

  entity.x += dx;
  if (colliders.some((col) => col !== entity && rectsOverlap(entity, col))) {
    entity.x -= dx;
  }

  entity.y += dy;
  if (colliders.some((col) => col !== entity && rectsOverlap(entity, col))) {
    entity.y -= dy;
  }

  entity.x = clamp(entity.x, 480, room.width - entity.width - 200);
  entity.y = clamp(entity.y, 460, room.height - entity.height - 220);
}

function updateCamera() {
  const camera = STATE.camera;
  const player = STATE.player;
  const room = STATE.room;
  const deadzoneWidth = camera.width * 0.3;
  const deadzoneHeight = camera.height * 0.35;
  const dzLeft = camera.x + (camera.width - deadzoneWidth) / 2;
  const dzRight = dzLeft + deadzoneWidth;
  const dzTop = camera.y + (camera.height - deadzoneHeight) / 2;
  const dzBottom = dzTop + deadzoneHeight;
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  if (px < dzLeft) camera.x -= dzLeft - px;
  if (px > dzRight) camera.x += px - dzRight;
  if (py < dzTop) camera.y -= dzTop - py;
  if (py > dzBottom) camera.y += py - dzBottom;

  camera.x = clamp(camera.x, 480 - camera.width / 2, room.width - camera.width - 200);
  camera.y = clamp(camera.y, 440 - camera.height / 2, room.height - camera.height - 200);
}
function updateWaypoints(dt) {
  STATE.tempWaypoints = STATE.tempWaypoints.filter((waypoint) => {
    waypoint.timer -= dt;
    return waypoint.timer > 0;
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateHud() {
  hud.fps.textContent = STATE.fps.toFixed(0);
  hud.time.textContent = describeTimeOfDay(STATE.timeOfDay);
  hud.room.textContent = STATE.room ? STATE.room.name : '--';
  hud.inventory.textContent = STATE.player.inventory
    .map((id) => ITEM_CATALOG[id]?.name || id)
    .join(', ') || 'Empty';
}

function describeTimeOfDay(time) {
  const hour = Math.floor(time);
  const minute = Math.floor((time % 1) * 60);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const label = hour < 5 ? 'Night' : hour < 8 ? 'Dawn' : hour < 12 ? 'Morning' : hour < 17 ? 'Day' : hour < 21 ? 'Evening' : 'Late';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${label} ${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

function draw() {
  if (!STATE.room) return;
  ctx.save();
  ctx.clearRect(0, 0, STATE.viewport.width, STATE.viewport.height);
  drawBackground();
  drawWorld();
  drawWaypoints();
  applyLighting();
  ctx.restore();
}

function drawBackground() {
  const camera = STATE.camera;
  const tile = 80;
  const startX = Math.floor(camera.x / tile) * tile;
  const startY = Math.floor(camera.y / tile) * tile;
  const cols = Math.ceil(STATE.viewport.width / tile) + 2;
  const rows = Math.ceil(STATE.viewport.height / tile) + 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const worldX = startX + x * tile;
      const worldY = startY + y * tile;
      const screenX = worldX - camera.x;
      const screenY = worldY - camera.y;
      const shade = (x + y) % 2 === 0 ? '#3b2d2a' : '#342621';
      ctx.fillStyle = shade;
      ctx.fillRect(screenX, screenY, tile, tile);
    }
  }
}

function drawWorld() {
  const camera = STATE.camera;
  const room = STATE.room;
  const renderables = [];
  room.props.forEach((prop) => renderables.push({ entity: prop, order: prop.y + prop.height }));
  room.npcs.forEach((npc) => renderables.push({ entity: npc, order: npc.y + npc.height }));
  renderables.push({ entity: STATE.player, order: STATE.player.y + STATE.player.height });
  renderables.sort((a, b) => a.order - b.order);

  renderables.forEach(({ entity }) => {
    const screenX = Math.round(entity.x - camera.x);
    const screenY = Math.round(entity.y - camera.y);
    drawEntity(entity, screenX, screenY);
  });
}

function drawEntity(entity, screenX, screenY) {
  const width = entity.width;
  const height = entity.height;
  const sprite = entity.sprite;
  drawWithOutline((bufferCtx) => {
    if (sprite) {
      bufferCtx.drawImage(sprite, 0, 0, width, height);
    } else {
      bufferCtx.fillStyle = '#888';
      bufferCtx.fillRect(0, 0, width, height);
    }
    if (entity.id === 'prep_table') {
      if (entity.state === 'flourPile') {
        bufferCtx.fillStyle = 'rgba(245, 236, 210, 0.9)';
        bufferCtx.fillRect(width * 0.2, height * 0.45, width * 0.6, height * 0.15);
      }
      if (entity.state === 'dough') {
        bufferCtx.fillStyle = 'rgba(214, 165, 120, 0.95)';
        bufferCtx.beginPath();
        bufferCtx.ellipse(width / 2, height * 0.55, width * 0.3, height * 0.18, 0, 0, Math.PI * 2);
        bufferCtx.fill();
      }
    }
    if (entity.id === 'stone_oven' && entity.state === 'ready') {
      bufferCtx.fillStyle = 'rgba(255, 215, 160, 0.7)';
      bufferCtx.fillRect(width * 0.35, height * 0.55, width * 0.3, height * 0.18);
    }
  }, screenX, screenY, width, height);
}

function drawWithOutline(drawBody, x, y, width, height) {
  const pad = 4;
  outlineCanvas.width = width + pad;
  outlineCanvas.height = height + pad;
  outlineCtx.setTransform(1, 0, 0, 1, 0, 0);
  outlineCtx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);

  const offsets = [
    [0, pad / 2],
    [pad, pad / 2],
    [pad / 2, 0],
    [pad / 2, pad],
    [1, 1],
    [pad - 1, 1],
    [1, pad - 1],
    [pad - 1, pad - 1]
  ];

  outlineCtx.save();
  outlineCtx.filter = 'brightness(0%)';
  offsets.forEach(([ox, oy]) => {
    outlineCtx.save();
    outlineCtx.translate(ox, oy);
    drawBody(outlineCtx);
    outlineCtx.restore();
  });
  outlineCtx.restore();

  outlineCtx.globalCompositeOperation = 'source-in';
  outlineCtx.fillStyle = 'rgba(10, 12, 30, 0.9)';
  outlineCtx.fillRect(0, 0, outlineCanvas.width, outlineCanvas.height);
  outlineCtx.globalCompositeOperation = 'source-over';
  outlineCtx.save();
  outlineCtx.translate(pad / 2, pad / 2);
  drawBody(outlineCtx);
  outlineCtx.restore();

  ctx.drawImage(outlineCanvas, x - pad / 2, y - pad / 2);
}

function drawWaypoints() {
  const camera = STATE.camera;
  ctx.save();
  ctx.lineWidth = 2;
  STATE.tempWaypoints.forEach((wp) => {
    const sx = wp.x - camera.x;
    const sy = wp.y - camera.y;
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy);
    ctx.lineTo(sx, sy - 14);
    ctx.lineTo(sx + 10, sy);
    ctx.lineTo(sx, sy + 14);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(120, 200, 255, 0.3)';
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 240, 255, 0.9)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wp.label, sx, sy + 26);
  });
  ctx.restore();
}

function applyLighting() {
  const camera = STATE.camera;
  const lights = buildLights();
  const { width, height, dpr } = STATE.viewport;
  lightCanvas.width = width * dpr;
  lightCanvas.height = height * dpr;
  lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lightCtx.clearRect(0, 0, width, height);
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = `rgba(6, 8, 16, ${STATE.ambient})`;
  lightCtx.fillRect(0, 0, width, height);
  lightCtx.globalCompositeOperation = 'destination-out';

  lights.forEach((light) => {
    const radius = light.radius;
    for (let step = 3; step >= 1; step--) {
      lightCtx.globalAlpha = step === 3 ? 0.35 : step === 2 ? 0.55 : 0.85;
      lightCtx.beginPath();
      lightCtx.arc(
        light.x - camera.x,
        light.y - camera.y,
        (radius * step) / 3,
        0,
        Math.PI * 2
      );
      lightCtx.fill();
    }
  });
  lightCtx.globalAlpha = 1;
  lightCtx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lightCanvas, 0, 0);
  ctx.restore();

  ctx.save();
  lights.forEach((light) => {
    const sx = light.x - camera.x;
    const sy = light.y - camera.y;
    const gradient = ctx.createRadialGradient(
      sx,
      sy,
      0,
      sx,
      sy,
      light.radius * 0.6
    );
    gradient.addColorStop(0, light.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(sx, sy, light.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function buildLights() {
  const oven = STATE.room.oven;
  const lights = [
    {
      x: oven.x + oven.width / 2,
      y: oven.y + oven.height * 0.6,
      radius: oven.state === 'baking' ? 260 : 200,
      color: 'rgba(255, 180, 110, 0.55)'
    },
    {
      x: STATE.player.x + STATE.player.width / 2,
      y: STATE.player.y + STATE.player.height / 2,
      radius: 180,
      color: 'rgba(150, 200, 255, 0.2)'
    }
  ];
  STATE.room.npcs.forEach((npc) => {
    lights.push({
      x: npc.x + npc.width / 2,
      y: npc.y + npc.height / 2,
      radius: 150,
      color: 'rgba(255, 190, 150, 0.25)'
    });
  });
  return lights;
}

function gameLoop(now) {
  const dt = Math.min((now - STATE.lastFrame) / 1000, 0.1);
  STATE.lastFrame = now;
  STATE.fps = STATE.fps * 0.92 + (1 / dt) * 0.08;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

async function start() {
  resizeCanvas();
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Loading bakery...', 24, 36);
  const assets = await loadAssets();
  setupInput();
  initWorld(assets);
  STATE.lastFrame = performance.now();
  requestAnimationFrame(gameLoop);
}

start();
