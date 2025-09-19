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

const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const FLOOR_TILE_SIZE = 96;
const floorTileCache = new Map();
const COLOR_CACHE = new Map();
const COLOR_CANVAS = document.createElement('canvas');
COLOR_CANVAS.width = COLOR_CANVAS.height = 1;
const COLOR_CTX = COLOR_CANVAS.getContext('2d');

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseColor(color) {
  if (!color) return null;
  if (COLOR_CACHE.has(color)) {
    const cached = COLOR_CACHE.get(color);
    return { ...cached };
  }
  try {
    COLOR_CTX.clearRect(0, 0, 1, 1);
    COLOR_CTX.fillStyle = '#000';
    COLOR_CTX.fillRect(0, 0, 1, 1);
    COLOR_CTX.fillStyle = color;
    COLOR_CTX.fillRect(0, 0, 1, 1);
    const data = COLOR_CTX.getImageData(0, 0, 1, 1).data;
    const parsed = { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
    COLOR_CACHE.set(color, parsed);
    return { ...parsed };
  } catch (err) {
    return null;
  }
}

function adjustColor(color, amount) {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const adjust = (component) => {
    if (amount >= 0) {
      return clampByte(component + (255 - component) * amount);
    }
    return clampByte(component + component * amount);
  };
  return `rgb(${adjust(parsed.r)}, ${adjust(parsed.g)}, ${adjust(parsed.b)})`;
}

function mixColors(colorA, colorB, ratio) {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!a || !b) return colorA;
  const t = Math.max(0, Math.min(1, ratio));
  const lerp = (start, end) => clampByte(start + (end - start) * t);
  return `rgb(${lerp(a.r, b.r)}, ${lerp(a.g, b.g)}, ${lerp(a.b, b.b)})`;
}

function colorAlpha(color, fallback = 1) {
  const parsed = parseColor(color);
  if (!parsed) return fallback;
  if (typeof parsed.a === 'number') {
    return Math.max(0, Math.min(1, parsed.a));
  }
  return fallback;
}

