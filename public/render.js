
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
        const el = document.getElementById('quest-info');
        if (el) el.innerText = `SPRITE_ERR: ${url}`;
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
      } else if (grid.id === 'village') {
        this.drawBritannyBayStage(ctx, grid);
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

      // 1.5 Reflection Pass (For polished floors)
      if (grid.id === 'castle') {
        this.drawFloorReflections(ctx, grid, entities);
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
          if (entity.type === 'object' && (entity.data.sprite === 'torch_wall' || entity.data.sprite === 'royal_brazier')) {
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
        // --- AMBIENT DUST MOTES (Cinematic Atmosphere) ---
        if (grid.id === 'castle' && Math.random() < 0.06) {
            const focus = this.getCastleThroneFocus();
            // Spawn particles specifically in the light beams
            this.particles.spawn(
                focus.centerX + (Math.random() - 0.5) * this.tileSize * 10,
                focus.glowY - Math.random() * this.tileSize * 8,
                {
                    vx: (Math.random() - 0.5) * 8,
                    vy: -Math.random() * 5 - 2,
                    life: 2.5 + Math.random() * 2,
                    size: Math.random() * 2 + 1,
                    color: 'rgba(255, 245, 200, 0.4)'
                }
            );
        }
        this.particles.draw(ctx);
      }

      this.camera.reset(ctx);
      
      // 4. Throne Room Special Effects (Showcase Upgrade v2)
        if (grid.id === 'castle') {
            const throneFocus = this.getCastleThroneFocus();
            const throneX = throneFocus.centerX;
            const throneY = throneFocus.glowY;
            const time = Date.now() * 0.0008;

          // A. Upgraded God-Rays (Linear Volumetric Beams)
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          
          // Source of light from upper left windows
          const raySourceX = throneX - this.tileSize * 12;
          const raySourceY = throneY - this.tileSize * 15;
          
          for(let i = 0; i < 3; i++) {
              const rayShift = Math.sin(time * 0.4 + i) * 15;
              const beamGrad = ctx.createLinearGradient(raySourceX, raySourceY, throneX + rayShift, throneY);
              const beamAlpha = 0.15 + Math.sin(time * 0.6 + i) * 0.08;
              
              beamGrad.addColorStop(0, 'rgba(255, 245, 200, 0)');
              beamGrad.addColorStop(0.5, `rgba(255, 240, 180, ${beamAlpha})`);
              beamGrad.addColorStop(1, 'rgba(255, 230, 150, 0)');
              
              ctx.fillStyle = beamGrad;
              ctx.beginPath();
              ctx.moveTo(raySourceX + i * 120, raySourceY);
              ctx.lineTo(throneX - this.tileSize * 3 + i * 60 + rayShift, throneY + this.tileSize * 8);
              ctx.lineTo(throneX + this.tileSize * 3 + i * 60 + rayShift, throneY + this.tileSize * 8);
              ctx.closePath();
              ctx.fill();
          }

          // A2. Throne Underlight (Direct Golden Glow)
          const underlightGrad = ctx.createRadialGradient(throneX, throneY, 0, throneX, throneY, this.tileSize * 4);
          underlightGrad.addColorStop(0, `rgba(255, 220, 100, ${0.22 + Math.sin(time * 1.5) * 0.06})`);
          underlightGrad.addColorStop(1, 'rgba(255, 180, 50, 0)');
          ctx.fillStyle = underlightGrad;
          ctx.beginPath();
          ctx.ellipse(throneX, throneY + this.tileSize * 2.5, this.tileSize * 3, this.tileSize * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();

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
                if (spark > 0.92) {
                    ctx.beginPath();
                    ctx.moveTo(px, py + (spark - 0.8) * 100);
                    ctx.lineTo(px + this.tileSize, py + (spark - 0.8) * 100 - 10);
                    ctx.stroke();
                }
              }
            }
          }
          ctx.restore();

          // C. Golden Celebration Motes (Dust in the Light)
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (let i = 0; i < 18; i++) {
            const mx = throneX + (Math.sin(time * 0.2 + i * 123.45) * this.tileSize * 10);
            const my = throneY + (Math.cos(time * 0.1 + i * 543.21) * this.tileSize * 6);
            const size = 0.8 + Math.abs(Math.sin(time * 0.7 + i)) * 1.3;
            const moteAlpha = 0.04 + Math.abs(Math.sin(time * 0.4 + i)) * 0.12;
            ctx.fillStyle = `rgba(255, 255, 220, ${moteAlpha})`;
            ctx.beginPath();
            ctx.arc(mx, my, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Add a small glow to the mote
            ctx.shadowBlur = 3;
            ctx.shadowColor = 'rgba(255, 215, 100, 0.24)';
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          ctx.restore();

          // D. Dynamic Brazier Bloom
          const braziers = [
              { x: 10.5, y: 7.5 },
              { x: 19.5, y: 7.5 }
          ];
          
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          braziers.forEach(b => {
              const bx = this.offsetX + b.x * this.tileSize;
              const by = this.offsetY + b.y * this.tileSize;
              const flicker = 0.25 + Math.sin(time * 5 + b.x) * 0.1;
              
              const bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, this.tileSize * 5);
              bGrad.addColorStop(0, `rgba(255, 140, 40, ${flicker})`);
              bGrad.addColorStop(0.5, `rgba(255, 80, 20, ${flicker * 0.4})`);
              bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              
              ctx.fillStyle = bGrad;
              ctx.beginPath();
              ctx.arc(bx, by, this.tileSize * 4, 0, Math.PI * 2);
              ctx.fill();
          });
          ctx.restore();

          // E. Sovereign Aura (Lord British Divine Presence)
          const lb = this.npcs.find(n => n.id === 'lord_british');
          if (lb) {
              const lbx = this.offsetX + (lb.x + 0.5) * this.tileSize;
              const lby = this.offsetY + (lb.y - 0.2) * this.tileSize;
              
              ctx.save();
              ctx.globalCompositeOperation = 'screen';
              
              // 1. Divine Pillar of Light (Arthurian Connection)
              const pillarGrad = ctx.createLinearGradient(lbx - 20, 0, lbx + 20, 0);
              pillarGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              pillarGrad.addColorStop(0.5, 'rgba(255, 255, 200, 0.15)');
              pillarGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
              ctx.fillStyle = pillarGrad;
              ctx.fillRect(lbx - this.tileSize * 1.5, 0, this.tileSize * 3, lby);

              // 2. Main Sovereign Halo
              const auraSize = this.tileSize * (1.8 + Math.sin(time * 2) * 0.2);
              const auraGrad = ctx.createRadialGradient(lbx, lby, 0, lbx, lby, auraSize);
              auraGrad.addColorStop(0, 'rgba(255, 255, 200, 0.5)');
              auraGrad.addColorStop(0.6, 'rgba(255, 215, 0, 0.2)');
              auraGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
              ctx.fillStyle = auraGrad;
              ctx.beginPath();
              ctx.arc(lbx, lby, auraSize, 0, Math.PI * 2);
              ctx.fill();

              // 3. The Eight Virtues (Orbiting Orbs of Light)
              const orbitRadius = this.tileSize * 1.4;
              for (let i = 0; i < 8; i++) {
                  const angle = (time * 0.8) + (i * (Math.PI * 2 / 8));
                  const ox = lbx + Math.cos(angle) * orbitRadius;
                  const oy = lby + Math.sin(angle) * orbitRadius * 0.4; // Elliptical orbit
                  
                  const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 8);
                  orbGrad.addColorStop(0, '#fff');
                  orbGrad.addColorStop(0.5, 'rgba(255, 230, 100, 0.8)');
                  orbGrad.addColorStop(1, 'rgba(255, 200, 50, 0)');
                  
                  ctx.fillStyle = orbGrad;
                  ctx.beginPath();
                  ctx.arc(ox, oy, 8, 0, Math.PI * 2);
                  ctx.fill();
              }
              
              ctx.restore();
          }
      }
    }
    ctx.restore();

    // 5. Global Atmospheric Lighting
    if (grid) {
      this.drawAtmosphericLighting(ctx, grid);
    }

    // Character sheet glow
    if (this.characterSheetOpen) {
      this.drawVignette('rgba(0,0,0,0.6)');
    }

    if (grid) {
        const { tint, vignette: vignetteStrength } = this.timeOfDay.getTint();
        const isCastleInterior = grid.id === 'castle';
        ctx.save();
        vignette(
          ctx,
          this.viewportWidth,
          this.viewportHeight,
          isCastleInterior ? Math.min(0.025, vignetteStrength * 0.08) : vignetteStrength
        );
        colorGrade(
          ctx,
          isCastleInterior ? 'rgba(255, 235, 210, 0.008)' : tint,
          this.viewportWidth,
          this.viewportHeight
        );
        ctx.restore();
    }

    if (grid?.id === 'castle') {
      this.drawCastleCarpetOverlay(ctx, grid);
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

    if (this.debugOverlay) {
      this.hudOverlay.draw(ctx, {
        fps: this.fps,
        resources: {},
        castleLevel: 1,
        debug: debugPayload
      });
    }
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
    const ty = this.offsetY + (torch.y + (torch.sprite === 'royal_brazier' ? 0.45 : 0.5)) * this.tileSize;
    const time = Date.now() * 0.002;
    const flicker = 1 + Math.sin(time * 3) * 0.1;
    const isCastle = this.map?.id === 'castle';
    const radius = this.tileSize * (torch.sprite === 'royal_brazier'
      ? (isCastle ? 1.9 : 2.8)
      : (isCastle ? 2.2 : 3.35)) * flicker;

    const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius);
    if (isCastle) {
      grad.addColorStop(0, 'rgba(255, 235, 170, 0.12)');
      grad.addColorStop(0.28, 'rgba(255, 194, 80, 0.08)');
      grad.addColorStop(0.55, 'rgba(255, 130, 35, 0.035)');
    } else {
      grad.addColorStop(0, 'rgba(255, 235, 170, 0.30)');
      grad.addColorStop(0.28, 'rgba(255, 194, 80, 0.24)');
      grad.addColorStop(0.55, 'rgba(255, 130, 35, 0.14)');
    }
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalCompositeOperation = isCastle ? 'screen' : 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tx, ty, radius, 0, Math.PI * 2);
    ctx.fill();
      ctx.restore();
    }

  drawFloorReflections(ctx, grid, entities) {
    const time = Date.now() * 0.001;
    ctx.save();
    
    entities.forEach(entity => {
        const data = entity.data;
        const x = entity.type === 'player' ? data.position.x : data.x;
        const y = entity.type === 'player' ? data.position.y : data.y;
        
        // Base of the entity
        const baseX = Math.floor(x + (data.width || 1) * 0.5);
        const baseY = Math.floor(y + (data.height || 1));
        
        // Check floor tile beneath
        const char = grid.tiles[baseY]?.[baseX];
        const tileType = grid.legend ? grid.legend[char] : char;
        
        if (tileType && (tileType.includes('marble') || tileType === 'dais_floor' || tileType.includes('carpet'))) {
            ctx.save();
            
            // Reflection properties
            const opacity = tileType.includes('carpet') ? 0.05 : 0.15;
            ctx.globalAlpha = opacity;
            ctx.globalCompositeOperation = 'screen';
            
            const w = (data.width || 1) * this.tileSize;
            const h = (data.height || 1) * this.tileSize;
            const px = this.offsetX + x * this.tileSize;
            const py = this.offsetY + (y + (data.height || 1)) * this.tileSize;

            // Transformation: Flip vertically and squish slightly
            ctx.translate(px + w/2, py);
            ctx.scale(1, -0.5); // Vertical squish for perspective
            ctx.translate(-(px + w/2), -py);

            // Draw based on type
            if (entity.type === 'player') {
                const frameKey = this.playerAnim.frame() || 'player_south_1';
                drawSprite(ctx, this.atlas, frameKey, px, py - h, w, h);
            } else if (entity.type === 'npc') {
                if (data.spriteSheet) {
                    const sheetOptions = data.spriteSheetOptions || data.spriteOptions;
                    const sheet = this.getSpriteSheetSync(data.spriteSheet, sheetOptions);
                    const frameKey = data.spriteFrame || 'player_south_1';
                    if (sheet) {
                        this.drawSpriteSheetFrame(ctx, sheet, frameKey, px, py - h, w, h);
                    }
                } else {
                    drawSprite(ctx, this.atlas, data.sprite, px, py - h, w, h);
                }
            } else if (entity.type === 'object') {
                // Don't reflect torches (they are light sources, not solid)
                if (data.sprite !== 'torch_wall') {
                    drawSprite(ctx, this.atlas, data.sprite, px, py - h, w, h);
                }
            }
            
            ctx.restore();
        }
    });
    
    ctx.restore();
  }

  getCastleThroneFocus() {
    const ts = this.tileSize;
    const fallbackCenterX = this.offsetX + 14.5 * ts;
    const fallbackBaseY = this.offsetY + 6.0 * ts;
    const throne = Array.isArray(this.objects)
      ? this.objects.find((object) => object?.sprite === 'throne')
      : null;

    if (!throne) {
      return {
        centerX: fallbackCenterX,
        baseY: fallbackBaseY,
        topY: fallbackBaseY - ts * 4,
        glowY: fallbackBaseY - ts * 2.1,
        width: ts * 4,
        height: ts * 4
      };
    }

    const metadata = tileLoader.getTileMetadata('throne') || {};
    const anchor = Array.isArray(metadata.anchor) ? metadata.anchor : [0.5, 1];
    const width = (Number.isFinite(throne.width) && throne.width > 0 ? throne.width : 1) * ts;
    const height = (Number.isFinite(throne.height) && throne.height > 0 ? throne.height : 1) * ts;
    const anchorX = Number.isFinite(throne.anchorX) ? throne.anchorX : anchor[0];
    const anchorY = Number.isFinite(throne.anchorY) ? throne.anchorY : anchor[1];
    const baseX = this.offsetX + (throne.x + 0.5) * ts;
    const baseY = this.offsetY + (throne.y + 1) * ts;
    const px = baseX - anchorX * width;
    const py = baseY - anchorY * height;

    return {
      centerX: baseX,
      baseY,
      topY: py,
      glowY: py + height * 0.42,
      width,
      height
    };
  }

  drawAtmosphericLighting(ctx, grid) {
    if (!this.player || !this.player.position) return;
    
    const ts = this.tileSize;
    const { x: px, y: py } = this.getPlayerScreenCenter();
    const isCastle = grid?.id === 'castle';
    const time = Date.now() * 0.001;
    const flicker = 1 + Math.sin(time * 8) * 0.03;
    
    const isSafe = grid?.safe || isCastle;
    const baseShadowAlpha = isSafe ? 0.05 : 0.55; // Significantly reduced for throne room clarity
    
    ctx.save();

    if (isCastle) {
      const throneFocus = this.getCastleThroneFocus();
      const ambientLift = ctx.createLinearGradient(0, 0, 0, this.viewportHeight);
      ambientLift.addColorStop(0, 'rgba(243, 239, 232, 0.005)');
      ambientLift.addColorStop(0.55, 'rgba(236, 231, 223, 0.0025)');
      ambientLift.addColorStop(1, 'rgba(229, 223, 214, 0.0008)');
      ctx.fillStyle = ambientLift;
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

      ctx.globalCompositeOperation = 'screen';
      const throneAura = ctx.createRadialGradient(
        throneFocus.centerX,
        this.offsetY + ts * 4.6,
        ts * 1.2,
        throneFocus.centerX,
        this.offsetY + ts * 4.6,
        ts * 8.8
      );
      throneAura.addColorStop(0, 'rgba(255, 230, 180, 0.018)');
      throneAura.addColorStop(0.42, 'rgba(255, 220, 160, 0.006)');
      throneAura.addColorStop(1, 'rgba(255, 210, 150, 0)');
      ctx.fillStyle = throneAura;
      ctx.fillRect(this.offsetX + ts, this.offsetY, this.mapPixelWidth - ts * 2, ts * 13);

      ctx.restore();
      return;
    }
    
    // 1. Shadow Overlay (World Space / Screen Relative)
    // We create a large radial gradient that follows the player to act as a "vision cone" or light source
    const lightRadius = ts * (isSafe ? 8 : 5.5) * flicker;
    const shadowGrad = ctx.createRadialGradient(px, py, ts * 0.8, px, py, lightRadius);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGrad.addColorStop(0.5, `rgba(30, 20, 10, ${baseShadowAlpha * 0.4})`);
    shadowGrad.addColorStop(1, `rgba(40, 30, 20, ${baseShadowAlpha})`);
    
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    
    // 2. Hero Light (Subtle warm glow around player)
    const heroGrad = ctx.createRadialGradient(px, py, 0, px, py, ts * 4.0);
    heroGrad.addColorStop(0, 'rgba(255, 210, 150, 0.12)');
    heroGrad.addColorStop(1, 'rgba(255, 210, 150, 0)');
    
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = heroGrad;
    ctx.beginPath();
    ctx.arc(px, py, ts * 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  drawCastleBackdrop(ctx) {
    const width = this.viewportWidth;
    const height = this.viewportHeight;

    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#d7d1c8');
    base.addColorStop(0.46, '#c8c0b6');
    base.addColorStop(1, '#afa69a');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.5, height * 0.24, 24, width * 0.5, height * 0.24, Math.max(width, height) * 0.62);
    glow.addColorStop(0, 'rgba(255, 233, 188, 0.045)');
    glow.addColorStop(0.42, 'rgba(255, 224, 174, 0.014)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const edgeShade = ctx.createLinearGradient(0, 0, width, 0);
    edgeShade.addColorStop(0, 'rgba(105, 94, 82, 0.08)');
    edgeShade.addColorStop(0.08, 'rgba(255,255,255,0)');
    edgeShade.addColorStop(0.92, 'rgba(255,255,255,0)');
    edgeShade.addColorStop(1, 'rgba(105, 94, 82, 0.08)');
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, width, height);
  }

  drawCastleThroneRoomStage(ctx, grid) {
      const ts = this.tileSize;
      const throneFocus = this.getCastleThroneFocus();
      const hallLeft = this.offsetX + 7.6 * ts;
      const hallTop = this.offsetY + 1.0 * ts;
      const hallWidth = 14.8 * ts;
      const hallHeight = 8.6 * ts;
      const throneCenterX = throneFocus.centerX;
      const throneCenterY = throneFocus.glowY;
      const alcoveLeft = throneCenterX - ts * 4.0;
      const alcoveTop = this.offsetY + 0.8 * ts;
    const alcoveWidth = ts * 8.0;
    const alcoveHeight = ts * 5.2;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const throneGlow = ctx.createRadialGradient(throneCenterX, throneCenterY, ts * 0.8, throneCenterX, throneCenterY, ts * 7.2);
    throneGlow.addColorStop(0, 'rgba(255, 238, 180, 0.22)');
    throneGlow.addColorStop(0.32, 'rgba(230, 183, 86, 0.12)');
    throneGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = throneGlow;
    ctx.fillRect(hallLeft - ts, hallTop - ts * 0.4, hallWidth + ts * 2, hallHeight + ts * 1.6);

    const crestGlow = ctx.createRadialGradient(throneCenterX, this.offsetY + 1.9 * ts, ts * 0.3, throneCenterX, this.offsetY + 1.9 * ts, ts * 2.5);
    crestGlow.addColorStop(0, 'rgba(255, 245, 210, 0.18)');
    crestGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = crestGlow;
    ctx.fillRect(throneCenterX - ts * 2.5, this.offsetY, ts * 5, ts * 4.5);
    ctx.globalCompositeOperation = 'source-over';

    const sanctuary = ctx.createLinearGradient(0, hallTop, 0, hallTop + hallHeight);
    sanctuary.addColorStop(0, 'rgba(255, 251, 244, 0.015)');
    sanctuary.addColorStop(0.55, 'rgba(255, 247, 235, 0.006)');
    sanctuary.addColorStop(1, 'rgba(255, 244, 232, 0)');
    ctx.fillStyle = sanctuary;
    ctx.fillRect(hallLeft, hallTop, hallWidth, hallHeight);

    const lowerFalloff = ctx.createLinearGradient(0, this.offsetY + 7.8 * ts, 0, this.offsetY + 18.8 * ts);
    lowerFalloff.addColorStop(0, 'rgba(0, 0, 0, 0)');
    lowerFalloff.addColorStop(1, 'rgba(255, 246, 232, 0.006)');
    ctx.fillStyle = lowerFalloff;
    ctx.fillRect(this.offsetX + 2 * ts, this.offsetY + 7.8 * ts, ts * 26, ts * 11);

    const alcoveShade = ctx.createLinearGradient(0, alcoveTop, 0, alcoveTop + alcoveHeight);
    alcoveShade.addColorStop(0, 'rgba(116, 98, 80, 0.08)');
    alcoveShade.addColorStop(0.5, 'rgba(145, 124, 104, 0.025)');
    alcoveShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = alcoveShade;
    ctx.fillRect(alcoveLeft, alcoveTop, alcoveWidth, alcoveHeight);

    const alcoveArch = new Path2D();
    alcoveArch.moveTo(throneCenterX - ts * 3.2, this.offsetY + 4.7 * ts);
    alcoveArch.lineTo(throneCenterX - ts * 2.9, this.offsetY + 1.7 * ts);
    alcoveArch.ellipse(throneCenterX, this.offsetY + 1.8 * ts, ts * 2.9, ts * 1.35, 0, Math.PI, 0);
    alcoveArch.lineTo(throneCenterX + ts * 3.2, this.offsetY + 4.7 * ts);
    alcoveArch.closePath();
    ctx.fillStyle = 'rgba(255, 248, 235, 0.05)';
    ctx.fill(alcoveArch);
    ctx.strokeStyle = 'rgba(235, 198, 114, 0.18)';
    ctx.lineWidth = 3;
    ctx.stroke(alcoveArch);

    const daisPath = new Path2D();
    daisPath.moveTo(throneCenterX - ts * 3.8, this.offsetY + 6.6 * ts);
    daisPath.lineTo(throneCenterX - ts * 3.1, this.offsetY + 5.2 * ts);
    daisPath.lineTo(throneCenterX - ts * 1.9, this.offsetY + 4.3 * ts);
    daisPath.lineTo(throneCenterX + ts * 1.9, this.offsetY + 4.3 * ts);
    daisPath.lineTo(throneCenterX + ts * 3.1, this.offsetY + 5.2 * ts);
    daisPath.lineTo(throneCenterX + ts * 3.8, this.offsetY + 6.6 * ts);
    daisPath.lineTo(throneCenterX + ts * 3.2, this.offsetY + 8.0 * ts);
    daisPath.lineTo(throneCenterX - ts * 3.2, this.offsetY + 8.0 * ts);
    daisPath.closePath();
    ctx.fillStyle = 'rgba(255, 244, 221, 0.085)';
    ctx.fill(daisPath);
    ctx.strokeStyle = 'rgba(215, 185, 120, 0.24)';
    ctx.lineWidth = 3;
    ctx.stroke(daisPath);

    ctx.fillStyle = 'rgba(124, 104, 86, 0.06)';
    ctx.fillRect(throneCenterX - ts * 3.1, this.offsetY + 8.02 * ts, ts * 6.2, ts * 0.26);
    ctx.fillRect(throneCenterX - ts * 2.6, this.offsetY + 7.02 * ts, ts * 5.2, ts * 0.22);
    ctx.fillStyle = 'rgba(255, 246, 225, 0.06)';
    ctx.fillRect(throneCenterX - ts * 2.4, this.offsetY + 4.55 * ts, ts * 4.8, ts * 1.7);

    const runnerX = this.offsetX + 13.5 * ts;
    const runnerY = this.offsetY + 9.0 * ts;
    ctx.fillStyle = '#b11828';
    ctx.fillRect(runnerX, runnerY, ts * 2.0, ts * 8.5);

    ctx.fillStyle = '#82101c';
    ctx.fillRect(runnerX + ts * 0.08, runnerY, ts * 0.06, ts * 8.5);
    ctx.fillRect(runnerX + ts * 1.86, runnerY, ts * 0.06, ts * 8.5);
    ctx.fillStyle = '#d72b39';
    ctx.fillRect(runnerX + ts * 0.14, runnerY + ts * 0.2, ts * 1.72, ts * 8.1);

    const aisleShadeLeft = ctx.createLinearGradient(hallLeft, 0, hallLeft + ts * 2.4, 0);
    aisleShadeLeft.addColorStop(0, 'rgba(100, 82, 64, 0.014)');
    aisleShadeLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aisleShadeLeft;
    ctx.fillRect(hallLeft, hallTop + ts * 0.5, ts * 2.4, hallHeight);
    const aisleShadeRight = ctx.createLinearGradient(hallLeft + hallWidth, 0, hallLeft + hallWidth - ts * 2.4, 0);
    aisleShadeRight.addColorStop(0, 'rgba(100, 82, 64, 0.014)');
    aisleShadeRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aisleShadeRight;
    ctx.fillRect(hallLeft + hallWidth - ts * 2.4, hallTop + ts * 0.5, ts * 2.4, hallHeight);

    const pillarLanes = [6.5, 23.5];
    pillarLanes.forEach((lane) => {
      const laneX = this.offsetX + lane * ts;
      const laneShade = ctx.createLinearGradient(laneX - ts * 0.85, 0, laneX + ts * 0.85, 0);
      laneShade.addColorStop(0, 'rgba(92, 76, 60, 0)');
      laneShade.addColorStop(0.5, 'rgba(130, 112, 92, 0.014)');
      laneShade.addColorStop(1, 'rgba(92, 76, 60, 0)');
      ctx.fillStyle = laneShade;
      ctx.fillRect(laneX - ts * 0.85, this.offsetY + 1.8 * ts, ts * 1.7, ts * 16.2);

      ctx.fillStyle = 'rgba(255, 252, 242, 0.018)';
      ctx.fillRect(laneX - ts * 0.45, this.offsetY + 2.3 * ts, ts * 0.9, ts * 15.3);
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(156, 142, 124, 0.12)';
    ctx.lineWidth = 1;
    for (let gx = 2; gx <= 28; gx += 1) {
      const seamX = this.offsetX + gx * ts;
      ctx.beginPath();
      ctx.moveTo(seamX, this.offsetY + ts * 2.1);
      ctx.lineTo(seamX, this.offsetY + ts * 18.2);
      ctx.stroke();
    }
    for (let gy = 2; gy <= 18; gy += 1) {
      const seamY = this.offsetY + gy * ts;
      ctx.beginPath();
      ctx.moveTo(this.offsetX + ts * 2.1, seamY);
      ctx.lineTo(this.offsetX + ts * 27.9, seamY);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 252, 244, 0.045)';
    for (let gx = 2; gx <= 28; gx += 1) {
      const seamX = this.offsetX + gx * ts + 1;
      ctx.beginPath();
      ctx.moveTo(seamX, this.offsetY + ts * 2.1);
      ctx.lineTo(seamX, this.offsetY + ts * 18.2);
      ctx.stroke();
    }
    for (let gy = 2; gy <= 18; gy += 1) {
      const seamY = this.offsetY + gy * ts + 1;
      ctx.beginPath();
      ctx.moveTo(this.offsetX + ts * 2.1, seamY);
      ctx.lineTo(this.offsetX + ts * 27.9, seamY);
      ctx.stroke();
    }
    ctx.restore();

    // --- THE ROYAL SEAL (Floor Ornament) ---
    const sealX = this.offsetX + 14.5 * ts;
    const sealY = this.offsetY + 12.5 * ts;
    const sealSize = ts * 2.8;
    
    ctx.save();
    ctx.translate(sealX, sealY);
    ctx.rotate(Date.now() * 0.0001); // Extremely subtle, majestic rotation
    
    const sealGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sealSize/2);
    sealGrad.addColorStop(0, 'rgba(218, 165, 32, 0.09)');
    sealGrad.addColorStop(0.8, 'rgba(184, 134, 11, 0.04)');
    sealGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = sealGrad;
    ctx.beginPath();
    ctx.arc(0, 0, sealSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Compass rose/Seal geometry
    ctx.strokeStyle = 'rgba(246, 225, 164, 0.07)';
    ctx.lineWidth = 1;
    for(let i=0; i<8; i++) {
        ctx.beginPath();
        ctx.rotate(Math.PI / 4);
        ctx.moveTo(0, -sealSize * 0.4);
        ctx.lineTo(sealSize * 0.1, 0);
        ctx.lineTo(0, sealSize * 0.4);
        ctx.stroke();
    }
    
    ctx.restore();

    ctx.restore();
  }

  drawCastleCarpetOverlay(ctx, grid) {
    if (!grid || grid.id !== 'castle') return;
    const runnerMatches = (candidate) => candidate === 'royal_carpet' || (typeof candidate === 'string' && candidate.startsWith('red_carpet'));

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const char = grid.tiles[y]?.[x];
        const tileType = grid.legend ? grid.legend[char] : char;
        if (!runnerMatches(tileType)) continue;
        const px = this.offsetX + x * this.tileSize;
        const py = this.offsetY + y * this.tileSize;
        ctx.fillStyle = '#c4172d';
        ctx.fillRect(px, py, this.tileSize, this.tileSize);
        ctx.fillStyle = '#a01022';
        ctx.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
        ctx.fillStyle = '#e12b3d';
        ctx.fillRect(px + 3, py + 3, this.tileSize - 6, this.tileSize - 6);
      }
    }
    ctx.restore();
  }

  drawBritannyBayStage(ctx, grid) {
    const ts = this.tileSize;
    const time = Date.now() * 0.001;

    ctx.save();
    
    // 1. Water Ripple Effect (on southern ocean)
    for (let y = 27; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const char = grid.tiles[y][x];
        const tileType = grid.legend ? grid.legend[char] : char;
        if (tileType === 'azure_water' || tileType === 'deep_ocean' || tileType === 'water') {
          const px = this.offsetX + x * ts;
          const py = this.offsetY + y * ts;
          const ripple = Math.sin(time * 1.2 + x * 0.5 + y * 0.8) * 0.15;
          
          ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + ripple})`;
          ctx.fillRect(px, py, ts, ts);
        }
      }
    }

    // 2. Sea Mist (Large soft white motes)
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 15; i++) {
      const mx = this.offsetX + (Math.sin(time * 0.12 + i * 22) * this.mapPixelWidth * 0.6) + this.mapPixelWidth * 0.5;
      const my = this.offsetY + (Math.cos(time * 0.08 + i * 33) * this.mapPixelHeight * 0.4) + this.mapPixelHeight * 0.7;
      const size = 30 + Math.sin(time * 0.5 + i) * 10;
      const mistAlpha = 0.03 + Math.sin(time * 0.4 + i) * 0.02;
      
      const mistGrad = ctx.createRadialGradient(mx, my, 0, mx, my, size * 3);
      mistGrad.addColorStop(0, `rgba(230, 245, 255, ${mistAlpha})`);
      mistGrad.addColorStop(1, 'rgba(230, 245, 255, 0)');
      
      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.arc(mx, my, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Harbor Lanterns (Glow on wood_dock)
    const lanterns = [
      { x: 17, y: 24.5 },
      { x: 25, y: 24.5 },
      { x: 5, y: 24.5 }
    ];
    
    lanterns.forEach(l => {
      const lx = this.offsetX + l.x * ts;
      const ly = this.offsetY + l.y * ts;
      const flicker = 1 + Math.sin(time * 5 + l.x) * 0.12;
      
      const lGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, ts * 5);
      lGrad.addColorStop(0, `rgba(255, 210, 120, ${0.28 * flicker})`);
      lGrad.addColorStop(0.5, `rgba(255, 160, 60, ${0.1 * flicker})`);
      lGrad.addColorStop(1, 'rgba(255, 120, 40, 0)');
      
      ctx.fillStyle = lGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, ts * 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  drawSoftShadowForEntity(ctx, entity) {
    const data = entity.data;
    if (data?.shadow === false) {
      return;
    }
    if (data?.sprite === 'banner') {
      return;
    }
    let cx = this.offsetX + (data.x + 0.5) * this.tileSize;
    let by = this.offsetY + (data.y + 1) * this.tileSize;

    if (entity.type === 'player' && data.position) {
       cx = this.offsetX + (data.position.x + 0.5) * this.tileSize;
       by = this.offsetY + (data.position.y + 1) * this.tileSize;
    } else if (entity.type === 'object') {
      const metadata = data?.sprite ? (tileLoader.getTileMetadata(data.sprite) || {}) : {};
      const metadataAnchor = Array.isArray(metadata.anchor) ? metadata.anchor : null;
      const hasAnchoredPlacement = Number.isFinite(data?.anchorX)
        || Number.isFinite(data?.anchorY)
        || Array.isArray(metadataAnchor);

      if (!hasAnchoredPlacement) {
        if (data.width && data.width > 1) {
          cx = this.offsetX + (data.x + data.width / 2) * this.tileSize;
        }
        if (data.height && data.height > 1) {
          by = this.offsetY + (data.y + data.height) * this.tileSize;
        }
      }
    }

    let shadowWidth = this.tileSize;
    let shadowHeight = this.tileSize * 0.5;
    let opacity = 0.24;

    if (data.sprite === 'throne') {
      shadowWidth = this.tileSize * 2.1;
      shadowHeight = this.tileSize * 0.34;
      opacity = 0.28;
    } else if (data.sprite === 'pillar') {
      shadowWidth = this.tileSize * 1.05;
      shadowHeight = this.tileSize * 0.5;
      opacity = 0.32;
    } else if (data.sprite === 'torch_wall') {
      shadowWidth = this.tileSize * 0.7;
      shadowHeight = this.tileSize * 0.24;
      opacity = 0.16;
    } else if (data.sprite === 'royal_brazier') {
      shadowWidth = this.tileSize * 0.9;
      shadowHeight = this.tileSize * 0.3;
      opacity = 0.20;
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
    } else if (Array.isArray(map.layout)) {
      tiles = map.layout;
    } else if (Array.isArray(map)) {
      tiles = map;
    } else if (typeof map.getTiles === 'function') {
      tiles = map.getTiles();
    } else if (Array.isArray(map?.data)) {
      tiles = map.data;
    } else if (Array.isArray(map?.layersData?.[0]?.layout)) {
      tiles = map.layersData[0].layout;
    } else if (Array.isArray(map?.layout)) {
      tiles = map.layout;
    }

    if (!Array.isArray(tiles) || !tiles.length) {
      console.warn('getMapGrid: No tiles found for map', map?.id);
      return null;
    }

    const width = tiles[0]?.length || 0;
    const height = tiles.length;
    return {
      id: map.id || null,
      legend: map.legend || null,
      layers: map.layersData || map.layers || [],
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
    const ts = this.tileSize;
    const startCol = Math.floor(this.camera.x / ts);
    const endCol = Math.ceil((this.camera.x + this.viewportWidth) / ts);
    const startRow = Math.floor(this.camera.y / ts);
    const endRow = Math.ceil((this.camera.y + this.viewportHeight) / ts);

    // Helper to draw a single tile grid
    const drawTileGrid = (tiles, legend) => {
      for (let y = Math.max(0, startRow); y <= Math.min(grid.height - 1, endRow); y++) {
        for (let x = Math.max(0, startCol); x <= Math.min(grid.width - 1, endCol); x++) {
          const char = tiles[y][x];
          // Robust lookup: try legend first, then fallback to raw char
          const info = (legend && legend[char]) ? legend[char] : char;
          if (!info || info === 'none') continue;

          const tileType = typeof info === 'string' ? info : info.type;
          const metadata = TileInfo[tileType];
          
          let spriteKey = tileType;
          if (metadata && metadata.variations && metadata.variations.length > 1) {
             const hash = (x * 374761393 ^ y * 668265263) >>> 0;
             const index = hash % metadata.variations.length;
             spriteKey = metadata.variations[index];
          }

          const px = this.offsetX + x * ts;
          const py = this.offsetY + y * ts;
          const isThroneRoom = grid.id === 'castle';
          const isWallTile = tileType.includes('wall');
          const isFloorTile = tileType.includes('floor');
          const isCarpetTile = tileType.includes('carpet');
          const isRoyalMarbleTile = tileType === 'dais_floor'
            || tileType === 'marble_edge'
            || tileType.startsWith('marble_floor');

          if (isThroneRoom && metadata?.color) {
            // Keep a light underpaint so translucent marble sprites stay readable
            // without collapsing back into the old dark-brown floor regression.
            let baseAlpha = 0.52;
            let baseColor = metadata.color;
            if (isWallTile) baseAlpha = 0.88;
            else if (isRoyalMarbleTile) {
              baseAlpha = 0.46;
              if (tileType === 'dais_floor') {
                baseColor = '#d8d1c8';
              } else if (tileType === 'marble_edge') {
                baseColor = '#d0c8bf';
              } else {
                baseColor = '#c4bdb5';
              }
            }
            else if (isCarpetTile) baseAlpha = 1;

            ctx.save();
            ctx.globalAlpha = baseAlpha;
            ctx.fillStyle = baseColor;
            ctx.fillRect(px, py, ts, ts);
            ctx.restore();
          }

          if (isFloorTile || isCarpetTile) {
              ctx.save();
              ctx.translate(px + ts/2, py + ts/2);

              // Keep marble variation organic, but preserve the ceremonial runner direction.
              if (isFloorTile && !isCarpetTile) {
                const rotSeed = (x * 13 + y * 7) % 4;
                ctx.rotate((rotSeed * Math.PI) / 2);
              }
              
              if (isThroneRoom && isFloorTile) {
                ctx.filter = isRoyalMarbleTile
                  ? 'brightness(0.96) contrast(1.08)'
                  : 'brightness(1.03) contrast(1.12) saturate(1.18)';
              }
              
              drawTile(ctx, this.atlas, spriteKey, -ts/2, -ts/2, ts, ts, metadata?.color);
              ctx.restore();
          } else {
              drawTile(ctx, this.atlas, spriteKey, px, py, ts, ts, metadata?.color);
          }

          if (isThroneRoom && isRoyalMarbleTile) {
              ctx.save();
              const paneAlpha = tileType === 'dais_floor'
                ? ((x + y) % 2 === 0 ? 0.13 : 0.085)
                : tileType === 'marble_edge'
                  ? 0.09
                  : ((x + y) % 2 === 0 ? 0.08 : 0.04);
              ctx.fillStyle = tileType === 'dais_floor'
                ? `rgba(255, 252, 246, ${paneAlpha})`
                : `rgba(255, 250, 242, ${paneAlpha})`;
              ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);

              const groutAlpha = tileType === 'dais_floor'
                ? 0.34
                : tileType === 'marble_edge'
                  ? 0.28
                  : 0.24;
              ctx.strokeStyle = `rgba(164, 148, 128, ${groutAlpha})`;
              ctx.lineWidth = 1.25;
              ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);

              ctx.strokeStyle = tileType === 'dais_floor'
                ? 'rgba(255, 252, 244, 0.22)'
                : 'rgba(255, 252, 244, 0.14)';
              ctx.beginPath();
              ctx.moveTo(px + 1, py + 1);
              ctx.lineTo(px + ts - 2, py + 1);
              ctx.moveTo(px + 1, py + 1);
              ctx.lineTo(px + 1, py + ts - 2);
              ctx.stroke();

              if (tileType.startsWith('marble_floor')) {
                const veinSeed = (x * 17 + y * 11) % 6;
                if (veinSeed === 1 || veinSeed === 4) {
                  ctx.strokeStyle = 'rgba(150, 144, 138, 0.16)';
                  ctx.beginPath();
                  ctx.moveTo(px + ts * 0.18, py + ts * (veinSeed === 1 ? 0.72 : 0.26));
                  ctx.lineTo(px + ts * 0.82, py + ts * (veinSeed === 1 ? 0.38 : 0.68));
                  ctx.stroke();
                }
              }
              ctx.restore();
          }

          if (isThroneRoom) {
              ctx.fillStyle = 'rgba(0,0,0,0.02)';
              ctx.fillRect(px, py + ts - 1, ts, 1);
              ctx.fillRect(px + ts - 1, py, 1, ts);
          }
        }
      }
    };

    if (Array.isArray(grid.layers) && grid.layers.length > 0) {
      grid.layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).forEach(layer => {
          if ((layer.zIndex || 0) <= 0) {
            drawTileGrid(layer.tiles, layer.legend || grid.legend);
          }
      });
    } else {
      drawTileGrid(grid.tiles, grid.legend);
    }

    if (grid.safe) {
      ctx.fillStyle = grid.id === 'castle' ? 'rgba(255, 245, 220, 0.05)' : 'rgba(255, 255, 255, 0.06)';
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

        // 5. Special Case: Royal Carpet Runner
        const isRunnerTile = tileType === 'royal_carpet' || (typeof tileType === 'string' && tileType.startsWith('red_carpet'));
        if (isRunnerTile) {
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
          ctx.fillStyle = '#b31424';
          ctx.fillRect(px, py, this.tileSize, this.tileSize);
          ctx.fillStyle = '#8c0d1b';
          ctx.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
          ctx.fillStyle = '#d12234';
          ctx.fillRect(px + 3, py + 3, this.tileSize - 6, this.tileSize - 6);
          ctx.fillStyle = 'rgba(255, 214, 214, 0.12)';
          ctx.fillRect(px + this.tileSize * 0.18, py + 4, this.tileSize * 0.08, this.tileSize - 8);
          ctx.fillRect(px + this.tileSize * 0.74, py + 4, this.tileSize * 0.08, this.tileSize - 8);
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

      const rendererHandlesShadow = sprite === 'throne' || sprite === 'banner' || sprite === 'pillar' || sprite === 'torch_wall' || sprite === 'royal_brazier' || object?.shadow === false;
      const shouldDrawShadow = rendererHandlesShadow ? false : (object?.shadow ?? (metadata.shadow ?? metadata.category === 'props'));
      if (shouldDrawShadow) {
        this.drawSoftShadow(ctx, baseX, baseY, width, height);
      }

      if (sprite === 'throne' || sprite === 'banner' || sprite === 'pillar' || sprite === 'torch_wall' || sprite === 'royal_brazier' || sprite === 'royal_drapes' || sprite === 'royal_crest') {
        if (drawTile(ctx, this.atlas, sprite, px, py, width, height, color)) {
          return;
        }
      }

      if (sprite === 'throne') {
        this.drawRoyalThrone(ctx, px, py, width, height);
        return;
      }

      if (sprite === 'ship') {
        this.drawShip(ctx, px, py, width, height);
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
    if (npc?.hidden) return;

    if (npc.spriteSheet) {
      const sheetOptions = npc.spriteSheetOptions || npc.spriteOptions;
      const sheet = this.getSpriteSheetSync(npc.spriteSheet, sheetOptions);
      const frameKey = npc.spriteFrame || 'player_south_1';
      const width = typeof npc.spriteTileWidth === 'number'
        ? npc.spriteTileWidth * this.tileSize
        : (typeof npc.spriteWidth === 'number' ? npc.spriteWidth : this.tileSize);
      const height = typeof npc.spriteTileHeight === 'number'
        ? npc.spriteTileHeight * this.tileSize
        : (typeof npc.spriteHeight === 'number' ? npc.spriteHeight : this.tileSize);
      const offsetX = typeof npc.spriteOffsetTileX === 'number'
        ? npc.spriteOffsetTileX * this.tileSize
        : (typeof npc.spriteOffsetX === 'number' ? npc.spriteOffsetX : 0);
      const offsetY = typeof npc.spriteOffsetTileY === 'number'
        ? npc.spriteOffsetTileY * this.tileSize
        : (typeof npc.spriteOffsetY === 'number' ? npc.spriteOffsetY : 0);
      const hasAnchoredPlacement = typeof npc.spriteAnchorX === 'number'
        || typeof npc.spriteAnchorY === 'number'
        || typeof npc.spriteTileWidth === 'number'
        || typeof npc.spriteTileHeight === 'number'
        || typeof npc.spriteOffsetTileX === 'number'
        || typeof npc.spriteOffsetTileY === 'number';
      let px = this.offsetX + npc.x * this.tileSize + offsetX;
      let py = this.offsetY + npc.y * this.tileSize + offsetY;
      if (hasAnchoredPlacement) {
        const anchorX = typeof npc.spriteAnchorX === 'number' ? npc.spriteAnchorX : 0;
        const anchorY = typeof npc.spriteAnchorY === 'number' ? npc.spriteAnchorY : 0;
        const baseX = this.offsetX + (npc.x + 0.5) * this.tileSize;
        const baseY = this.offsetY + (npc.y + 1) * this.tileSize;
        px = baseX - anchorX * width + offsetX;
        py = baseY - anchorY * height + offsetY;
      }

      if (sheet && this.drawSpriteSheetFrame(ctx, sheet, frameKey, px, py, width, height)) {
        return;
      }

      if (!sheet) {
        this.requestSpriteSheet(npc.spriteSheet, sheetOptions);
      }

      // Robust fallback for static/stubborn sprites that fail async cache
      if (!npc.__rawImage) {
        npc.__rawImage = new Image();
        npc.__rawImage.src = npc.spriteSheet;
      }
      if (npc.__rawImage.complete && npc.__rawImage.naturalWidth > 0) {
        const columns = sheetOptions?.columns || 3;
        const rows = sheetOptions?.rows || 4;
        const fw = Math.floor(npc.__rawImage.naturalWidth / columns);
        const fh = Math.floor(npc.__rawImage.naturalHeight / rows);

        // Approximate 'player_south_1' (Row 0, Col 1) for Guard/Lord facing South
        let col = 1; let row = 0;
        if (frameKey.includes('west')) row = 1;
        if (frameKey.includes('east')) row = 2;
        if (frameKey.includes('north')) row = 3;

        ctx.drawImage(npc.__rawImage, col * fw, row * fh, fw, fh, px, py, width, height);
        return;
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

  drawShip(ctx, px, py, width, height) {
    ctx.save();
    
    // Hull (Dark Wood with gradient)
    const hullGrad = ctx.createLinearGradient(px, py + height * 0.6, px, py + height);
    hullGrad.addColorStop(0, '#5a3c2e');
    hullGrad.addColorStop(1, '#2a1a10');
    ctx.fillStyle = hullGrad;
    
    ctx.beginPath();
    ctx.moveTo(px, py + height * 0.5); // Bow
    ctx.quadraticCurveTo(px + width * 0.5, py + height * 0.7, px + width, py + height * 0.5); // Stern
    ctx.lineTo(px + width * 0.85, py + height * 0.9);
    ctx.lineTo(px + width * 0.15, py + height * 0.9);
    ctx.closePath();
    ctx.fill();
    
    // Deck detail
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px + width * 0.2, py + height * 0.55, width * 0.6, height * 0.05);
    
    // Masts (Main and Fore)
    ctx.fillStyle = '#3d2516';
    ctx.fillRect(px + width * 0.47, py + height * 0.1, width * 0.06, height * 0.5);
    ctx.fillRect(px + width * 0.25, py + height * 0.2, width * 0.04, height * 0.4);
    
    // Sails (Cream with shadow)
    ctx.fillStyle = '#fdf5e6';
    // Main Sail
    ctx.beginPath();
    ctx.moveTo(px + width * 0.5, py + height * 0.15);
    ctx.quadraticCurveTo(px + width * 0.85, py + height * 0.3, px + width * 0.5, py + height * 0.45);
    ctx.fill();
    // Fore Sail
    ctx.fillStyle = '#ede4d5';
    ctx.beginPath();
    ctx.moveTo(px + width * 0.28, py + height * 0.25);
    ctx.quadraticCurveTo(px + width * 0.45, py + height * 0.35, px + width * 0.28, py + height * 0.45);
    ctx.fill();
    
    // Rigging (Subtle lines)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + width * 0.5, py + height * 0.15);
    ctx.lineTo(px + width * 0.15, py + height * 0.5);
    ctx.moveTo(px + width * 0.5, py + height * 0.15);
    ctx.lineTo(px + width * 0.85, py + height * 0.5);
    ctx.stroke();

    ctx.restore();
  }
}
