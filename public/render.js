import { TileInfo } from './GameMap.js';

const TILE_SIZE = 48;
const TILE_BASE_PATH = '/assets/tiles';
const PLAYER_SPRITE_PATH = '/assets/sprites/player.png';
const BACKGROUND_COLOR = '#05070d';
const DIRECTION_TO_ROW = {
  south: 0,
  west: 1,
  east: 2,
  north: 3
};

const DEFAULT_TILE_TYPES = ['grass', 'water', 'trees', 'path', 'wall', 'npc'];

function createColorTile(color = '#555', tileSize = TILE_SIZE) {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) {
    return null;
  }
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, tileSize, tileSize);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.08));
  ctx.strokeRect(0, 0, tileSize, tileSize);
  return canvas;
}

function createPlayerPlaceholder(tileSize = TILE_SIZE) {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) {
    return null;
  }
  canvas.width = tileSize * 3;
  canvas.height = tileSize * 4;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const palette = ['#f4d35e', '#ee964b', '#f95738', '#d52941'];
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = col * tileSize;
      const y = row * tileSize;
      ctx.fillStyle = palette[row % palette.length];
      ctx.fillRect(x + tileSize * 0.2, y + tileSize * 0.2, tileSize * 0.6, tileSize * 0.6);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x + tileSize * 0.32, y + tileSize * 0.1, tileSize * 0.36, tileSize * 0.3);
    }
  }
  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export function drawMap(ctx, tiles, tileSize, getTileImage, offsetX = 0, offsetY = 0) {
  if (!Array.isArray(tiles)) return;
  for (let y = 0; y < tiles.length; y += 1) {
    const row = tiles[y];
    if (!Array.isArray(row)) continue;
    for (let x = 0; x < row.length; x += 1) {
      const type = row[x] ?? 'default';
      const image = getTileImage(type);
      const px = offsetX + x * tileSize;
      const py = offsetY + y * tileSize;
      if (image) {
        ctx.drawImage(image, px, py, tileSize, tileSize);
      } else {
        ctx.fillStyle = TileInfo[type]?.color || '#545454';
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }
}

export function drawPlayer(ctx, spriteSheet, tileSize, position, direction, frameIndex, offsetX = 0, offsetY = 0) {
  if (!spriteSheet || !position) return;
  const normalized = (direction || 'south').toLowerCase();
  const row = DIRECTION_TO_ROW[normalized] ?? DIRECTION_TO_ROW.south;
  const column = frameIndex % 3;
  const frameWidth = Math.floor(spriteSheet.width / 3);
  const frameHeight = Math.floor(spriteSheet.height / 4);
  const sx = column * frameWidth;
  const sy = row * frameHeight;
  const dx = offsetX + position.x * tileSize;
  const dy = offsetY + position.y * tileSize;
  ctx.drawImage(spriteSheet, sx, sy, frameWidth, frameHeight, Math.round(dx), Math.round(dy), tileSize, tileSize);
}

export function drawHUD(ctx, canvasWidth, tileSize, health, maxHealth, coords) {
  const barHeight = Math.max(32, Math.floor(tileSize * 0.9));
  const padding = Math.floor(tileSize * 0.4);
  ctx.save();
  ctx.fillStyle = 'rgba(6, 8, 16, 0.72)';
  ctx.fillRect(0, 0, canvasWidth, barHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.floor(tileSize * 0.35)}px "Press Start 2P", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const healthValue = Number.isFinite(health) ? Math.max(0, health) : 0;
  const healthMax = Number.isFinite(maxHealth) ? Math.max(0, maxHealth) : null;
  const healthText = healthMax ? `Health: ${healthValue} / ${healthMax}` : `Health: ${healthValue}`;
  ctx.fillText(healthText, padding, barHeight / 2);
  ctx.textAlign = 'right';
  const x = Number.isFinite(coords?.x) ? coords.x : 0;
  const y = Number.isFinite(coords?.y) ? coords.y : 0;
  ctx.fillText(`x: ${x}, y: ${y}`, canvasWidth - padding, barHeight / 2);
  ctx.restore();
}

export default class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.tileSize = TILE_SIZE;
    this.tileImages = new Map();
    this.tilePromises = new Map();
    this.failedTileLoads = new Set();

    const defaultTile = createColorTile(TileInfo.grass?.color || '#4a7852', this.tileSize);
    if (defaultTile) {
      this.tileImages.set('default', defaultTile);
      this.tileImages.set('grass', defaultTile);
    }
    const npcTile = createColorTile('#cfa658', this.tileSize);
    if (npcTile) {
      this.tileImages.set('npc', npcTile);
    }

    this.playerSprite = null;

    this.mapRef = null;
    this.mapTiles = null;
    this.mapWidth = 0;
    this.mapHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.player = null;
    this.npcs = [];
    this.objects = [];
    this.highlight = null;

    this.currentDirection = 'south';
    this.activeDirections = new Set();
    this.isMoving = false;
    this.frameIndex = 1;
    this.frameTimer = 0;
    this.frameDuration = 150;

    this.lastTimestamp = 0;
    this.running = false;
    this.assetsReady = false;

    this._loop = this._loop.bind(this);
  }

  async preloadAssets(additionalTiles = []) {
    const manifest = new Set([...DEFAULT_TILE_TYPES, ...Object.keys(TileInfo), ...additionalTiles]);
    const tilePromises = Array.from(manifest).map((type) => this.ensureTileAsset(type));
    const playerPromise = loadImage(PLAYER_SPRITE_PATH)
      .then((image) => {
        this.playerSprite = image;
        return image;
      })
      .catch(() => {
        this.playerSprite = createPlayerPlaceholder(this.tileSize);
        return this.playerSprite;
      });
    await Promise.all([...tilePromises, playerPromise]);
    this.assetsReady = true;
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

  render(map, player, options = {}) {
    if (map !== this.mapRef) {
      this.cacheMap(map);
    }
    this.player = player || null;
    if (!this.isMoving && player?.facing) {
      this.currentDirection = player.facing.toLowerCase();
    }
    this.highlight = options.highlight || null;
    this.objects = Array.isArray(options.objects) ? options.objects.slice() : [];
    this.npcs = Array.isArray(options.npcs) ? options.npcs.slice() : [];

    this.objects.forEach((object) => {
      const sprite = object?.sprite || object?.type;
      if (sprite) this.ensureTileAsset(sprite);
    });
    this.npcs.forEach((npc) => {
      const sprite = npc?.sprite || npc?.type;
      if (sprite) this.ensureTileAsset(sprite);
    });
  }

  setPlayerMovement(direction, active) {
    if (!direction) return;
    const normalized = direction.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(DIRECTION_TO_ROW, normalized)) return;

    if (active) {
      if (!this.activeDirections.has(normalized)) {
        this.activeDirections.add(normalized);
      }
      this.isMoving = true;
      this.currentDirection = normalized;
    } else {
      if (this.activeDirections.has(normalized)) {
        this.activeDirections.delete(normalized);
      }
      if (this.activeDirections.size === 0) {
        this.isMoving = false;
        this.frameTimer = 0;
        this.frameIndex = 1;
      } else {
        const recent = Array.from(this.activeDirections);
        this.currentDirection = recent[recent.length - 1];
      }
    }
  }

  stopAllMovement() {
    this.activeDirections.clear();
    this.isMoving = false;
    this.frameTimer = 0;
    this.frameIndex = 1;
  }

  ensureTileAsset(type) {
    const key = type || 'default';
    if (key === 'default') {
      return Promise.resolve(this.tileImages.get('default'));
    }
    if (this.tileImages.has(key) && !this.tilePromises.has(key)) {
      return Promise.resolve(this.tileImages.get(key));
    }
    if (this.failedTileLoads.has(key)) {
      return Promise.resolve(this.tileImages.get(key));
    }
    if (!this.tileImages.has(key)) {
      const fallback = createColorTile(TileInfo[key]?.color || '#555', this.tileSize);
      if (fallback) {
        this.tileImages.set(key, fallback);
      }
    }
    if (this.tilePromises.has(key)) {
      return this.tilePromises.get(key);
    }
    const src = `${TILE_BASE_PATH}/${key}.png`;
    const promise = loadImage(src)
      .then((image) => {
        this.tileImages.set(key, image);
        return image;
      })
      .catch(() => {
        this.failedTileLoads.add(key);
        return this.tileImages.get(key);
      })
      .finally(() => {
        this.tilePromises.delete(key);
      });
    this.tilePromises.set(key, promise);
    return promise;
  }

  cacheMap(map) {
    this.mapRef = map || null;
    if (!map) {
      this.mapTiles = null;
      this.mapWidth = 0;
      this.mapHeight = 0;
      return;
    }
    const tiles = Array.isArray(map?.tiles) ? map.tiles : Array.isArray(map) ? map : null;
    if (!tiles) {
      this.mapTiles = null;
      this.mapWidth = 0;
      this.mapHeight = 0;
      return;
    }
    this.mapTiles = tiles;
    this.mapHeight = tiles.length;
    this.mapWidth = tiles[0]?.length || 0;
    const uniqueTiles = new Set();
    tiles.forEach((row) => {
      if (!Array.isArray(row)) return;
      row.forEach((type) => {
        if (type) uniqueTiles.add(type);
      });
    });
    uniqueTiles.forEach((type) => this.ensureTileAsset(type));
  }

  update(delta) {
    if (!this.player) return;
    if (this.isMoving) {
      this.frameTimer += delta;
      if (this.frameTimer >= this.frameDuration) {
        this.frameTimer = 0;
        this.frameIndex = (this.frameIndex + 1) % 3;
      }
    } else if (this.frameIndex !== 1) {
      this.frameIndex = 1;
      this.frameTimer = 0;
    }
    if (!this.isMoving && this.player?.facing) {
      this.currentDirection = this.player.facing.toLowerCase();
    }
  }

  updateCanvasSize() {
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    if (width && height && (this.canvas.width !== width || this.canvas.height !== height)) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  computeOffsets() {
    if (!this.mapTiles) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    const pixelWidth = this.mapWidth * this.tileSize;
    const pixelHeight = this.mapHeight * this.tileSize;
    this.offsetX = Math.floor((this.canvas.width - pixelWidth) / 2);
    this.offsetY = Math.floor((this.canvas.height - pixelHeight) / 2);
  }

  getTileImage(type) {
    const key = type || 'default';
    if (!this.tileImages.has(key)) {
      const fallback = createColorTile(TileInfo[key]?.color || '#555', this.tileSize);
      if (fallback) {
        this.tileImages.set(key, fallback);
      }
      this.ensureTileAsset(key);
    }
    return this.tileImages.get(key) || this.tileImages.get('default');
  }

  drawTile(ctx, x, y, type, fallbackColor) {
    const px = this.offsetX + x * this.tileSize;
    const py = this.offsetY + y * this.tileSize;
    const image = this.getTileImage(type);
    if (image) {
      ctx.drawImage(image, px, py, this.tileSize, this.tileSize);
    } else {
      ctx.fillStyle = fallbackColor || TileInfo[type]?.color || '#6b7280';
      ctx.fillRect(px, py, this.tileSize, this.tileSize);
    }
  }

  drawHighlight(ctx) {
    if (!this.highlight || !this.mapTiles) return;
    const { x, y } = this.highlight;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const px = this.offsetX + x * this.tileSize;
    const py = this.offsetY + y * this.tileSize;
    ctx.save();
    ctx.lineWidth = Math.max(2, Math.floor(this.tileSize * 0.1));
    ctx.strokeStyle = this.highlight.color || 'rgba(255, 238, 88, 0.85)';
    ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
    ctx.restore();
  }

  drawObjectsLayer(ctx) {
    if (!this.objects.length) return;
    this.objects.forEach((object) => {
      if (typeof object?.draw === 'function') {
        object.draw(ctx, {
          tileSize: this.tileSize,
          offsetX: this.offsetX,
          offsetY: this.offsetY,
          drawTile: (x, y, type) => this.drawTile(ctx, x, y, type)
        });
        return;
      }
      if (!Number.isFinite(object?.x) || !Number.isFinite(object?.y)) return;
      const sprite = object?.sprite || object?.type || 'default';
      this.drawTile(ctx, object.x, object.y, sprite, object?.color);
    });
  }

  drawNPCsLayer(ctx) {
    if (!this.npcs.length) return;
    this.npcs.forEach((npc) => {
      if (!Number.isFinite(npc?.x) || !Number.isFinite(npc?.y)) return;
      const sprite = npc?.sprite || npc?.type || 'npc';
      this.drawTile(ctx, npc.x, npc.y, sprite, npc?.color);
    });
  }

  drawPlayerLayer(ctx) {
    if (!this.player || !this.playerSprite || !this.mapTiles) return;
    const direction = this.currentDirection || this.player.facing || 'south';
    const frame = this.isMoving ? this.frameIndex : 1;
    drawPlayer(ctx, this.playerSprite, this.tileSize, this.player.position, direction, frame, this.offsetX, this.offsetY);
  }

  drawHudLayer(ctx) {
    if (!this.player || !this.player.character) return;
    const { character, position } = this.player;
    drawHUD(ctx, this.canvas.width, this.tileSize, character.currentHP, character.maxHP, position);
  }

  updateFrame(timestamp) {
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.update(delta);
    this.draw();
  }

  draw() {
    if (!this.assetsReady) return;
    this.updateCanvasSize();
    this.computeOffsets();

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.mapTiles) {
      drawMap(ctx, this.mapTiles, this.tileSize, (type) => this.getTileImage(type), this.offsetX, this.offsetY);
      this.drawHighlight(ctx);
      this.drawObjectsLayer(ctx);
      this.drawNPCsLayer(ctx);
    }

    this.drawPlayerLayer(ctx);
    this.drawHudLayer(ctx);

    ctx.restore();
  }

  _loop(timestamp) {
    if (!this.running) return;
    this.updateFrame(timestamp);
    requestAnimationFrame(this._loop);
  }
}
