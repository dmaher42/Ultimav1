import { TileInfo } from './GameMap.js';
import { DPR } from './renderer/canvas.js';
import { drawSprite } from './renderer/atlas.js';
import { vignette, colorGrade } from './renderer/postfx.js';

const TILE_SIZE = 48;
const BACKGROUND_COLOR = '#05070d';
const DIRECTION_KEYS = {
  south: 'south',
  west: 'west',
  east: 'east',
  north: 'north'
};

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
  const value = (direction || 'south').toString().toLowerCase();
  return DIRECTION_KEYS[value] ? value : 'south';
}

function playerFrameName(direction, frame) {
  const dir = normaliseDirection(direction);
  const index = Math.abs(frame) % 3;
  return `player_${dir}_${index}`;
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
    this.objectSignature = '';

    this.mapPixelWidth = 0;
    this.mapPixelHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.gridWidth = 0;
    this.gridHeight = 0;

    this.playerFrame = 1;
    this.animationTimer = 0;
    this.frameDuration = 130;
    this.activeDirections = new Set();
    this.isMoving = false;
    this.currentDirection = 'south';

    this.lastTimestamp = 0;
    this.running = false;
    this.assetsLoaded = false;

    this.atlas = null;
    this.particles = null;
    this.viewportWidth = Math.round(this.canvas.width / DPR);
    this.viewportHeight = Math.round(this.canvas.height / DPR);

    this._loop = this._loop.bind(this);
  }

  setAtlas(atlas) {
    this.atlas = atlas || null;
    this.assetsLoaded = Boolean(atlas?.img && atlas?.meta);
  }

  setParticles(emitter) {
    this.particles = emitter || null;
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

    if (this.particles) {
      this.particles.update(delta / 1000);
    }
  }

  draw() {
    if (!this.assetsLoaded) return;

    this.updateCanvasMetrics();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const grid = this.getMapGrid();
    if (grid) {
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
    }

    ctx.restore();

    if (grid) {
      ctx.save();
      vignette(ctx, this.viewportWidth, this.viewportHeight);
      colorGrade(ctx, undefined, this.viewportWidth, this.viewportHeight);
      ctx.restore();
    }

    this.drawHUD(ctx);
  }

  updateCanvasMetrics() {
    const width = Math.round((this.canvas.clientWidth || this.canvas.width / DPR));
    const height = Math.round((this.canvas.clientHeight || this.canvas.height / DPR));
    this.viewportWidth = width;
    this.viewportHeight = height;

    const grid = this.getMapGrid();
    if (!grid) return;

    this.mapPixelWidth = grid.width * this.tileSize;
    this.mapPixelHeight = grid.height * this.tileSize;
    this.offsetX = Math.floor((width - this.mapPixelWidth) / 2);
    this.offsetY = Math.floor((height - this.mapPixelHeight) / 2);
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
    const drawn = drawSprite(ctx, this.atlas, sprite, px, py, this.tileSize, this.tileSize);
    if (!drawn && fallbackColor) {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(px, py, this.tileSize, this.tileSize);
    }
    return drawn;
  }

  drawMap(ctx, grid) {
    const tiles = grid.tiles;
    for (let y = 0; y < grid.height; y += 1) {
      const row = tiles[y];
      if (!Array.isArray(row)) continue;
      for (let x = 0; x < grid.width; x += 1) {
        const tileType = row[x];
        const fallback = TileInfo[tileType]?.color;
        this.drawAtlasTile(ctx, tileType, x, y, fallback);
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
    if (!this.player || !this.atlas) return;
    const position = this.player.position;
    if (!position) return;
    const px = this.offsetX + position.x * this.tileSize;
    const py = this.offsetY + position.y * this.tileSize;
    const direction = this.player.facing || this.currentDirection;
    const frameKey = playerFrameName(direction, this.playerFrame);
    const drawn = drawSprite(ctx, this.atlas, frameKey, px, py, this.tileSize, this.tileSize);
    if (!drawn) {
      drawSprite(ctx, this.atlas, 'player_south_1', px, py, this.tileSize, this.tileSize);
    }
  }

  drawHUD(ctx) {
    if (!this.player) return;
    const padding = 12;
    const barHeight = 44;
    const availableWidth = Math.max(this.viewportWidth - padding * 2, 0);
    const barWidth = Math.min(Math.max(220, availableWidth), this.viewportWidth);
    const x = (this.viewportWidth - barWidth) / 2;
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
        this.currentDirection = normaliseDirection(player.facing);
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
