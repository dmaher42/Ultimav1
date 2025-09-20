import { TileInfo } from './GameMap.js';

const TILE_SIZE = 48;
const TILE_BASE_PATH = '/assets/tiles';
const DEFAULT_PLAYER_SPRITE = '/assets/sprites/player.png';
const BACKGROUND_COLOR = '#05070d';
const DIRECTION_TO_ROW = {
  south: 0,
  west: 1,
  east: 2,
  north: 3
};

const DEFAULT_TILE_MANIFEST = (() => {
  const manifest = { npc: 'npc.png' };
  Object.keys(TileInfo).forEach((type) => {
    manifest[type] = `${type}.png`;
  });
  return manifest;
})();

function resolveAssetPath(file, basePath = TILE_BASE_PATH) {
  if (!file) return '';
  if (/^([a-z]+:)?\/\//i.test(file) || file.startsWith('data:') || file.startsWith('/')) {
    return file;
  }
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  return `${base}/${file}`;
}

function createColorTile(color = '#555', size = TILE_SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, Math.round(size * 0.05));
  ctx.strokeRect(0, 0, size, size);
  return canvas;
}

function createPlayerPlaceholder(size = TILE_SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = size * 3;
  canvas.height = size * 4;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const palette = ['#f7d794', '#ffd166', '#f6c270', '#f5a962'];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = col * size;
      const y = row * size;
      ctx.fillStyle = '#1f1b24';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = palette[row % palette.length];
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.34 + (col === 1 ? size * 0.02 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = Math.max(1, Math.round(size * 0.06));
      ctx.strokeRect(x + size * 0.18, y + size * 0.2, size * 0.64, size * 0.64);
    }
  }
  return canvas;
}

function loadImageWithFallback(src, fallbackColor) {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.warn(`[Renderer] Failed to load image: ${src}`);
      resolve(createColorTile(fallbackColor));
    };
  });
}

function loadPlayerSprite(src, tileSize) {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.warn(`[Renderer] Failed to load player sprite: ${src}`);
      resolve(createPlayerPlaceholder(tileSize));
    };
  });
}

function computeSignature(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((item) => {
      const type = item?.sprite || item?.type || 'default';
      const frame = item?.frame ?? 0;
      return `${item?.x ?? 0}|${item?.y ?? 0}|${type}|${frame}`;
    })
    .join(';');
}

export function drawTile(ctx, assets, x, y, type, tileSize, fallbackColor, offsetX = 0, offsetY = 0) {
  const key = type ?? 'default';
  const image = assets.tiles[key] || assets.tiles.default;
  const px = offsetX + x * tileSize;
  const py = offsetY + y * tileSize;
  if (image) {
    ctx.drawImage(image, px, py, tileSize, tileSize);
  } else {
    ctx.fillStyle = fallbackColor || '#444';
    ctx.fillRect(px, py, tileSize, tileSize);
  }
}

export function drawPlayerSprite(ctx, spriteSheet, x, y, direction, frameIndex, tileSize) {
  if (!spriteSheet) return;
  const frameWidth = Math.floor(spriteSheet.width / 3);
  const frameHeight = Math.floor(spriteSheet.height / 4);
  const normalized = (direction || 'south').toLowerCase();
  const row = DIRECTION_TO_ROW[normalized] ?? DIRECTION_TO_ROW.south;
  const column = frameIndex % 3;
  const sx = column * frameWidth;
  const sy = row * frameHeight;
  ctx.drawImage(spriteSheet, sx, sy, frameWidth, frameHeight, x, y, tileSize, tileSize);
}

export default class RenderEngine {
  constructor(canvas, manifest = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.tileSize = TILE_SIZE;
    this.assets = { tiles: {} };
    this.manifest = manifest;

    this.map = null;
    this.player = null;
    this.highlight = null;
    this.highlightColor = '#ffe066';
    this.objects = [];
    this.npcs = [];
    this.objectSignature = '';

    this.mapPixelWidth = 0;
    this.mapPixelHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.gridWidth = 0;
    this.gridHeight = 0;

    this.playerSprite = null;
    this.playerFrame = 1;
    this.animationTimer = 0;
    this.frameDuration = 130;
    this.activeDirections = new Set();
    this.isMoving = false;
    this.currentDirection = 'south';

    this.lastTimestamp = 0;
    this.running = false;
    this.assetsLoaded = false;

    this._loop = this._loop.bind(this);
  }