function rgbString(parsed, alpha = 1) {
  const value = Math.max(0, Math.min(1, alpha));
  return `rgba(${clampByte(parsed.r)}, ${clampByte(parsed.g)}, ${clampByte(parsed.b)}, ${value})`;
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function getFloorTileTexture(room, baseColor, variant) {
  const key = `${room?.id || 'default'}|${baseColor}|${variant}`;
  if (floorTileCache.has(key)) {
    return floorTileCache.get(key);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FLOOR_TILE_SIZE;
  const buffer = canvas.getContext('2d');
  const highlight = adjustColor(baseColor, 0.22);
  const shadow = adjustColor(baseColor, -0.2);
  const gradient = buffer.createLinearGradient(0, 0, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(0.45, baseColor);
  gradient.addColorStop(1, shadow);
  buffer.fillStyle = gradient;
  buffer.fillRect(0, 0, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);

  const vertical = buffer.createLinearGradient(0, 0, 0, FLOOR_TILE_SIZE);
  vertical.addColorStop(0, adjustColor(baseColor, 0.18));
  vertical.addColorStop(0.5, adjustColor(baseColor, -0.05));
  vertical.addColorStop(1, adjustColor(baseColor, -0.28));
  buffer.globalAlpha = 0.55;
  buffer.fillStyle = vertical;
  buffer.fillRect(0, 0, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
  buffer.globalAlpha = 1;

  const accentBase = room?.theme?.tint
    ? rgbString(parseColor(`rgba(${room.theme.tint[0]}, ${room.theme.tint[1]}, ${room.theme.tint[2]}, 1)`), 0.6)
    : mixColors(baseColor, '#f5e0c3', 0.2);
  buffer.globalCompositeOperation = 'overlay';
  buffer.fillStyle = mixColors(accentBase, baseColor, 0.35);
  buffer.fillRect(0, 0, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
  buffer.globalCompositeOperation = 'source-over';

  const speckles = 36 + variant * 12;
  for (let i = 0; i < speckles; i += 1) {
    const size = randomInRange(1, 3.8);
    const x = randomInRange(0, FLOOR_TILE_SIZE);
    const y = randomInRange(0, FLOOR_TILE_SIZE);
    buffer.fillStyle = `rgba(255, 255, 255, ${0.045 + variant * 0.005})`;
    buffer.fillRect(x, y, size, size * randomInRange(0.6, 1.4));
  }

  for (let i = 0; i < speckles * 1.5; i += 1) {
    const size = randomInRange(0.4, 2.6);
    const x = randomInRange(0, FLOOR_TILE_SIZE);
    const y = randomInRange(0, FLOOR_TILE_SIZE);
    buffer.fillStyle = `rgba(20, 18, 16, ${0.05 + variant * 0.01})`;
    buffer.fillRect(x, y, size, size);
  }

  buffer.globalAlpha = 0.25 + variant * 0.05;
  buffer.strokeStyle = `rgba(255, 255, 255, ${0.45 - variant * 0.08})`;
  buffer.beginPath();
  buffer.moveTo(-4, FLOOR_TILE_SIZE * 0.35);
  buffer.lineTo(FLOOR_TILE_SIZE + 4, FLOOR_TILE_SIZE * 0.2);
  buffer.moveTo(-4, FLOOR_TILE_SIZE * 0.85);
  buffer.lineTo(FLOOR_TILE_SIZE + 4, FLOOR_TILE_SIZE * 0.65);
  buffer.stroke();
  buffer.globalAlpha = 1;

  buffer.strokeStyle = `rgba(0, 0, 0, ${0.25 + variant * 0.06})`;
  buffer.lineWidth = 2;
  buffer.strokeRect(1, 1, FLOOR_TILE_SIZE - 2, FLOOR_TILE_SIZE - 2);

  floorTileCache.set(key, canvas);
  return canvas;
}

function computeVariant(x, y) {
  const seed = Math.abs(x * 73856093 + y * 19349663);
  return seed % 4;
}

function wrapHour(value) {
  const remainder = value % HOURS_PER_DAY;
  return remainder < 0 ? remainder + HOURS_PER_DAY : remainder;
}

function createGameClock(initialHour = 8.5) {
  let referenceTime = performance.now();
  let referenceHour = wrapHour(initialHour);
  let rate = 1;

  return {
    get timeOfDay() {
      const elapsedHours = ((performance.now() - referenceTime) / MILLISECONDS_PER_HOUR) * rate;
      return wrapHour(referenceHour + elapsedHours);
    },
    setTimeOfDay(hour) {
      referenceHour = wrapHour(hour);
      referenceTime = performance.now();
    },
    setRate(newRate) {
      if (typeof newRate !== 'number' || !Number.isFinite(newRate) || newRate <= 0) {
        return;
      }
      const currentHour = this.timeOfDay;
      rate = newRate;
      referenceHour = currentHour;
      referenceTime = performance.now();
    }
  };
}

const GameClock = createGameClock(8.5);
if (typeof window !== 'undefined') {
  window.GameClock = GameClock;
}

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
  timeOfDay: GameClock.timeOfDay,
  ambient: 0.4,
  sunlight: 1,
  nightFactor: 0,
  nightOverlayAlpha: 0,
  nightAmbientBoost: 1,
  activeInteraction: null,
  tempWaypoints: [],
  worldFlags: {},
  particles: [],
  particleTimers: { dust: 0, ember: 0 },
  world3d: { initialized: false, api: null, lastLightSignature: '', failed: false }
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

  GameClock.setTimeOfDay(8.5);
  updateTimeOfDay();

  STATE.particles.length = 0;
  STATE.particleTimers.dust = 0;
  STATE.particleTimers.ember = 0;
  STATE.world3d.lastLightSignature = '';

  const bakery = createBakeryKitchen(assets);
  const moonlitPlaza = createMoonlitPlaza(assets);

  STATE.rooms = [bakery, moonlitPlaza];
  STATE.room = bakery;
  STATE.rooms.forEach((room) => alignRoomNpcSchedules(room));
  const spawn = bakery.spawn || { x: 820, y: 760 };

  STATE.player = {
    name: 'Avatar',
    x: spawn.x,
    y: spawn.y,
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

  updateHud();
  refreshPanel();
}

function alignRoomNpcSchedules(room) {
  if (!room || !Array.isArray(room.npcs)) return;
  room.npcs.forEach((npc) => alignNpcToSchedule(npc));
}

function alignNpcToSchedule(npc) {
  if (!npc) return;
  if (!Array.isArray(npc.schedule) || npc.schedule.length === 0) {
    npc.currentAction = npc.currentAction || 'idle';
    return;
  }

  const block = getActiveScheduleBlock(npc.schedule, STATE.timeOfDay);
  npc.currentSchedule = block;
  npc.currentAction = block?.action || 'idle';

  if (block?.waypoint && typeof block.waypoint.x === 'number' && typeof block.waypoint.y === 'number') {
    npc.currentWaypoint = { x: block.waypoint.x, y: block.waypoint.y };
    npc.x = block.waypoint.x - npc.width / 2;
    npc.y = block.waypoint.y - npc.height / 2;
  } else {
    npc.currentWaypoint = null;
  }
  npc.isMoving = false;
}

function createBakeryKitchen(assets) {
  const room = {
    id: 'bakery',
    name: 'Bakery Kitchen',
    width: 1600,
    height: 1200,
    props: [],
    npcs: [],
    obstacles: [],
    spawn: { x: 820, y: 760 },
    floorPalette: ['#3b2d2a', '#342621'],
    backgroundLayers: [
      {
        imageURL: 'assets/backgrounds/bakery/sky.png',
        // TODO: Drop a distant skyline or rafters image into public/assets/backgrounds/bakery/sky.png
        parallax: 0.08
      },
      {
        imageURL: 'assets/backgrounds/bakery/walls.png',
        // TODO: Paint a wall texture for the bakery interior at public/assets/backgrounds/bakery/walls.png
        parallax: 0.32
      },
      {
        imageURL: 'assets/backgrounds/bakery/details.png',
        // TODO: Add foreground shelving silhouettes to public/assets/backgrounds/bakery/details.png
        parallax: 0.6
      }
    ],
    theme: {
      ambientDarkness: 1.15,
      tint: [255, 180, 120, 0.08]
    }
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

  const bakerWork = {
    x: oven.x + oven.width * 0.45,
    y: oven.y + oven.height * 0.75
  };
  const bakerHome = {
    x: table.x - 80,
    y: table.y + 190
  };
  const bakerTavern = {
    x: 860,
    y: 560
  };

  const baker = {
    id: 'npc_mera',
    name: 'Mera the Baker',
    kind: 'npc',
    x: bakerWork.x - 28,
    y: bakerWork.y - 42,
    width: 56,
    height: 84,
    sprite: assets.baker,
    solid: true,
    speed: 90,
    arrivalThreshold: 6,
    profile: 'Village baker. Warm, practical, expects honest effort.',
    memory: 'Met the new helper this morning.',
    log: [],
    schedule: [
      { start: 0, end: 5, action: 'sleep', waypoint: bakerHome },
      { start: 5, end: 12, action: 'work', waypoint: bakerWork },
      { start: 12, end: 14, action: 'tavern', waypoint: bakerTavern },
      { start: 14, end: 19, action: 'work', waypoint: bakerWork },
      { start: 19, end: 21, action: 'tavern', waypoint: bakerTavern },
      { start: 21, end: 24, action: 'sleep', waypoint: bakerHome }
    ],
    scheduleDescriptions: {
      work: 'Mera focuses on kneading dough at her workstation.',
      tavern: 'Mera slips out to the tavern for a hearty meal.',
      sleep: 'Mera looks ready to close the shutters and head home to rest.'
    }
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

  room.oven = oven;
  room.table = table;

  prepareBackgroundLayers(room);
  return room;
}

function createMoonlitPlaza(assets) {
  const room = {
    id: 'moonlit_plaza',
    name: 'Moonlit Plaza',
    width: 2000,
    height: 1400,
    props: [],
    npcs: [],
    obstacles: [],
    spawn: { x: 1080, y: 900 },
    floorPalette: ['#1b2734', '#16202b'],
    backgroundLayers: [
      {
        imageURL: 'assets/backgrounds/plaza/stars.png',
        // TODO: Paint a night sky full of stars at public/assets/backgrounds/plaza/stars.png
        parallax: 0.02
      },
      {
        imageURL: 'assets/backgrounds/plaza/treeline.png',
        // TODO: Add silhouetted treetops at public/assets/backgrounds/plaza/treeline.png
        parallax: 0.18
      },
      {
        imageURL: 'assets/backgrounds/plaza/market.png',
        // TODO: Illustrate lanterns or distant stalls at public/assets/backgrounds/plaza/market.png
        parallax: 0.5
      }
    ],
    theme: {
      ambientDarkness: 0.85,
      tint: [120, 180, 255, 0.16]
    }
  };

  const marketStall = {
    id: 'market_stall',
    name: 'Pop-up Stall',
    kind: 'prop',
    x: 980,
    y: 880,
    width: 140,
    height: 86,
    sprite: assets.table,
    solid: true
  };

  const stackedCrates = {
    id: 'stacked_crates',
    name: 'Stacked Crates',
    kind: 'prop',
    x: 860,
    y: 820,
    width: 110,
    height: 120,
    sprite: assets.flour,
    solid: true
  };

  const waterCart = {
    id: 'water_cart',
    name: 'Water Cart',
    kind: 'prop',
    x: 1160,
    y: 940,
    width: 110,
    height: 120,
    sprite: assets.barrel,
    solid: false
  };

  room.props.push(marketStall, stackedCrates, waterCart);

  const vendorStall = {
    x: marketStall.x + marketStall.width / 2,
    y: marketStall.y + marketStall.height / 2
  };
  const vendorPrep = {
    x: vendorStall.x - 200,
    y: vendorStall.y + 140
  };
  const vendorCamp = {
    x: vendorStall.x + 220,
    y: vendorStall.y + 160
  };

  const vendor = {
    id: 'npc_elio',
    name: 'Elio the Night Vendor',
    kind: 'npc',
    x: vendorStall.x - 28,
    y: vendorStall.y - 42,
    width: 56,
    height: 84,
    sprite: assets.baker,
    solid: true,
    speed: 70,
    arrivalThreshold: 8,
    profile: 'Travelling merchant selling midnight pastries.',
    memory: 'Waiting for new stories from distant towns.',
    log: [],
    schedule: [
      { start: 0, end: 10, action: 'camp', waypoint: vendorCamp },
      { start: 10, end: 18, action: 'prep', waypoint: vendorPrep },
      { start: 18, end: 24, action: 'work', waypoint: vendorStall }
    ],
    scheduleDescriptions: {
      camp: 'Elio naps beside his wagon, dreaming of new recipes.',
      prep: 'Elio samples pastries while setting up for the evening crowd.',
      work: 'Elio mans the night stall with a bright grin.'
    }
  };

  room.npcs.push(vendor);

  room.obstacles.push(
    { x: 780, y: 840, width: 520, height: 36 },
    { x: 780, y: 960, width: 520, height: 36 },
    { x: 780, y: 840, width: 36, height: 156 },
    { x: 1264, y: 840, width: 36, height: 156 }
  );

  prepareBackgroundLayers(room);
  return room;
}

function prepareBackgroundLayers(room) {
  if (!room.backgroundLayers) return;
  room.backgroundLayers.forEach((layer) => {
    if (!layer || layer.image || !layer.imageURL) return;
    const img = new Image();
    img.onload = () => {
      layer.ready = true;
    };
    img.onerror = () => {
      layer.failed = true;
    };
    img.src = layer.imageURL;
    layer.image = img;
  });
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
    if (target.scheduleDescriptions && target.currentAction) {
      const desc = target.scheduleDescriptions[target.currentAction];
      if (desc) {
        return desc;
      }
    }
    if (target.profile) {
      return target.profile;
    }
    return 'A villager going about their day.';
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
      oven_status: oven ? oven.state : 'none'
    },
    timeOfDay: Number(STATE.timeOfDay.toFixed(2)),
    active_quests: STATE.player.quests.map((q) => ({ id: q.id, stage: q.stage }))
  };
}

function update(dt) {
  if (!STATE.room) return;
  updateTimeOfDay();
  updatePlayer(dt);
  updateNPCs(dt);
  updateOven(dt);
  updateCamera();
  updateWaypoints(dt);
  updateParticles(dt);
  updateHud();
}

function updateTimeOfDay() {
  STATE.timeOfDay = GameClock.timeOfDay;
  const daylight = clamp((Math.sin(((STATE.timeOfDay - 6) / HOURS_PER_DAY) * Math.PI * 2) + 1) / 2, 0, 1);
  STATE.sunlight = daylight;
  STATE.nightFactor = 1 - daylight;
  STATE.ambient = clamp(0.22 + STATE.nightFactor * 0.7, 0, 1);
  STATE.nightOverlayAlpha = Math.pow(STATE.nightFactor, 1.4) * 0.55;
  STATE.nightAmbientBoost = 1 + STATE.nightFactor * 0.35;
}

function updateNPCs(dt) {
  if (!STATE.rooms || !STATE.rooms.length) return;
  STATE.rooms.forEach((room) => {
    if (!room || !Array.isArray(room.npcs)) return;
    room.npcs.forEach((npc) => updateNpcForRoom(npc, room, dt));
  });
}

function updateNpcForRoom(npc, room, dt) {
  if (!npc || !room || !Array.isArray(npc.schedule) || npc.schedule.length === 0) {
    return;
  }

  const block = getActiveScheduleBlock(npc.schedule, STATE.timeOfDay);
  if (block !== npc.currentSchedule) {
    npc.currentSchedule = block;
    npc.currentAction = block?.action || 'idle';
    if (block?.waypoint && typeof block.waypoint.x === 'number' && typeof block.waypoint.y === 'number') {
      npc.currentWaypoint = { x: block.waypoint.x, y: block.waypoint.y };
    } else {
      npc.currentWaypoint = null;
    }
  }

  const waypoint = npc.currentWaypoint;
  if (!waypoint) {
    npc.isMoving = false;
    return;
  }

  const destX = waypoint.x - npc.width / 2;
  const destY = waypoint.y - npc.height / 2;
  const dx = destX - npc.x;
  const dy = destY - npc.y;
  const distance = Math.hypot(dx, dy);
  const tolerance = Math.max(npc.arrivalThreshold || 4, 1);

  if (distance <= tolerance) {
    npc.x = destX;
    npc.y = destY;
    npc.isMoving = false;
    return;
  }

  const speed = (npc.speed || 100) * dt;
  if (speed <= 0) {
    return;
  }

  const step = Math.min(distance, speed);
  const stepX = (dx / distance) * step;
  const stepY = (dy / distance) * step;

  moveWithCollision(npc, stepX, stepY, room);
  npc.isMoving = true;

  if (Math.abs(stepX) > Math.abs(stepY)) {
    npc.facing = stepX > 0 ? 'east' : 'west';
  } else if (Math.abs(stepY) > 0.001) {
    npc.facing = stepY > 0 ? 'south' : 'north';
  }
}

function getActiveScheduleBlock(schedule, time) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  const normalizedTime = wrapHour(time);
  let fallback = null;
  for (const block of schedule) {
    if (!block || typeof block.start !== 'number' || typeof block.end !== 'number') {
      continue;
    }
    fallback = fallback || block;
    if (isTimeWithinRange(normalizedTime, block.start, block.end)) {
      return block;
    }
  }
  return fallback;
}

function isTimeWithinRange(time, start, end) {
  const normalizedStart = wrapHour(start);
  const normalizedEnd = wrapHour(end);
  if (normalizedStart === normalizedEnd) {
    return true;
  }
  if (normalizedStart < normalizedEnd) {
    return time >= normalizedStart && time < normalizedEnd;
  }
  return time >= normalizedStart || time < normalizedEnd;
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
  if (!oven) {
    return;
  }
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

function moveWithCollision(entity, dx, dy, room = STATE.room) {
  if (!room) return;
  const colliders = [
    ...room.obstacles,
    ...room.props.filter((p) => p.solid),
    ...room.npcs.filter((n) => n.solid && n !== entity)
  ];
  if (entity !== STATE.player && room === STATE.room && STATE.player) {
    colliders.push(STATE.player);
  }

  entity.x += dx;
  if (colliders.some((col) => rectsOverlap(entity, col))) {
    entity.x -= dx;
  }

  entity.y += dy;
  if (colliders.some((col) => rectsOverlap(entity, col))) {
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
  const lights = buildLights();
  ctx.save();
  ctx.clearRect(0, 0, STATE.viewport.width, STATE.viewport.height);
  drawBackground();
  drawWorld();
  drawParticles();
  applyRoomTint();
  drawWaypoints();
  applyLighting(lights);
  applyAtmospherics(lights);
  ctx.restore();
  renderThreeOverlay(lights);
}

function drawBackground() {
  if (!STATE.room) return;
  ctx.save();
  drawParallaxLayers();
  drawFloorTiles();
  ctx.restore();
}

function drawParallaxLayers() {
  const room = STATE.room;
  const layers = room.backgroundLayers || [];
  if (!layers.length) return;
  const camera = STATE.camera;
  const viewport = STATE.viewport;
  let drewLayer = false;

  layers.forEach((layer, index) => {
    if (!layer) return;
    const parallax = typeof layer.parallax === 'number' ? layer.parallax : 0;
    const offsetX = camera.x * parallax;
    const offsetY = camera.y * parallax;
    const image = layer.image;
    const ready =
      image &&
      !layer.failed &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0;

    if (ready) {
      const patternWidth = image.width;
      const patternHeight = image.height;
      if (!patternWidth || !patternHeight) {
        return;
      }
      const remainderX = ((offsetX % patternWidth) + patternWidth) % patternWidth;
      const remainderY = ((offsetY % patternHeight) + patternHeight) % patternHeight;
      const startX = -remainderX;
      const startY = -remainderY;
      for (let y = startY; y < viewport.height; y += patternHeight) {
        for (let x = startX; x < viewport.width; x += patternWidth) {
          ctx.drawImage(image, Math.round(x), Math.round(y), patternWidth, patternHeight);
        }
      }
      drewLayer = true;
    } else {
      ctx.fillStyle = buildParallaxFallbackColor(index, room.theme);
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }
  });

  if (drewLayer) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createLinearGradient(0, 0, 0, viewport.height);
    glow.addColorStop(0, `rgba(255, 220, 180, ${0.12 + STATE.sunlight * 0.22})`);
    glow.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    glow.addColorStop(1, `rgba(90, 140, 255, ${0.14 + STATE.nightFactor * 0.28})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.restore();
  }
}

function drawFloorTiles() {
  const room = STATE.room;
  const camera = STATE.camera;
  const tile = FLOOR_TILE_SIZE;
  const startX = Math.floor(camera.x / tile) * tile;
  const startY = Math.floor(camera.y / tile) * tile;
  const cols = Math.ceil(STATE.viewport.width / tile) + 2;
  const rows = Math.ceil(STATE.viewport.height / tile) + 2;
  const palette =
    room.floorPalette && room.floorPalette.length
      ? room.floorPalette
      : ['#3b2d2a', '#342621'];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const worldX = startX + x * tile;
      const worldY = startY + y * tile;
      const screenX = worldX - camera.x;
      const screenY = worldY - camera.y;
      const paletteIndex = Math.abs((Math.floor(worldX / tile) + Math.floor(worldY / tile)) % palette.length);
      const color = palette[paletteIndex];
      const variant = computeVariant(Math.floor(worldX / tile), Math.floor(worldY / tile));
      const tileTexture = getFloorTileTexture(room, color, variant);
      ctx.drawImage(tileTexture, screenX, screenY);
      ctx.save();
      ctx.globalAlpha = 0.08 + STATE.sunlight * 0.06;
      ctx.fillStyle = `rgba(255, 240, 210, ${0.3 + STATE.sunlight * 0.3})`;
      ctx.fillRect(screenX, screenY, tile, tile * 0.08);
      ctx.restore();
    }
  }
}

function buildParallaxFallbackColor(index, theme) {
  const [tr = 48, tg = 42, tb = 36] = theme?.tint || [];
  const delta = index * 18 - 12;
  const adjust = (value) => clamp(Math.round(value + delta), 0, 255);
  const alpha = clamp(0.35 + index * 0.25, 0.25, 0.85);
  return `rgba(${adjust(tr)}, ${adjust(tg)}, ${adjust(tb)}, ${alpha})`;
}

function applyRoomTint() {
  const theme = STATE.room?.theme;
  if (!theme || !Array.isArray(theme.tint) || theme.tint.length < 4) return;
  const [r, g, b, a] = theme.tint;
  if (!a) return;
  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
  ctx.fillRect(0, 0, STATE.viewport.width, STATE.viewport.height);
  ctx.restore();
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
    drawEntityShadow(entity, screenX, screenY);
    drawEntity(entity, screenX, screenY);
  });
}

function drawEntityShadow(entity, screenX, screenY) {
  const width = entity.width;
  const height = entity.height;
  if (!width || !height) return;
  const baseY = screenY + height;
  const radiusX = Math.max(width * 0.38, 14);
  const radiusY = Math.max(height * 0.22, 10);
  ctx.save();
  ctx.translate(screenX + width / 2, baseY - Math.max(2, height * 0.04));
  ctx.scale(1, radiusY / radiusX);
  const gradient = ctx.createRadialGradient(0, 0, radiusX * 0.2, 0, 0, radiusX);
  const alpha = 0.22 + STATE.nightFactor * 0.2;
  gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  applyEntityHighlights(entity, screenX, screenY);
}

function applyEntityHighlights(entity, screenX, screenY) {
  const width = entity.width;
  const height = entity.height;
  if (!width || !height) return;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + height);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.16 + STATE.sunlight * 0.28})`);
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, `rgba(10, 8, 20, ${0.28 + STATE.nightFactor * 0.35})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(screenX, screenY, width, height);
  ctx.restore();

  if (entity.kind === 'npc' || entity === STATE.player) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rim = ctx.createLinearGradient(screenX, screenY, screenX + width, screenY + height);
    rim.addColorStop(0, `rgba(130, 200, 255, ${0.08 + STATE.nightFactor * 0.25})`);
    rim.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    rim.addColorStop(1, `rgba(255, 200, 160, ${0.06 + STATE.sunlight * 0.2})`);
    ctx.fillStyle = rim;
    ctx.fillRect(screenX, screenY, width, height);
    ctx.restore();
  }

  if (entity.id === 'stone_oven' && (entity.state === 'baking' || entity.state === 'ready')) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const centerX = screenX + width * 0.5;
    const centerY = screenY + height * 0.55;
    const glow = ctx.createRadialGradient(centerX, centerY, width * 0.15, centerX, centerY, width * 0.7);
    glow.addColorStop(0, `rgba(255, 210, 150, ${entity.state === 'ready' ? 0.6 : 0.45})`);
    glow.addColorStop(0.4, `rgba(255, 180, 120, ${entity.state === 'ready' ? 0.35 : 0.25})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(screenX - width * 0.4, screenY - height * 0.4, width * 1.8, height * 1.8);
    ctx.restore();
  }
}

function spawnParticle(config = {}) {
  const colorData = parseColor(config.color || '#ffffff') || { r: 255, g: 255, b: 255, a: 1 };
  const particle = {
    kind: config.kind || 'dust',
    x: config.x ?? 0,
    y: config.y ?? 0,
    vx: config.vx || 0,
    vy: config.vy || 0,
    ax: config.ax || 0,
    ay: config.ay || 0,
    life: Math.max(0.1, config.life || 1.5),
    age: 0,
    size: config.size || 8,
    startAlpha:
      config.startAlpha !== undefined
        ? config.startAlpha
        : config.alpha !== undefined
        ? config.alpha
        : colorData.a ?? 1,
    endAlpha: config.endAlpha !== undefined ? config.endAlpha : 0,
    color: colorData,
    additive: Boolean(config.additive),
    flicker: config.flicker || 0,
    noise: Math.random() * 1000
  };
  STATE.particles.push(particle);
}

function spawnAmbientDust(dt) {
  if (!STATE.player || !STATE.room) return;
  const rate = 0.9 + STATE.sunlight * 1.6 + STATE.nightFactor * 0.4;
  STATE.particleTimers.dust += dt * rate;
  let spawnCount = Math.floor(STATE.particleTimers.dust);
  if (spawnCount <= 0) return;
  STATE.particleTimers.dust -= spawnCount;

  const px = STATE.player.x + STATE.player.width / 2;
  const py = STATE.player.y + STATE.player.height / 2;
  const themeTint = STATE.room.theme?.tint
    ? rgbString(
        {
          r: STATE.room.theme.tint[0],
          g: STATE.room.theme.tint[1],
          b: STATE.room.theme.tint[2]
        },
        1
      )
    : '#f6e4c4';

  while (spawnCount > 0) {
    spawnCount -= 1;
    spawnParticle({
      kind: 'dust',
      x: px + randomInRange(-260, 260),
      y: py + randomInRange(-140, 180),
      vx: randomInRange(-14, 14),
      vy: randomInRange(-12, -4),
      ax: randomInRange(-6, 6),
      ay: randomInRange(-18, -8),
      life: randomInRange(2.8, 4.6),
      size: randomInRange(12, 22),
      startAlpha: 0.22 + STATE.sunlight * 0.28,
      endAlpha: 0,
      color: mixColors(themeTint, '#7fb5ff', STATE.nightFactor * 0.6),
      flicker: 0.2
    });
  }
}

function spawnOvenEmbers(dt) {
  const oven = STATE.room?.oven;
  if (!oven || (oven.state !== 'baking' && oven.state !== 'ready')) return;
  const rate = oven.state === 'baking' ? 2.8 : 1.4;
  STATE.particleTimers.ember += dt * rate;
  let spawnCount = Math.floor(STATE.particleTimers.ember);
  if (spawnCount <= 0) return;
  STATE.particleTimers.ember -= spawnCount;

  const originX = oven.x + oven.width * 0.55;
  const originY = oven.y + oven.height * 0.42;
  while (spawnCount > 0) {
    spawnCount -= 1;
    spawnParticle({
      kind: 'ember',
      x: originX + randomInRange(-18, 18),
      y: originY + randomInRange(-10, 10),
      vx: randomInRange(-10, 10),
      vy: randomInRange(-22, -12),
      ax: randomInRange(-4, 4),
      ay: -18,
      life: randomInRange(1.4, 2.4),
      size: randomInRange(7, 13),
      startAlpha: 0.85,
      endAlpha: 0,
      color: mixColors('#ffb472', '#ffd8a8', 0.35),
      flicker: 0.45,
      additive: true
    });
  }
}

function updateParticles(dt) {
  if (!STATE.room) return;
  spawnAmbientDust(dt);
  spawnOvenEmbers(dt);

  STATE.particles = STATE.particles.filter((particle) => {
    const p = particle;
    p.age += dt;
    if (p.age >= p.life) {
      return false;
    }
    p.vx += (p.ax || 0) * dt;
    p.vy += (p.ay || 0) * dt;
    if (p.kind === 'dust') {
      p.vx += Math.sin((p.noise + p.age) * 1.7) * dt * 12;
      p.vy += Math.cos((p.noise * 0.5 + p.age) * 1.5) * dt * -5;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return true;
  });

  const limit = 280;
  if (STATE.particles.length > limit) {
    STATE.particles.splice(0, STATE.particles.length - limit);
  }
}

function drawParticles() {
  if (!STATE.particles.length) return;
  const camera = STATE.camera;
  const viewport = STATE.viewport;
  const now = performance.now() * 0.001;
  ctx.save();
  STATE.particles.forEach((particle) => {
    const sx = particle.x - camera.x;
    const sy = particle.y - camera.y;
    if (sx < -120 || sy < -120 || sx > viewport.width + 120 || sy > viewport.height + 120) {
      return;
    }
    const t = Math.max(0, Math.min(1, particle.age / particle.life));
    const alpha = (1 - t) * particle.startAlpha + t * particle.endAlpha;
    if (alpha <= 0) return;
    const flicker = particle.flicker
      ? 1 + Math.sin((particle.noise + now) * 6) * particle.flicker * 0.5
      : 1;
    const finalAlpha = Math.max(0, Math.min(1, alpha * flicker));
    const radius = Math.max(1.5, particle.size * (1 - t * 0.35));
    const color = particle.color;
    const fill = `rgba(${clampByte(color.r)}, ${clampByte(color.g)}, ${clampByte(color.b)}, ${finalAlpha})`;
    const gradient = ctx.createRadialGradient(sx, sy, radius * 0.1, sx, sy, radius);
    gradient.addColorStop(0, fill);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = particle.additive ? 'lighter' : 'screen';
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
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

  outlineCtx.save();
  const highlight = outlineCtx.createLinearGradient(0, 0, 0, height + pad);
  highlight.addColorStop(0, `rgba(255, 255, 255, ${0.2 + STATE.sunlight * 0.25})`);
  highlight.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  highlight.addColorStop(1, `rgba(10, 12, 24, ${0.26 + STATE.nightFactor * 0.35})`);
  outlineCtx.globalCompositeOperation = 'soft-light';
  outlineCtx.fillStyle = highlight;
  outlineCtx.fillRect(0, 0, outlineCanvas.width, outlineCanvas.height);
  outlineCtx.restore();

  outlineCtx.save();
  outlineCtx.globalCompositeOperation = 'lighter';
  const rim = outlineCtx.createLinearGradient(0, 0, outlineCanvas.width, outlineCanvas.height);
  rim.addColorStop(0, `rgba(140, 210, 255, ${0.06 + STATE.nightFactor * 0.22})`);
  rim.addColorStop(1, `rgba(255, 210, 160, ${0.04 + STATE.sunlight * 0.18})`);
  outlineCtx.fillStyle = rim;
  outlineCtx.fillRect(0, 0, outlineCanvas.width, outlineCanvas.height);
  outlineCtx.restore();

  ctx.drawImage(outlineCanvas, x - pad / 2, y - pad / 2);
}

function drawWaypoints() {
  const camera = STATE.camera;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(120, 200, 255, 0.45)';
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
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(200, 240, 255, 0.9)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wp.label, sx, sy + 26);
    ctx.shadowBlur = 12;
  });
  ctx.restore();
}

function applyLighting(lights = buildLights()) {
  const camera = STATE.camera;
  const { width, height, dpr } = STATE.viewport;
  lightCanvas.width = width * dpr;
  lightCanvas.height = height * dpr;
  lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lightCtx.clearRect(0, 0, width, height);
  lightCtx.globalCompositeOperation = 'source-over';
  const theme = STATE.room?.theme;
  const baseMultiplier =
    theme && typeof theme.ambientDarkness === 'number' ? theme.ambientDarkness : 1;
  const ambientMultiplier = baseMultiplier * (STATE.nightAmbientBoost || 1);
  const ambient = clamp(STATE.ambient * ambientMultiplier, 0, 1);
  lightCtx.fillStyle = `rgba(6, 8, 16, ${ambient})`;
  lightCtx.fillRect(0, 0, width, height);
  const overlayAlpha = STATE.nightOverlayAlpha || 0;
  if (overlayAlpha > 0.001) {
    lightCtx.fillStyle = `rgba(18, 24, 48, ${overlayAlpha})`;
    lightCtx.fillRect(0, 0, width, height);
  }
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
  const room = STATE.room;
  const lights = [];
  const oven = room.oven;
  if (oven) {
    lights.push({
      x: oven.x + oven.width / 2,
      y: oven.y + oven.height * 0.6,
      radius: oven.state === 'baking' ? 260 : 200,
      color: 'rgba(255, 180, 110, 0.55)'
    });
  }

  lights.push({
    x: STATE.player.x + STATE.player.width / 2,
    y: STATE.player.y + STATE.player.height / 2,
    radius: 180,
    color: 'rgba(150, 200, 255, 0.2)'
  });

  room.npcs.forEach((npc) => {
    lights.push({
      x: npc.x + npc.width / 2,
      y: npc.y + npc.height / 2,
      radius: 150,
      color: 'rgba(255, 190, 150, 0.25)'
    });
  });
  return lights;
}

function applyAtmospherics(lights = []) {
  const { width, height } = STATE.viewport;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.45,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78
  );
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vignette.addColorStop(1, `rgba(12, 10, 24, ${0.48 + STATE.nightFactor * 0.4})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const dawnGlow = ctx.createLinearGradient(0, 0, 0, height);
  dawnGlow.addColorStop(0, `rgba(255, 224, 180, ${0.14 + STATE.sunlight * 0.22})`);
  dawnGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  dawnGlow.addColorStop(1, `rgba(120, 170, 255, ${0.18 + STATE.nightFactor * 0.3})`);
  ctx.fillStyle = dawnGlow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  if (lights && lights.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    lights.forEach((light) => {
      const sx = light.x - STATE.camera.x;
      const sy = light.y - STATE.camera.y;
      const halo = ctx.createRadialGradient(sx, sy, light.radius * 0.25, sx, sy, light.radius);
      halo.addColorStop(0, `rgba(255, 255, 255, ${0.05 + colorAlpha(light.color, 0.2) * 0.3})`);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(sx - light.radius, sy - light.radius, light.radius * 2, light.radius * 2);
    });
    ctx.restore();
  }
}

function initializeThreeLayer() {
  if (STATE.world3d.initialized || STATE.world3d.failed) return;
  if (!window.World3D || typeof window.World3D.initThreeWorld !== 'function') return;
  const canvas = document.getElementById('world3d');
  if (!canvas) return;
  try {
    STATE.world3d.api = window.World3D.initThreeWorld(canvas, {
      pixelArtMode: false,
      parallax: true
    });
    STATE.world3d.initialized = true;
  } catch (err) {
    console.warn('World3D overlay failed to initialise', err);
    STATE.world3d.failed = true;
  }
}

function synchronizeThreeGraphics(graphics) {
  if (!graphics) return;
  if (!Array.isArray(graphics.toneLevels)) {
    graphics.toneLevels = [0.2, 0.7, 1.0];
  }
  const sunlight = STATE.sunlight;
  const night = STATE.nightFactor;
  graphics.toneLevels[0] = 0.22 + sunlight * 0.45;
  graphics.toneLevels[1] = 0.7 + sunlight * 0.24;
  graphics.toneLevels[2] = 1.05 + sunlight * 0.4;
  graphics.vignetteStrength = 0.55 + night * 0.35;
  graphics.grainIntensity = 0.02 + night * 0.05;
  graphics.chromaticOffset = 0.001 + night * 0.0015;
  graphics.saturationBoost = 0.14 + sunlight * 0.3;
}

function renderThreeOverlay(lights = []) {
  if (!window.World3D) return;
  if (!STATE.world3d.initialized && !STATE.world3d.failed) {
    initializeThreeLayer();
  }
  if (!STATE.world3d.initialized || STATE.world3d.failed) return;

  const { renderThreeWorld, setLights, Graphics } = window.World3D;
  if (Graphics) {
    synchronizeThreeGraphics(Graphics);
  }

  if (typeof setLights === 'function' && Array.isArray(lights)) {
    const prepared = lights.map((light) => {
      const parsed = parseColor(light.color || '#ffffff') || { r: 255, g: 255, b: 255, a: 1 };
      return {
        x: light.x,
        y: light.y,
        radius: light.radius * 0.95,
        intensity: Math.min(1, Math.max(0.08, light.intensity ?? colorAlpha(light.color, 0.55))),
        color: `rgb(${clampByte(parsed.r)}, ${clampByte(parsed.g)}, ${clampByte(parsed.b)})`
      };
    });
    const signature = JSON.stringify(
      prepared.map((entry) => [
        Math.round(entry.x),
        Math.round(entry.y),
        Math.round(entry.radius),
        Number(entry.intensity.toFixed(3)),
        entry.color
      ])
    );
    if (signature !== STATE.world3d.lastLightSignature) {
      setLights(prepared);
      STATE.world3d.lastLightSignature = signature;
    }
  }

  const centerX = STATE.camera.x + STATE.camera.width / 2;
  const centerY = STATE.camera.y + STATE.camera.height / 2;
  if (STATE.world3d.api && typeof STATE.world3d.api.setCamera === 'function') {
    STATE.world3d.api.setCamera(centerX, centerY);
  }

  if (typeof renderThreeWorld === 'function') {
    renderThreeWorld({
      camera: { x: centerX, y: centerY },
      pixelArtMode: false
    });
  }
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
  initializeThreeLayer();
  STATE.lastFrame = performance.now();
  requestAnimationFrame(gameLoop);
}

start();
