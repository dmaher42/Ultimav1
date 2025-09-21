import { TileInfo } from './GameMap.js';
import { DPR } from './renderer/canvas.js';
import { drawSprite } from './renderer/atlas.js';
import { drawTile, tileLoader } from './renderer/tileloader.js';
import { vignette, colorGrade } from './renderer/postfx.js';
import { createCamera } from './renderer/camera.js';
import { createFlashLayer } from './renderer/flash.js';
import { createTimeOfDay } from './renderer/tod.js';
import { createHUD } from './renderer/hud.js';
import { createAnimFSM } from './renderer/animfsm.js';

const TILE_SIZE = 48;
const BACKGROUND_COLOR = '#05070d';
const DIRECTION_KEYS = {
  south: 'south',
  west: 'west',
  east: 'east',
  north: 'north'
};
const DEFAULT_DIRECTION = 'south';

const PLAYER_ANIMATIONS = {
  idle_south: { frames: ['player_south_1'], fps: 1 },
  idle_north: { frames: ['player_north_1'], fps: 1 },
  idle_east: { frames: ['player_east_1'], fps: 1 },
  idle_west: { frames: ['player_west_1'], fps: 1 },
  walk_south: { frames: ['player_south_0', 'player_south_1', 'player_south_2'], fps: 8 },
  walk_north: { frames: ['player_north_0', 'player_north_1', 'player_north_2'], fps: 8 },
  walk_east: { frames: ['player_east_0', 'player_east_1', 'player_east_2'], fps: 8 },
  walk_west: { frames: ['player_west_0', 'player_west_1', 'player_west_2'], fps: 8 }
};

const SPRITE_SHEET_DEFAULTS = {
  columns: 3,
  rows: 4,
  directions: ['south', 'west', 'east', 'north'],
  framePrefix: 'player'
};

function loadSpriteSheetImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('Sprite sheet URL is required.'));
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load sprite sheet: ${url}`));
    image.src = url;
  });
}

function normaliseSpriteSheetOptions(options = {}) {
  const columns = Number.isFinite(options.columns) && options.columns > 0
    ? Math.floor(options.columns)
    : SPRITE_SHEET_DEFAULTS.columns;
  const rows = Number.isFinite(options.rows) && options.rows > 0
    ? Math.floor(options.rows)
    : SPRITE_SHEET_DEFAULTS.rows;
  const framePrefix = typeof options.framePrefix === 'string' && options.framePrefix.trim()
    ? options.framePrefix.trim()
    : SPRITE_SHEET_DEFAULTS.framePrefix;
  const baseDirections = Array.isArray(options.directions) && options.directions.length
    ? options.directions
    : SPRITE_SHEET_DEFAULTS.directions;
  const directions = [];
  for (let row = 0; row < rows; row += 1) {
    const candidate = baseDirections[row];
    if (typeof candidate === 'string' && candidate.trim()) {
      directions.push(candidate.trim().toLowerCase());
    } else if (SPRITE_SHEET_DEFAULTS.directions[row]) {
      directions.push(SPRITE_SHEET_DEFAULTS.directions[row]);
    } else {
      directions.push(`row${row}`);
    }
  }
  return { columns, rows, framePrefix, directions };
}

function createSpriteSheetData(image, config, url) {
  const columns = Math.max(1, config.columns);
  const rows = Math.max(1, config.rows);
  const frameWidth = Math.floor(image.width / columns);
  const frameHeight = Math.floor(image.height / rows);
  if (frameWidth <= 0 || frameHeight <= 0) {
    throw new Error(`Sprite sheet ${url || image.src} has invalid frame dimensions.`);
  }
  const frames = {};
  for (let row = 0; row < rows; row += 1) {
    const direction = config.directions[row] || `row${row}`;
    for (let col = 0; col < columns; col += 1) {
      const key = `${config.framePrefix}_${direction}_${col}`;
      frames[key] = {
        sx: col * frameWidth,
        sy: row * frameHeight,
        sw: frameWidth,
        sh: frameHeight
      };
    }
  }
  const preferredDefault = `${config.framePrefix}_${config.directions[0] || 'south'}_1`;
  const defaultFrameKey = frames[preferredDefault] ? preferredDefault : Object.keys(frames)[0] || null;
  return {
    url: url || image.src,
    image,
    columns,
    rows,
    frameWidth,
    frameHeight,
    frames,
    defaultFrameKey,
    directions: config.directions.slice(),
    framePrefix: config.framePrefix
  };
}

function computeSignature(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((item) => {
      const sprite = item?.sprite || item?.type || 'default';
      const frame = item?.frame ?? 0;
      const x = item?.x ?? 0;
      const y = item?.y ?? 0;
      return `${x}|${y}|${sprite}|${frame}`;
    })
    .join(';');
}

function normaliseDirection(direction) {
  const value = (direction || DEFAULT_DIRECTION).toString().toLowerCase();
  return DIRECTION_KEYS[value] ? value : DEFAULT_DIRECTION;
}

function animationKey(direction, moving) {
  const dir = normaliseDirection(direction);
  const base = moving ? 'walk' : 'idle';
  const key = `${base}_${dir}`;
  if (PLAYER_ANIMATIONS[key]) {
    return key;
  }
  return moving ? 'walk_south' : 'idle_south';
}

function formatResourceValue(value) {
  if (value == null) return '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(1);
  }
  return String(value);
}

function normaliseResources(resources) {
  if (!resources || typeof resources !== 'object') return {};
  const output = {};
  Object.entries(resources).forEach(([key, value]) => {
    if (!key) return;
    output[String(key)] = formatResourceValue(value);
  });
  return output;
}

export default class RenderEngine {
  constructor(ctx, options = {}) {
    if (!ctx) {
      throw new Error('Renderer requires a valid 2D context.');
    }
    this.ctx = ctx;
    this.canvas = ctx.canvas;
    this.tileSize = options.tileSize || TILE_SIZE;
    this.backgroundColor = options.backgroundColor || BACKGROUND_COLOR;

    this.map = null;
    this.player = null;
    this.highlight = null;
    this.highlightColor = '#ffe066';
    this.objects = [];
    this.npcs = [];
    this.playerSprite = null;
    this.spriteSheetCache = new Map();
    this.objectSignature = '';

    this.mapPixelWidth = 0;
    this.mapPixelHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.gridWidth = 0;
    this.gridHeight = 0;

    this.currentDirection = DEFAULT_DIRECTION;
    this.activeDirections = new Set();
    this.isMoving = false;

    this.lastTimestamp = 0;
    this.running = false;
    this.assetsLoaded = false;

    this.atlas = null;
    this.particles = null;
    this.viewportWidth = Math.round(this.canvas.width / DPR);
    this.viewportHeight = Math.round(this.canvas.height / DPR);

    this.camera = createCamera({ w: this.viewportWidth, h: this.viewportHeight, lerp: 0.18 });
    this.flashLayer = createFlashLayer();
    this.timeOfDay = createTimeOfDay();
    this.hudOverlay = createHUD();
    this.playerAnim = createAnimFSM(PLAYER_ANIMATIONS, 'idle_south');
    this.animationState = 'idle_south';
    this.hudData = { resources: {}, castleLevel: 1 };
    this.debugOverlay = false;
    this.fps = 0;

    this._loop = this._loop.bind(this);
  }

  setAtlas(atlas) {
    this.atlas = atlas || null;
    this.assetsLoaded = Boolean(atlas?.img && atlas?.meta);
    
    // Preload individual castle tiles for better graphics
    if (this.assetsLoaded) {
      const castleTiles = [
        'castle_wall', 'castle_floor', 'red_carpet', 'throne',
        'banner', 'torch_wall', 'castle_door', 'castle_window',
        'fountain', 'garden', 'courtyard',
        'bookshelf', 'barracks_bed', 'kitchen_table', 'study_desk', 'chapel_altar',
        'kitchen_hearth', 'wash_basin', 'dining_table', 'armory_rack',
        'training_dummy', 'royal_bed', 'stable_hay'
      ];
      
      tileLoader.preloadTiles(castleTiles).catch(err => {
        console.warn('Failed to preload individual tiles:', err);
      });
    }
  }

  setParticles(emitter) {
    this.particles = emitter || null;
  }

  async loadPlayerSprite(url, options = {}) {
    if (!url) {
      this.playerSprite = null;
      return null;
    }
    try {
      const sheet = await this.ensureSpriteSheet(url, options);
      this.playerSprite = sheet || null;
      return this.playerSprite;
    } catch (error) {
      this.playerSprite = null;
      throw error;
    }
  }

  _spriteSheetKey(url, config) {
    const dirKey = (config?.directions || []).join(',');
    const prefix = config?.framePrefix || SPRITE_SHEET_DEFAULTS.framePrefix;
    return `${url}::${config?.columns || 0}x${config?.rows || 0}::${prefix}::${dirKey}`;
  }

  _resolveSpriteSheetEntry(url, options = {}) {
    const config = normaliseSpriteSheetOptions(options);
    const key = this._spriteSheetKey(url, config);
    const entry = this.spriteSheetCache.get(key) || null;
    return { entry, config, key };
  }

  ensureSpriteSheet(url, options = {}) {
    if (!url) return Promise.resolve(null);
    const { entry, config, key } = this._resolveSpriteSheetEntry(url, options);
    if (entry) {
      if (entry.data) {
        return Promise.resolve(entry.data);
      }
      if (entry.promise) {
        return entry.promise;
      }
    }
    const record = { data: null, promise: null, config };
    const promise = loadSpriteSheetImage(url)
      .then((image) => createSpriteSheetData(image, config, url))
      .then((sheet) => {
        record.data = sheet;
        record.promise = null;
        this.spriteSheetCache.set(key, record);
        return sheet;
      })
      .catch((error) => {
        this.spriteSheetCache.delete(key);
        throw error;
      });
    record.promise = promise;
    this.spriteSheetCache.set(key, record);
    return promise;
  }

  getSpriteSheetSync(url, options = {}) {
    const { entry } = this._resolveSpriteSheetEntry(url, options);
    return entry?.data || null;
  }

  requestSpriteSheet(url, options = {}) {
    if (!url) return null;
    const { entry } = this._resolveSpriteSheetEntry(url, options);
    if (entry?.data) {
      return entry.data;
    }
    if (!entry) {
      this.ensureSpriteSheet(url, options).catch((error) => {
        console.warn(`Failed to load sprite sheet: ${url}`, error);
      });
    }
    return null;
  }

  drawSpriteSheetFrame(ctx, sheet, frameKey, dx, dy, dw = this.tileSize, dh = this.tileSize) {
    if (!sheet || !sheet.image) return false;
    const key = frameKey && sheet.frames[frameKey] ? frameKey : sheet.defaultFrameKey;
    if (!key) return false;
    const frame = sheet.frames[key];
    if (!frame) return false;
    const px = Math.round(dx);
    const py = Math.round(dy);
    ctx.drawImage(sheet.image, frame.sx, frame.sy, frame.sw, frame.sh, px, py, dw, dh);
    return true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
  }

  _loop(timestamp) {
    if (!this.running) return;
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.update(delta);
    this.draw();
    requestAnimationFrame(this._loop);
  }

  update(delta) {
    if (!this.assetsLoaded) return;
    const deltaSeconds = Number.isFinite(delta) ? Math.max(0, delta / 1000) : 0;
    if (deltaSeconds > 0) {
      const instantaneous = 1 / deltaSeconds;
      this.fps = this.fps ? this.fps * 0.9 + instantaneous * 0.1 : instantaneous;
    }

    if (this.highlight?.expires && this.highlight.expires <= Date.now()) {
      this.highlight = null;
    }

    if (this.particles) {
      this.particles.update(deltaSeconds);
    }

    this.timeOfDay.update(deltaSeconds);
    this.flashLayer.update(deltaSeconds);

    const target = this.getPlayerScreenCenter();
    this.camera.follow(target.x, target.y);
    this.camera.update(deltaSeconds);

    this.playerAnim.update(deltaSeconds);
  }

  draw() {
    if (!this.assetsLoaded) {
      console.log('Assets not loaded, skipping draw');
      return;
    }

    this.updateCanvasMetrics();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const grid = this.getMapGrid();
    console.log('Draw called - Grid exists:', !!grid, 'Viewport:', this.viewportWidth, 'x', this.viewportHeight);
    if (grid) {
      this.camera.apply(ctx);
      this.drawMap(ctx, grid);
      this.drawObjects(ctx);
      this.drawNPCs(ctx);

      if (this.highlight) {
        this.drawHighlight(ctx, this.highlight);
      }

      this.drawPlayer(ctx);

      if (this.particles) {
        this.particles.draw(ctx);
      }

      this.camera.reset(ctx);
    }

    ctx.restore();

    if (grid) {
      const { tint, vignette: vignetteStrength } = this.timeOfDay.getTint();
      ctx.save();
      vignette(ctx, this.viewportWidth, this.viewportHeight, vignetteStrength);
      colorGrade(ctx, tint, this.viewportWidth, this.viewportHeight);
      ctx.restore();
    }

    if (this.flashLayer.hasActive()) {
      if (grid) {
        this.camera.apply(ctx);
        this.flashLayer.draw(ctx);
        this.camera.reset(ctx);
      } else {
        this.flashLayer.draw(ctx);
      }
    }

    const cameraState = this.camera.getState();
    const debugPayload = this.debugOverlay
      ? {
          visible: true,
          fps: this.fps,
          camera: cameraState.position,
          t: this.timeOfDay.t,
          offset: cameraState.offset
        }
      : { visible: false };

    this.hudOverlay.draw(ctx, {
      fps: this.fps,
      resources: this.hudData.resources,
      castleLevel: this.hudData.castleLevel,
      debug: debugPayload
    });
  }

  updateCanvasMetrics() {
    const width = Math.round(this.canvas.clientWidth || this.canvas.width / DPR);
    const height = Math.round(this.canvas.clientHeight || this.canvas.height / DPR);
    this.viewportWidth = width;
    this.viewportHeight = height;

    this.camera.setViewport(width, height);

    const grid = this.getMapGrid();
    if (!grid) {
      this.mapPixelWidth = 0;
      this.mapPixelHeight = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      this.camera.setBounds(0, 0, width, height);
      return;
    }

    this.mapPixelWidth = grid.width * this.tileSize;
    this.mapPixelHeight = grid.height * this.tileSize;
    this.offsetX = Math.floor((width - this.mapPixelWidth) / 2);
    this.offsetY = Math.floor((height - this.mapPixelHeight) / 2);

    const minX = this.offsetX;
    const minY = this.offsetY;
    const maxX = this.offsetX + this.mapPixelWidth;
    const maxY = this.offsetY + this.mapPixelHeight;
    this.camera.setBounds(minX, minY, maxX, maxY);

    const target = this.getPlayerScreenCenter();
    this.camera.follow(target.x, target.y);
  }

  getMapGrid(map = this.map) {
    if (!map) return null;

    let tiles = null;
    if (Array.isArray(map.tiles)) {
      tiles = map.tiles;
    } else if (Array.isArray(map)) {
      tiles = map;
    } else if (typeof map.getTiles === 'function') {
      tiles = map.getTiles();
    } else if (Array.isArray(map?.data)) {
      tiles = map.data;
    }

    if (!Array.isArray(tiles) || !tiles.length) {
      return null;
    }

    const width = tiles[0]?.length || 0;
    const height = tiles.length;
    return {
      tiles,
      width,
      height,
      safe: Boolean(map.safe),
      name: map.name || '',
      discovered: Boolean(map.discovered)
    };
  }

  drawAtlasTile(ctx, sprite, tileX, tileY, fallbackColor) {
    const px = this.offsetX + tileX * this.tileSize;
    const py = this.offsetY + tileY * this.tileSize;
    
    // Try individual tile first, then atlas, then fallback color
    const drawn = drawTile(ctx, this.atlas, sprite, px, py, this.tileSize, this.tileSize, fallbackColor);
    
    return drawn;
  }

  drawMap(ctx, grid) {
    console.log('Drawing map with grid:', grid.width, 'x', grid.height);
    const tiles = grid.tiles;
    for (let y = 0; y < grid.height; y += 1) {
      const row = tiles[y];
      if (!Array.isArray(row)) continue;
      for (let x = 0; x < grid.width; x += 1) {
        const tileType = row[x];
        const fallback = TileInfo[tileType]?.color;
        const drawn = this.drawAtlasTile(ctx, tileType, x, y, fallback);
        if (x === 0 && y === 0) {
          console.log('First tile draw:', tileType, 'drawn:', drawn, 'fallback:', fallback);
        }
      }
    }

    if (grid.safe) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(this.offsetX, this.offsetY, this.mapPixelWidth, this.mapPixelHeight);
    }
  }

  drawObjects(ctx) {
    if (!this.objects.length) return;
    this.objects.forEach((object) => {
      if (typeof object?.draw === 'function') {
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        object.draw(ctx, {
          tileSize: this.tileSize,
          drawSprite: (name, gridX, gridY, width = this.tileSize, height = this.tileSize) => {
            const px = gridX * this.tileSize;
            const py = gridY * this.tileSize;
            return drawSprite(ctx, this.atlas, name, px, py, width, height);
          }
        });
        ctx.restore();
      } else if (typeof object?.x === 'number' && typeof object?.y === 'number') {
        const sprite = object?.sprite || object?.type || 'default';
        const color = object?.color || '#8c7853';
        this.drawAtlasTile(ctx, sprite, object.x, object.y, color);
      }
    });
  }

  drawNPCs(ctx) {
    if (!this.npcs.length) return;
    this.npcs.forEach((npc) => {
      if (typeof npc?.x !== 'number' || typeof npc?.y !== 'number') return;
      if (npc.spriteSheet) {
        const sheetOptions = npc.spriteSheetOptions || npc.spriteOptions;
        const sheet = this.getSpriteSheetSync(npc.spriteSheet, sheetOptions);
        if (sheet) {
          const px = this.offsetX + npc.x * this.tileSize;
          const py = this.offsetY + npc.y * this.tileSize;
          const frameKey = npc.spriteFrame || 'player_south_1';
          const width = typeof npc.spriteWidth === 'number' ? npc.spriteWidth : this.tileSize;
          const height = typeof npc.spriteHeight === 'number' ? npc.spriteHeight : this.tileSize;
          if (this.drawSpriteSheetFrame(ctx, sheet, frameKey, px, py, width, height)) {
            return;
          }
        } else {
          this.requestSpriteSheet(npc.spriteSheet, sheetOptions);
        }
      }
      const sprite = npc?.sprite || npc?.type || 'npc';
      const color = npc?.color || '#cfa658';
      this.drawAtlasTile(ctx, sprite, npc.x, npc.y, color);
    });
  }

  drawHighlight(ctx, highlight) {
    const px = this.offsetX + highlight.x * this.tileSize;
    const py = this.offsetY + highlight.y * this.tileSize;
    ctx.save();
    ctx.strokeStyle = highlight.color || this.highlightColor;
    ctx.lineWidth = Math.max(2, Math.round(this.tileSize * 0.06));
    ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
    ctx.restore();
  }

  drawPlayer(ctx) {
    if (!this.player) return;
    const position = this.player.position;
    if (!position) return;
    const px = this.offsetX + position.x * this.tileSize;
    const py = this.offsetY + position.y * this.tileSize;
    const frameKey = this.playerAnim.frame() || 'player_south_1';
    if (this.playerSprite) {
      const drawnSheet = this.drawSpriteSheetFrame(ctx, this.playerSprite, frameKey, px, py, this.tileSize, this.tileSize);
      if (drawnSheet) {
        return;
      }
    }
    if (!this.atlas) return;
    const drawn = drawSprite(ctx, this.atlas, frameKey, px, py, this.tileSize, this.tileSize);
    if (!drawn) {
      drawSprite(ctx, this.atlas, 'player_south_1', px, py, this.tileSize, this.tileSize);
    }
  }

  drawHUD() {
    // Legacy stub retained for compatibility.
  }

  getPlayerScreenCenter() {
    if (!this.player || !this.player.position) {
      const x = this.offsetX + this.mapPixelWidth / 2 || this.viewportWidth / 2;
      const y = this.offsetY + this.mapPixelHeight / 2 || this.viewportHeight / 2;
      return { x, y };
    }
    const px = this.offsetX + (this.player.position.x + 0.5) * this.tileSize;
    const py = this.offsetY + (this.player.position.y + 0.5) * this.tileSize;
    return { x: px, y: py };
  }

  tileAtScreen(x, y) {
    if (!this.map || !this.gridWidth || !this.gridHeight) return null;
    const tileX = Math.floor((x - this.offsetX) / this.tileSize);
    const tileY = Math.floor((y - this.offsetY) / this.tileSize);
    if (tileX < 0 || tileY < 0 || tileX >= this.gridWidth || tileY >= this.gridHeight) {
      return null;
    }
    return { x: tileX, y: tileY };
  }

  render(map, player, options = {}) {
    if (!this.assetsLoaded) return;

    if (map !== this.map) {
      this.map = map || null;
      if (!map) {
        this.stopAllMovement();
        this.gridWidth = 0;
        this.gridHeight = 0;
      }
    }

    const grid = this.getMapGrid();
    if (grid) {
      this.gridWidth = grid.width;
      this.gridHeight = grid.height;
      this.mapPixelWidth = grid.width * this.tileSize;
      this.mapPixelHeight = grid.height * this.tileSize;
    } else {
      this.gridWidth = 0;
      this.gridHeight = 0;
      this.mapPixelWidth = 0;
      this.mapPixelHeight = 0;
    }

    if (player) {
      this.player = player;
      const facing = player.facing ? normaliseDirection(player.facing) : this.currentDirection;
      if (!this.isMoving) {
        this.currentDirection = facing;
      }
    } else {
      this.player = null;
      this.stopAllMovement();
    }

    this.highlight = options.highlight || null;
    if (options.highlightColor) {
      this.highlightColor = options.highlightColor;
    }

    const objects = options.objects ?? map?.objects ?? [];
    const signature = computeSignature(objects);
    if (signature !== this.objectSignature) {
      this.objects = Array.isArray(objects) ? objects.slice() : [];
      this.objectSignature = signature;
    }

    const npcs = options.npcs ?? map?.npcs ?? [];
    this.npcs = Array.isArray(npcs) ? npcs.slice() : [];

    const hudOptions = options.hud || {};
    this.hudData = {
      resources: normaliseResources(hudOptions.resources),
      castleLevel: Number.isFinite(hudOptions.castleLevel) ? hudOptions.castleLevel : this.hudData.castleLevel
    };

    this.syncAnimationState();

    const target = this.getPlayerScreenCenter();
    this.camera.follow(target.x, target.y);
  }

  syncAnimationState(force = false) {
    const nextState = animationKey(this.currentDirection, this.isMoving);
    if (force || nextState !== this.animationState) {
      this.playerAnim.set(nextState);
      this.animationState = nextState;
    }
  }

  setPlayerMovement(direction, active) {
    if (!direction) return;
    const normalized = normaliseDirection(direction);
    if (!DIRECTION_KEYS[normalized]) return;

    if (active) {
      if (!this.activeDirections.has(normalized)) {
        this.activeDirections.add(normalized);
      }
      this.isMoving = true;
      this.currentDirection = normalized;
    } else {
      this.activeDirections.delete(normalized);
      if (this.activeDirections.size === 0) {
        this.isMoving = false;
      } else {
        const directions = Array.from(this.activeDirections);
        this.currentDirection = directions[directions.length - 1];
      }
    }
    this.syncAnimationState();
  }

  stopAllMovement() {
    this.activeDirections.clear();
    this.isMoving = false;
    this.syncAnimationState(true);
  }

  toggleDebugOverlay() {
    this.debugOverlay = !this.debugOverlay;
  }

  setDebugOverlay(value) {
    this.debugOverlay = Boolean(value);
  }

  isDebugVisible() {
    return this.debugOverlay;
  }

  flashRectangle(x, y, w, h, alpha = 0.5, ms = 80) {
    this.flashLayer.flashRect(x, y, w, h, alpha, ms);
  }

  shakeCamera(intensity = 6, duration = 0.2) {
    this.camera.shake(intensity, duration);
  }

  getMapScreenRect() {
    return {
      x: this.offsetX,
      y: this.offsetY,
      width: this.mapPixelWidth,
      height: this.mapPixelHeight
    };
  }
}