  async preloadAssets(customManifest = {}) {
    const tileBase = customManifest.tileBasePath || this.manifest.tileBasePath || TILE_BASE_PATH;
    const tilesManifest = {
      ...DEFAULT_TILE_MANIFEST,
      ...(this.manifest.tiles || {}),
      ...(customManifest.tiles || {})
    };

    const tilePromises = Object.entries(tilesManifest).map(async ([type, file]) => {
      const fallback = TileInfo[type]?.color || '#444';
      const path = resolveAssetPath(file, tileBase);
      const image = await loadImageWithFallback(path, fallback);
      this.assets.tiles[type] = image;
    });

    const playerPath = customManifest.player || this.manifest.player || DEFAULT_PLAYER_SPRITE;
    const playerBase = customManifest.playerBasePath || this.manifest.playerBasePath || '/assets';
    const resolvedPlayer = resolveAssetPath(playerPath, playerBase);
    const playerPromise = loadPlayerSprite(resolvedPlayer, this.tileSize).then((sprite) => {
      this.playerSprite = sprite;
    });

    await Promise.all([...tilePromises, playerPromise]);

    if (!this.assets.tiles.default) {
      this.assets.tiles.default = this.assets.tiles.grass || createColorTile('#4a7852');
    }

    this.assetsLoaded = true;
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

    if (this.isMoving) {
      this.animationTimer += delta;
      if (this.animationTimer >= this.frameDuration) {
        this.playerFrame = (this.playerFrame + 1) % 3;
        this.animationTimer = 0;
      }
    } else if (this.playerFrame !== 1) {
      this.playerFrame = 1;
    }

    if (this.highlight?.expires && this.highlight.expires <= Date.now()) {
      this.highlight = null;
    }
  }

  draw() {
    if (!this.assetsLoaded) return;

    this.updateCanvasMetrics();

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const grid = this.getMapGrid();
    if (!grid) {
      ctx.restore();
      return;
    }

    this.drawMap(ctx, grid);
    this.drawObjects(ctx);
    this.drawNPCs(ctx);

    if (this.highlight) {
      this.drawHighlight(ctx, this.highlight);
    }

    this.drawPlayer(ctx);
    this.drawHUD(ctx);

    ctx.restore();
  }

  updateCanvasMetrics() {
    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.imageSmoothingEnabled = false;
    }

    const grid = this.getMapGrid();
    if (!grid) return;

