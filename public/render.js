
import { TileInfo } from './GameMap.js';
import { DPR } from './renderer/canvas.js';
import { drawSprite } from './renderer/atlas.js';
import { drawTile, tileLoader } from './renderer/tileloader.js';
import { loadTileManifest, getTileNamesByCategory } from './renderer/tilesetManifest.js';
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
    
    if (this.assetsLoaded) {
      loadTileManifest()
        .then((manifest) => {
          const categories = ['terrain', 'architecture', 'props'];
          const tileNames = new Set();
          categories.forEach((category) => {
            getTileNamesByCategory(manifest, category).forEach((name) => tileNames.add(name));
          });
          return Array.from(tileNames);
        })
        .then((tileNames) => tileLoader.preloadTiles(tileNames))
        .catch((err) => {
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
    if (!this.assetsLoaded) return;

    this.updateCanvasMetrics();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    const grid = this.getMapGrid();

    // 0. Draw Background Framing (Prevent black void feel)
    if (grid?.id === 'castle') {
      this.drawCastleBackdrop(ctx);
    } else {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    if (grid) {
      this.camera.apply(ctx);

      // 1. Draw Map Tiles (Ground Layer)
      this.drawMap(ctx, grid);

      if (grid.id === 'castle') {
        this.drawCastleThroneRoomStage(ctx, grid);
      }

      // 2. Depth Sort Entities (Player, NPCs, Objects)
      const entities = [];

      // Add Objects
      this.objects.forEach(obj => {
         const y = (obj.y + 1) * this.tileSize;
         entities.push({ type: 'object', y, data: obj });
      });

      // Add NPCs
      this.npcs.forEach(npc => {
         const y = (npc.y + 1) * this.tileSize;
         entities.push({ type: 'npc', y, data: npc });
      });

      // Add Player
      if (this.player && this.player.position) {
         const y = (this.player.position.y + 1) * this.tileSize;
         entities.push({ type: 'player', y, data: this.player });
      }

      // Sort by Y coordinate
      entities.sort((a, b) => a.y - b.y);

      // Draw sorted entities
      entities.forEach(entity => {
          this.drawSoftShadowForEntity(ctx, entity);
          
          if (entity.type === 'object') this.drawObject(ctx, entity.data);
          if (entity.type === 'npc') this.drawNPC(ctx, entity.data);
          if (entity.type === 'player') this.drawPlayer(ctx);

          // DRAW LIGHT BLOOM FOR TORCHES
          if (entity.type === 'object' && entity.data.sprite === 'torch_wall') {
            this.drawTorchLight(ctx, entity.data);
          }
      });

      // 3. Draw Top Layers (Roofs, Canopy, etc.)
      if (Array.isArray(grid.layers)) {
        grid.layers.forEach(layer => {
          if (layer.zIndex > 0) {
            this.renderLayer(ctx, grid, layer.tiles);
          }
        });
      }

      if (this.highlight) {
        this.drawHighlight(ctx, this.highlight);
      }

      if (this.particles) {
        this.particles.draw(ctx);
      }

      this.camera.reset(ctx);
      
      // 4. Throne Room Special Effects (Showcase Upgrade v2)
      if (grid.id === 'castle') {
          const throneX = this.offsetX + 14.5 * this.tileSize;
          const throneY = this.offsetY + 7 * this.tileSize;
          const time = Date.now() * 0.0008;

          // A. Focal God-Ray
          const grad = ctx.createRadialGradient(throneX, throneY, this.tileSize, throneX, throneY, this.tileSize * 12);
          grad.addColorStop(0, 'rgba(255, 230, 150, 0.2)');
          grad.addColorStop(0.3, 'rgba(255, 230, 150, 0.08)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
          ctx.restore();

          // B. Royal Floor Specularity (Corrected legend lookup)
          ctx.save();
          ctx.globalCompositeOperation = 'overlay';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
              const char = grid.tiles[y][x];
              const tileType = grid.legend ? grid.legend[char] : char;
              if (tileType && (tileType.includes('marble') || tileType === 'dais_floor')) {
                const px = this.offsetX + x * this.tileSize;
                const py = this.offsetY + y * this.tileSize;
                const spark = Math.sin(time + x * 0.3 + y * 0.4);
                if (spark > 0.8) {
                    ctx.beginPath();
                    ctx.moveTo(px, py + (spark - 0.8) * 100);
                    ctx.lineTo(px + this.tileSize, py + (spark - 0.8) * 100 - 10);
                    ctx.stroke();
                }
              }
            }
          }
          ctx.restore();

          // C. Golden Celebration Motes
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (let i = 0; i < 20; i++) {
            const mx = throneX + (Math.sin(time * 0.3 + i * 123.45) * this.tileSize * 8);
            const my = throneY + (Math.cos(time * 0.15 + i * 543.21) * this.tileSize * 5);
            const size = 0.8 + Math.abs(Math.sin(time * 0.7 + i)) * 1.5;
            ctx.fillStyle = `rgba(255, 215, 100, ${0.05 + Math.abs(Math.sin(time * 0.4 + i)) * 0.25})`;
            ctx.beginPath();
            ctx.arc(mx, my, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
      }
    }
    ctx.restore();

    // Character sheet glow
    if (this.characterSheetOpen) {
      this.drawVignette('rgba(0,0,0,0.6)');
    }

    // Dungeon Vignette
    if (grid && !grid.safe) {
      this.drawVignette('rgba(0,0,40,0.4)'); // Deep blue-black tint for caves
    }

    if (grid) {
        const { tint, vignette: vignetteStrength } = this.timeOfDay.getTint();
        const isCastleInterior = grid.id === 'castle';
        ctx.save();
        vignette(
          ctx,
          this.viewportWidth,
          this.viewportHeight,
          isCastleInterior ? Math.min(0.08, vignetteStrength * 0.2) : vignetteStrength
        );
        colorGrade(
          ctx,
          isCastleInterior ? 'rgba(255, 215, 160, 0.025)' : tint,
          this.viewportWidth,
          this.viewportHeight
        );
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

  drawTorchLight(ctx, torch) {
    const tx = this.offsetX + (torch.x + 0.5) * this.tileSize;
    const ty = this.offsetY + (torch.y + 0.5) * this.tileSize;
    const time = Date.now() * 0.002;
    const flicker = 1 + Math.sin(time * 3) * 0.1;
    const radius = this.tileSize * 3.35 * flicker;

    const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius);
    grad.addColorStop(0, 'rgba(255, 235, 170, 0.28)');
    grad.addColorStop(0.28, 'rgba(255, 194, 80, 0.22)');
    grad.addColorStop(0.55, 'rgba(255, 130, 35, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tx, ty, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCastleBackdrop(ctx) {
    const width = this.viewportWidth;
    const height = this.viewportHeight;

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#2b1d17');
    base.addColorStop(0.48, '#36241c');
    base.addColorStop(1, '#1a1310');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.5, height * 0.36, 24, width * 0.5, height * 0.36, Math.max(width, height) * 0.78);
    glow.addColorStop(0, 'rgba(114, 74, 39, 0.24)');
    glow.addColorStop(0.45, 'rgba(78, 47, 28, 0.12)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 220, 150, 0.025)';
    ctx.fillRect(0, 0, 18, height);
    ctx.fillRect(width - 18, 0, 18, height);
  }

  drawCastleThroneRoomStage(ctx, grid) {
    const ts = this.tileSize;
    const hallLeft = this.offsetX + 7.9 * ts;
    const hallTop = this.offsetY + 0.9 * ts;
    const hallWidth = 14.4 * ts;
    const hallHeight = 8.0 * ts;
    const throneCenterX = this.offsetX + 15.5 * ts;
    const throneCenterY = this.offsetY + 6.8 * ts;
    const daisTop = throneCenterY - ts * 2.6;
    const daisBottom = throneCenterY + ts * 1.4;
    const alcoveLeft = throneCenterX - ts * 4.2;
    const alcoveRight = throneCenterX + ts * 4.2;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const throneGlow = ctx.createRadialGradient(throneCenterX, throneCenterY, ts * 0.6, throneCenterX, throneCenterY, ts * 7.5);
    throneGlow.addColorStop(0, 'rgba(255, 238, 180, 0.20)');
    throneGlow.addColorStop(0.25, 'rgba(232, 180, 84, 0.12)');
    throneGlow.addColorStop(0.68, 'rgba(120, 70, 30, 0.05)');
    throneGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = throneGlow;
    ctx.fillRect(hallLeft - ts * 0.7, hallTop - ts * 0.3, hallWidth + ts * 1.4, hallHeight + ts * 1.3);

    ctx.globalCompositeOperation = 'source-over';

    const panel = ctx.createLinearGradient(0, hallTop, 0, hallTop + hallHeight);
    panel.addColorStop(0, 'rgba(66, 42, 31, 0.94)');
    panel.addColorStop(0.55, 'rgba(48, 31, 24, 0.90)');
    panel.addColorStop(1, 'rgba(34, 21, 17, 0.84)');
    ctx.fillStyle = panel;
    ctx.fillRect(hallLeft, hallTop, hallWidth, hallHeight);

    // Broader royal alcove so the throne reads as the heart of the hall.
    const alcove = ctx.createLinearGradient(alcoveLeft, daisTop, alcoveRight, daisBottom);
    alcove.addColorStop(0, 'rgba(28, 18, 16, 0.96)');
    alcove.addColorStop(0.5, 'rgba(66, 34, 28, 0.96)');
    alcove.addColorStop(1, 'rgba(18, 12, 10, 0.98)');
    ctx.fillStyle = alcove;
    ctx.fillRect(alcoveLeft, daisTop - ts * 0.8, ts * 8.4, ts * 5.6);

    const archPath = new Path2D();
    archPath.moveTo(throneCenterX - ts * 3.35, daisTop + ts * 0.8);
    archPath.lineTo(throneCenterX - ts * 3.0, daisTop - ts * 1.2);
    archPath.ellipse(throneCenterX, daisTop - ts * 1.0, ts * 3.0, ts * 1.55, 0, Math.PI, 0);
    archPath.lineTo(throneCenterX + ts * 3.35, daisTop + ts * 0.8);
    archPath.closePath();
    ctx.fillStyle = 'rgba(88, 54, 34, 0.40)';
    ctx.fill(archPath);
    ctx.strokeStyle = 'rgba(234, 196, 114, 0.32)';
    ctx.lineWidth = 3;
    ctx.stroke(archPath);

    ctx.fillStyle = 'rgba(154, 122, 72, 0.16)';
    ctx.fillRect(hallLeft + ts * 0.35, hallTop + ts * 0.28, hallWidth - ts * 0.7, ts * 0.34);
    ctx.fillRect(hallLeft + ts * 0.35, hallTop + hallHeight - ts * 0.42, hallWidth - ts * 0.7, ts * 0.18);

    const rulerGlow = ctx.createRadialGradient(throneCenterX, throneCenterY - ts * 0.55, ts * 0.2, throneCenterX, throneCenterY - ts * 0.55, ts * 2.6);
    rulerGlow.addColorStop(0, 'rgba(255, 245, 198, 0.20)');
    rulerGlow.addColorStop(0.55, 'rgba(214, 166, 72, 0.10)');
    rulerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rulerGlow;
    ctx.fillRect(throneCenterX - ts * 1.8, throneCenterY - ts * 2.2, ts * 3.6, ts * 3.2);

    // Strong royal throne silhouette so the focal point is unmistakable.
    ctx.fillStyle = 'rgba(78, 18, 18, 0.96)';
    ctx.fillRect(throneCenterX - ts * 1.62, throneCenterY - ts * 1.58, ts * 3.24, ts * 2.08);
    ctx.fillStyle = 'rgba(188, 147, 62, 0.95)';
    ctx.fillRect(throneCenterX - ts * 1.74, throneCenterY - ts * 1.70, ts * 3.48, ts * 0.14);
    ctx.fillRect(throneCenterX - ts * 1.74, throneCenterY + ts * 0.48, ts * 3.48, ts * 0.14);
    ctx.fillRect(throneCenterX - ts * 1.74, throneCenterY - ts * 1.70, ts * 0.14, ts * 2.32);
    ctx.fillRect(throneCenterX + ts * 1.60, throneCenterY - ts * 1.70, ts * 0.14, ts * 2.32);
    ctx.fillStyle = 'rgba(120, 35, 37, 0.98)';
    ctx.fillRect(throneCenterX - ts * 0.96, throneCenterY - ts * 2.18, ts * 1.92, ts * 1.78);
    ctx.fillStyle = 'rgba(224, 199, 127, 0.95)';
    ctx.fillRect(throneCenterX - ts * 0.44, throneCenterY - ts * 2.22, ts * 0.88, ts * 0.16);
    ctx.fillRect(throneCenterX - ts * 0.58, throneCenterY - ts * 2.08, ts * 1.16, ts * 0.12);
    ctx.fillStyle = 'rgba(255, 243, 205, 0.20)';
    ctx.fillRect(throneCenterX - ts * 0.72, throneCenterY - ts * 1.62, ts * 1.44, ts * 1.10);
    ctx.fillStyle = 'rgba(40, 12, 12, 0.34)';
    ctx.fillRect(throneCenterX - ts * 0.54, throneCenterY - ts * 0.38, ts * 1.08, ts * 0.30);
    ctx.fillStyle = 'rgba(233, 201, 114, 0.95)';
    ctx.fillRect(throneCenterX - ts * 0.16, throneCenterY - ts * 2.40, ts * 0.32, ts * 0.16);
    ctx.fillRect(throneCenterX - ts * 0.38, throneCenterY - ts * 2.10, ts * 0.76, ts * 0.08);
    ctx.fillRect(throneCenterX - ts * 0.66, throneCenterY - ts * 1.94, ts * 0.14, ts * 0.20);
    ctx.fillRect(throneCenterX + ts * 0.52, throneCenterY - ts * 1.94, ts * 0.14, ts * 0.20);

    const arch = ctx.createRadialGradient(throneCenterX, throneCenterY - ts * 0.9, ts * 0.3, throneCenterX, throneCenterY - ts * 0.8, ts * 4.2);
    arch.addColorStop(0, 'rgba(255, 235, 180, 0.14)');
    arch.addColorStop(0.55, 'rgba(180, 126, 56, 0.08)');
    arch.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = arch;
    ctx.fillRect(hallLeft + ts * 2.0, hallTop + ts * 0.15, hallWidth - ts * 4.0, hallHeight - ts * 1.0);

    ctx.fillStyle = 'rgba(12, 8, 7, 0.32)';
    ctx.fillRect(hallLeft + ts * 1.0, hallTop + ts * 0.55, ts * 0.45, hallHeight - ts * 1.1);
    ctx.fillRect(hallLeft + hallWidth - ts * 1.45, hallTop + ts * 0.55, ts * 0.45, hallHeight - ts * 1.1);

    // Deep side curtains to close in the hall and pull attention toward the center.
    const drapeLeft = ctx.createLinearGradient(hallLeft, hallTop, hallLeft + ts * 2.5, hallTop);
    drapeLeft.addColorStop(0, 'rgba(24, 13, 11, 0.0)');
    drapeLeft.addColorStop(0.4, 'rgba(46, 18, 20, 0.72)');
    drapeLeft.addColorStop(1, 'rgba(83, 24, 24, 0.05)');
    ctx.fillStyle = drapeLeft;
    ctx.fillRect(hallLeft, hallTop + ts * 0.7, ts * 2.4, hallHeight - ts * 1.1);
    const drapeRight = ctx.createLinearGradient(hallLeft + hallWidth, hallTop, hallLeft + hallWidth - ts * 2.5, hallTop);
    drapeRight.addColorStop(0, 'rgba(24, 13, 11, 0.0)');
    drapeRight.addColorStop(0.4, 'rgba(46, 18, 20, 0.72)');
    drapeRight.addColorStop(1, 'rgba(83, 24, 24, 0.05)');
    ctx.fillStyle = drapeRight;
    ctx.fillRect(hallLeft + hallWidth - ts * 2.4, hallTop + ts * 0.7, ts * 2.4, hallHeight - ts * 1.1);

    ctx.strokeStyle = 'rgba(241, 201, 116, 0.38)';
    ctx.lineWidth = 3;
    ctx.strokeRect(hallLeft + ts * 0.35, hallTop + ts * 0.35, hallWidth - ts * 0.7, hallHeight - ts * 0.7);

    const daisGlow = ctx.createRadialGradient(throneCenterX, throneCenterY + ts * 0.4, ts * 0.2, throneCenterX, throneCenterY + ts * 0.4, ts * 3.8);
    daisGlow.addColorStop(0, 'rgba(255, 230, 165, 0.22)');
    daisGlow.addColorStop(0.34, 'rgba(208, 150, 58, 0.12)');
    daisGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = daisGlow;
    ctx.fillRect(throneCenterX - ts * 3.7, throneCenterY - ts * 2.8, ts * 7.4, ts * 5.8);

    ctx.fillStyle = 'rgba(69, 42, 28, 0.80)';
    ctx.fillRect(throneCenterX - ts * 3.4, throneCenterY + ts * 1.4, ts * 6.8, ts * 0.34);
    ctx.fillStyle = 'rgba(196, 157, 76, 0.68)';
    ctx.fillRect(throneCenterX - ts * 3.6, throneCenterY + ts * 1.32, ts * 7.2, ts * 0.10);

    const runnerX = this.offsetX + 13.2 * ts;
    const runnerY = this.offsetY + 7.9 * ts;
    const runner = ctx.createLinearGradient(runnerX, runnerY, runnerX, runnerY + ts * 9.8);
    runner.addColorStop(0, 'rgba(255, 231, 171, 0.0)');
    runner.addColorStop(0.12, 'rgba(99, 6, 11, 0.78)');
    runner.addColorStop(0.42, 'rgba(188, 28, 34, 0.96)');
    runner.addColorStop(0.58, 'rgba(214, 42, 42, 0.98)');
    runner.addColorStop(0.76, 'rgba(125, 10, 16, 0.78)');
    runner.addColorStop(1, 'rgba(255, 231, 171, 0.0)');
    ctx.fillStyle = runner;
    ctx.fillRect(runnerX, runnerY, ts * 3.9, ts * 9.8);

    ctx.fillStyle = 'rgba(255, 226, 154, 0.24)';
    ctx.fillRect(runnerX + ts * 0.10, runnerY, ts * 0.08, ts * 9.8);
    ctx.fillRect(runnerX + ts * 3.72, runnerY, ts * 0.08, ts * 9.8);
    ctx.fillStyle = 'rgba(248, 210, 108, 0.10)';
    ctx.fillRect(runnerX + ts * 1.72, runnerY + ts * 0.08, ts * 0.34, ts * 9.6);

    // Trim the central aisle so the throne sits at the end of a ceremonial run.
    ctx.fillStyle = 'rgba(255, 245, 218, 0.08)';
    ctx.fillRect(throneCenterX - ts * 0.34, hallTop + ts * 0.6, ts * 0.68, ts * 6.9);

    ctx.restore();
  }

  drawSoftShadowForEntity(ctx, entity) {
    const data = entity.data;
    let cx = this.offsetX + (data.x + 0.5) * this.tileSize;
    let by = this.offsetY + (data.y + 1) * this.tileSize;

    if (entity.type === 'player' && data.position) {
       cx = this.offsetX + (data.position.x + 0.5) * this.tileSize;
       by = this.offsetY + (data.position.y + 1) * this.tileSize;
    }

    if (data.width && data.width > 1) {
       cx = this.offsetX + (data.x + data.width / 2) * this.tileSize;
    }

    let shadowWidth = this.tileSize;
    let shadowHeight = this.tileSize * 0.5;
    let opacity = 0.24;

    if (data.sprite === 'throne') {
      shadowWidth = this.tileSize * 2.3;
      shadowHeight = this.tileSize * 0.7;
      opacity = 0.28;
    } else if (data.sprite === 'pillar') {
      shadowWidth = this.tileSize * 0.9;
      shadowHeight = this.tileSize * 0.42;
      opacity = 0.28;
    } else if (data.sprite === 'torch_wall') {
      shadowWidth = this.tileSize * 0.7;
      shadowHeight = this.tileSize * 0.24;
      opacity = 0.16;
    }

    this.drawSoftShadow(ctx, cx, by, shadowWidth, shadowHeight, opacity);
  }

  drawShadow(ctx, object, type) {
    // Legacy method maintained for compatibility but redirected to modern soft shadows
    this.drawSoftShadowForEntity(ctx, { data: object, type });
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
    const drawn = drawTile(ctx, this.atlas, sprite, px, py, this.tileSize, this.tileSize, fallbackColor);
    return drawn;
  }

  drawMap(ctx, grid) {
    // If the map has multiple layers, draw the ground layers first
    if (Array.isArray(grid.layers)) {
      grid.layers.forEach(layer => {
        // Skip layers that should be drawn after entities (e.g. roofs)
        if (layer.zIndex < 0 || layer.zIndex === undefined) {
           this.renderLayer(ctx, grid, layer.tiles);
        }
      });
    } else {
      // Backwards compatibility for single tiles array
      this.renderLayer(ctx, grid, grid.tiles);
    }

    if (grid.safe) {
      ctx.fillStyle = grid.id === 'castle' ? 'rgba(255, 235, 200, 0.03)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(this.offsetX, this.offsetY, this.mapPixelWidth, this.mapPixelHeight);
    }
  }

  renderLayer(ctx, grid, tiles) {
    if (!tiles) return;
    for (let y = 0; y < grid.height; y += 1) {
      const row = tiles[y];
      if (!row) continue;
      for (let x = 0; x < grid.width; x += 1) {
        const char = row[x];
        const tileType = grid.legend ? grid.legend[char] : char;
        if (!tileType || tileType === 'empty' || tileType === 'none') continue;
        
        const info = TileInfo[tileType];
        const fallback = info?.color;
        let spriteToDraw = tileType;

        // Implement tile variations to break up repetitive patterns
        if (info?.variations && info.variations.length > 0) {
          const hash = (Math.abs(x * 374761393 + y * 668265263) ^ 0x9e3779b9);
          const index = (hash >>> 0) % info.variations.length;
          spriteToDraw = info.variations[index];
        }

        this.drawAtlasTile(ctx, spriteToDraw, x, y, fallback);

        // 5. Special Case: Royal Carpet Runner (Golden Fringe)
        if (tileType === 'royal_carpet' || tileType === 'red_carpet') {
          const px = this.offsetX + x * this.tileSize;
          const py = this.offsetY + y * this.tileSize;
          
          const getTileType = (tx, ty) => {
            if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) return null;
            const char = tiles[ty][tx];
            return grid.legend ? grid.legend[char] : char;
          };

          const leftType = getTileType(x - 1, y);
          const rightType = getTileType(x + 1, y);
          const topType = getTileType(x, y - 1);
          const bottomType = getTileType(x, y + 1);
          
          ctx.save();
          ctx.strokeStyle = '#ffd700'; // Gold
          ctx.lineWidth = 2;
          
          if (leftType !== tileType) {
            ctx.beginPath();
            ctx.moveTo(px + 1, py);
            ctx.lineTo(px + 1, py + this.tileSize);
            ctx.stroke();
          }
          if (rightType !== tileType) {
            ctx.beginPath();
            ctx.moveTo(px + this.tileSize - 1, py);
            ctx.lineTo(px + this.tileSize - 1, py + this.tileSize);
            ctx.stroke();
          }
          if (topType !== tileType) {
            ctx.beginPath();
            ctx.moveTo(px, py + 1);
            ctx.lineTo(px + this.tileSize, py + 1);
            ctx.stroke();
          }
          if (bottomType !== tileType) {
            ctx.beginPath();
            ctx.moveTo(px, py + this.tileSize - 1);
            ctx.lineTo(px + this.tileSize, py + this.tileSize - 1);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(255, 235, 160, 0.08)';
          ctx.fillRect(px + this.tileSize * 0.42, py + 3, this.tileSize * 0.16, this.tileSize - 6);
          ctx.restore();
        }
      }
    }
  }

  drawSoftShadow(ctx, centerX, baseY, width, height, opacity = 0.24) {
    const radiusX = Math.max(width * 0.45, this.tileSize * 0.4);
    const radiusY = Math.max(height * 0.18, this.tileSize * 0.12);
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.ellipse(centerX, baseY - radiusY * 0.25, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawObject(ctx, object) {
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
      const metadata = tileLoader.getTileMetadata(sprite) || {};
      const tileUnitsWidth = Number.isFinite(object?.width) && object.width > 0 ? object.width : 1;
      const tileUnitsHeight = Number.isFinite(object?.height) && object.height > 0 ? object.height : 1;
      const width = tileUnitsWidth * this.tileSize;
      const height = tileUnitsHeight * this.tileSize;

      const metadataAnchor = metadata.anchor || [0, 0];
      const anchorX = object.anchorX ?? metadata.anchorX ?? metadataAnchor[0];
      const anchorY = object.anchorY ?? metadata.anchorY ?? metadataAnchor[1];

      const baseX = this.offsetX + (object.x + 0.5) * this.tileSize;
      const baseY = this.offsetY + (object.y + 1) * this.tileSize;
      const px = baseX - anchorX * width;
      const py = baseY - anchorY * height;

      const shouldDrawShadow = object?.shadow ?? (metadata.shadow ?? metadata.category === 'props');
      if (shouldDrawShadow) {
        this.drawSoftShadow(ctx, baseX, baseY, width, height);
      }

      if (sprite === 'throne') {
        this.drawRoyalThrone(ctx, px, py, width, height);
        return;
      }

      if (sprite === 'banner') {
        this.drawRoyalBanner(ctx, px, py, width, height);
        return;
      }

      if (sprite === 'pillar') {
        this.drawRoyalPillar(ctx, px, py, width, height);
        return;
      }

      if (sprite === 'torch_wall') {
        this.drawRoyalTorch(ctx, px, py, width, height);
        return;
      }

      // 0. Support for Custom SpriteSheets on Objects (e.g. Throne V2)
      if (object.spriteSheet) {
          const sheet = this.getSpriteSheetSync(object.spriteSheet);
          if (sheet) {
              if (this.drawSpriteSheetFrame(ctx, sheet, sprite, px, py, width, height)) {
                  return;
              }
          } else {
              this.requestSpriteSheet(object.spriteSheet);
          }
      }

      // 1. Fallback to Atlas
      if (!drawTile(ctx, this.atlas, sprite, px, py, width, height, color)) {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, width, height);
      }
    }
  }

  drawRoyalThrone(ctx, px, py, width, height) {
    const rim = Math.max(3, Math.round(width * 0.05));
    const armWidth = width * 0.14;
    const seatY = py + height * 0.52;
    const baseY = py + height * 0.76;

    ctx.save();

    // Broad pedestal so the throne feels anchored on a dais.
    ctx.fillStyle = 'rgba(66, 44, 28, 0.96)';
    ctx.fillRect(px + width * 0.12, baseY, width * 0.76, height * 0.16);
    ctx.fillStyle = 'rgba(195, 163, 90, 0.90)';
    ctx.fillRect(px + width * 0.10, baseY - height * 0.05, width * 0.80, height * 0.08);

    // Side arms and back.
    ctx.fillStyle = '#6a4125';
    ctx.fillRect(px + width * 0.12, py + height * 0.30, armWidth, height * 0.40);
    ctx.fillRect(px + width * 0.74, py + height * 0.30, armWidth, height * 0.40);
    ctx.fillStyle = '#7b1f1f';
    ctx.fillRect(px + width * 0.24, py + height * 0.12, width * 0.52, height * 0.50);

    // Seat cushion and back cushion.
    ctx.fillStyle = '#4f1117';
    ctx.fillRect(px + width * 0.26, seatY, width * 0.48, height * 0.14);
    ctx.fillStyle = '#8f1e22';
    ctx.fillRect(px + width * 0.28, py + height * 0.18, width * 0.44, height * 0.26);

    // Crowned top and gold trim.
    ctx.fillStyle = '#c89a3b';
    ctx.fillRect(px + width * 0.28, py + height * 0.02, width * 0.44, height * 0.10);
    ctx.fillStyle = '#e6d18b';
    ctx.fillRect(px + width * 0.33, py, width * 0.34, height * 0.05);
    ctx.strokeStyle = '#d8b76c';
    ctx.lineWidth = rim;
    ctx.strokeRect(px + width * 0.20, py + height * 0.10, width * 0.60, height * 0.66);

    // Highlight sweep down the back to make the silhouette readable at distance.
    const shine = ctx.createLinearGradient(px, py, px + width, py);
    shine.addColorStop(0, 'rgba(255,255,255,0.00)');
    shine.addColorStop(0.45, 'rgba(255,240,190,0.22)');
    shine.addColorStop(0.55, 'rgba(255,240,190,0.32)');
    shine.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = shine;
    ctx.fillRect(px + width * 0.24, py + height * 0.08, width * 0.52, height * 0.60);

    // A tiny crest so the throne reads as royal, not just furniture.
    ctx.fillStyle = '#b08a2d';
    ctx.fillRect(px + width * 0.42, py - height * 0.02, width * 0.16, height * 0.08);
    ctx.fillRect(px + width * 0.37, py + height * 0.03, width * 0.06, height * 0.08);
    ctx.fillRect(px + width * 0.57, py + height * 0.03, width * 0.06, height * 0.08);

    ctx.restore();
  }

  drawRoyalBanner(ctx, px, py, width, height) {
    ctx.save();

    const poleWidth = Math.max(2, Math.round(width * 0.12));
    ctx.fillStyle = '#5f3b1c';
    ctx.fillRect(px + width * 0.42, py, poleWidth, height);

    const clothX = px + width * 0.18;
    const clothY = py + height * 0.10;
    const clothW = width * 0.46;
    const clothH = height * 0.76;
    const cloth = ctx.createLinearGradient(clothX, clothY, clothX + clothW, clothY + clothH);
    cloth.addColorStop(0, '#8d1118');
    cloth.addColorStop(0.45, '#bc1d23');
    cloth.addColorStop(1, '#6d0f14');
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(clothX, clothY);
    ctx.lineTo(clothX + clothW, clothY + height * 0.08);
    ctx.lineTo(clothX + clothW - width * 0.06, clothY + clothH * 0.60);
    ctx.lineTo(clothX + clothW * 0.50, clothY + clothH);
    ctx.lineTo(clothX + width * 0.10, clothY + clothH * 0.70);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e0c16f';
    ctx.lineWidth = Math.max(1, Math.round(width * 0.04));
    ctx.stroke();

    ctx.fillStyle = 'rgba(247, 224, 152, 0.7)';
    ctx.fillRect(clothX + clothW * 0.20, clothY + height * 0.12, clothW * 0.26, height * 0.18);
    ctx.fillRect(clothX + clothW * 0.32, clothY + height * 0.34, clothW * 0.12, height * 0.24);

    ctx.restore();
  }

  drawRoyalPillar(ctx, px, py, width, height) {
    ctx.save();

    const shaftX = px + width * 0.26;
    const shaftW = width * 0.48;
    const capH = Math.max(4, Math.round(height * 0.12));
    const baseH = Math.max(4, Math.round(height * 0.16));
    const shaft = ctx.createLinearGradient(shaftX, py, shaftX + shaftW, py);
    shaft.addColorStop(0, '#d9d4c8');
    shaft.addColorStop(0.5, '#f6f2ea');
    shaft.addColorStop(1, '#b8b0a1');

    ctx.fillStyle = '#7d7263';
    ctx.fillRect(shaftX - width * 0.10, py + height - baseH, shaftW + width * 0.20, baseH);
    ctx.fillStyle = shaft;
    ctx.fillRect(shaftX, py + capH, shaftW, height - capH - baseH);
    ctx.fillStyle = '#ece6db';
    ctx.fillRect(shaftX - width * 0.06, py, shaftW + width * 0.12, capH);
    ctx.fillRect(shaftX - width * 0.08, py + height - baseH - capH * 0.12, shaftW + width * 0.16, capH * 0.6);

    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(shaftX + shaftW * 0.60, py + capH, shaftW * 0.10, height - capH - baseH);
    ctx.restore();
  }

  drawRoyalTorch(ctx, px, py, width, height) {
    ctx.save();
    const poleX = px + width * 0.44;
    const poleW = Math.max(2, Math.round(width * 0.10));
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(poleX, py + height * 0.04, poleW, height * 0.86);
    ctx.fillStyle = '#7b5225';
    ctx.fillRect(px + width * 0.24, py + height * 0.20, width * 0.52, height * 0.22);
    ctx.fillStyle = '#c88825';
    ctx.fillRect(px + width * 0.40, py + height * 0.05, width * 0.20, height * 0.10);
    ctx.fillStyle = '#f5cf79';
    ctx.beginPath();
    ctx.moveTo(px + width * 0.50, py);
    ctx.lineTo(px + width * 0.64, py + height * 0.14);
    ctx.lineTo(px + width * 0.50, py + height * 0.28);
    ctx.lineTo(px + width * 0.36, py + height * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawNPC(ctx, npc) {
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

  drawVignette(style = 0.35) {
    const match = typeof style === 'string'
      ? style.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i)
      : null;
    const strength = match ? Number(match[1]) : Number(style);
    vignette(
      this.ctx,
      this.viewportWidth,
      this.viewportHeight,
      Number.isFinite(strength) ? strength : 0.35
    );
  }

  drawShadow(ctx, data, type) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    
    let x, y, w, h;
    if (type === 'player') {
      x = this.player.position.x * this.tileSize + this.tileSize * 0.5;
      y = (this.player.position.y + 0.9) * this.tileSize;
      w = this.tileSize * 0.7;
      h = this.tileSize * 0.3;
    } else {
      x = data.x * this.tileSize + ( (data.width || 1) * this.tileSize * 0.5 );
      y = (data.y + (data.height || 1) - 0.1) * this.tileSize;
      w = (data.width || 1) * this.tileSize * 0.8;
      h = this.tileSize * 0.3;
    }

    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
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