    this.mapPixelWidth = grid.width * this.tileSize;
    this.mapPixelHeight = grid.height * this.tileSize;
    this.offsetX = Math.floor((this.canvas.width - this.mapPixelWidth) / 2);
    this.offsetY = Math.floor((this.canvas.height - this.mapPixelHeight) / 2);
  }

  getMapGrid(map = this.map) {
    if (!map) return null;

    let tiles = null;
    if (Array.isArray(map.tiles)) {
      tiles = map.tiles;
    } else if (Array.isArray(map)) {
      tiles = map;
    }

    if (!Array.isArray(tiles) || tiles.length === 0 || !Array.isArray(tiles[0])) {
      return null;
    }

    const height = typeof map.height === 'number' ? map.height : tiles.length;
    const width = typeof map.width === 'number' ? map.width : tiles[0]?.length || 0;
    if (!width || !height) return null;

    return {
      tiles,
      width,
      height,
      safe: Boolean(map.safe)
    };
  }

  drawMap(ctx, grid = this.getMapGrid()) {
    if (!grid) return;
    for (let y = 0; y < grid.height; y += 1) {
      const row = grid.tiles[y];
      if (!Array.isArray(row)) continue;
      for (let x = 0; x < grid.width; x += 1) {
        const tileType = row[x];
        const fallback = TileInfo[tileType]?.color;
        drawTile(ctx, this.assets, x, y, tileType, this.tileSize, fallback, this.offsetX, this.offsetY);
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
      const sprite = object?.sprite || object?.type || 'default';
      const color = object?.color || '#8c7853';
      if (typeof object?.draw === 'function') {
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        object.draw(ctx, {
          tileSize: this.tileSize,
          assets: this.assets,
          drawTile: (x, y, type) => drawTile(ctx, this.assets, x, y, type, this.tileSize, color)
        });
        ctx.restore();
      } else if (typeof object?.x === 'number' && typeof object?.y === 'number') {
        drawTile(ctx, this.assets, object.x, object.y, sprite, this.tileSize, color, this.offsetX, this.offsetY);
      }
    });
  }

  drawNPCs(ctx) {
    if (!this.npcs.length) return;
    this.npcs.forEach((npc) => {
      if (typeof npc?.x !== 'number' || typeof npc?.y !== 'number') return;
      const sprite = npc?.sprite || npc?.type || 'npc';
      const color = npc?.color || '#cfa658';
      drawTile(ctx, this.assets, npc.x, npc.y, sprite, this.tileSize, color, this.offsetX, this.offsetY);
    });
  }

  drawHighlight(ctx, highlight) {
    const px = this.offsetX + highlight.x * this.tileSize;
    const py = this.offsetY + highlight.y * this.tileSize;
    ctx.strokeStyle = highlight.color || this.highlightColor;
    ctx.lineWidth = Math.max(2, Math.round(this.tileSize * 0.06));
    ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
  }

  drawPlayer(ctx) {
    if (!this.player || !this.playerSprite) return;
    const px = this.offsetX + this.player.position.x * this.tileSize;
    const py = this.offsetY + this.player.position.y * this.tileSize;
    const direction = this.player.facing || this.currentDirection;
    drawPlayerSprite(ctx, this.playerSprite, px, py, direction, this.playerFrame, this.tileSize);
  }

  drawHUD(ctx) {
    if (!this.player) return;
    const padding = 12;
    const barHeight = 44;
    const availableWidth = Math.max(this.canvas.width - padding * 2, 0);
    const barWidth = Math.min(Math.max(220, availableWidth), this.canvas.width);
    const x = (this.canvas.width - barWidth) / 2;
    const y = padding;

    ctx.save();
    ctx.fillStyle = 'rgba(12, 12, 24, 0.75)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, barWidth - 1, barHeight - 1);

    ctx.fillStyle = '#f8f9ff';
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textBaseline = 'middle';

    const character = this.player.character;
    const currentHealth = Math.round(character?.currentHP ?? 0);
    const hasMax = Number.isFinite(character?.maxHP);
    const maxHealth = hasMax ? Math.round(character.maxHP) : currentHealth;
    const healthText = hasMax ? `Health: ${currentHealth}/${maxHealth}` : `Health: ${currentHealth}`;
    const coordsText = `x: ${this.player.position.x}, y: ${this.player.position.y}`;

    const textY = y + barHeight / 2;
    ctx.fillText(healthText, x + 16, textY);
    const coordsWidth = ctx.measureText(coordsText).width;
    ctx.fillText(coordsText, x + barWidth - 16 - coordsWidth, textY);
    ctx.restore();
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
      if (!this.isMoving && player.facing) {
        this.currentDirection = player.facing;
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
  }

  setPlayerMovement(direction, active) {
    if (!direction) return;
    const normalized = direction.toLowerCase();
    if (!DIRECTION_TO_ROW[normalized]) return;

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
        this.animationTimer = 0;
        this.playerFrame = 1;
      } else {
        const directions = Array.from(this.activeDirections);
        this.currentDirection = directions[directions.length - 1];
      }
    }
  }

  stopAllMovement() {
    this.activeDirections.clear();
    this.isMoving = false;
    this.animationTimer = 0;
    this.playerFrame = 1;
  }
}
