import { TileInfo } from './GameMap.js';

function lighten(color, amount = 0.2) {
  const canvas = lighten.canvas || (lighten.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.height = 1;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const r = Math.min(255, Math.round(data[0] + (255 - data[0]) * amount));
  const g = Math.min(255, Math.round(data[1] + (255 - data[1]) * amount));
  const b = Math.min(255, Math.round(data[2] + (255 - data[2]) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export default class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 32;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  calculateTileSize(map) {
    const tileWidth = Math.floor(this.canvas.width / map.width);
    const tileHeight = Math.floor(this.canvas.height / map.height);
    this.tileSize = Math.min(tileWidth, tileHeight);
    this.offsetX = Math.floor((this.canvas.width - map.width * this.tileSize) / 2);
    this.offsetY = Math.floor((this.canvas.height - map.height * this.tileSize) / 2);
  }

  clear() {
    this.ctx.fillStyle = '#05070d';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(map, player, options = {}) {
    this.calculateTileSize(map);
    this.clear();
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const tile = map.getTile(x, y);
        const def = TileInfo[tile] || TileInfo.grass;
        let color = def.color || '#444';
        if (map.safe) {
          color = lighten(color, 0.1);
        }
        this.drawTile(x, y, color);
      }
    }
    if (options.highlight) {
      this.drawHighlight(options.highlight.x, options.highlight.y, '#ffe066');
    }
    if (player) {
      this.drawPlayer(player.position.x, player.position.y, player.facing || 'south');
    }
  }

  drawTile(x, y, color) {
    const px = this.offsetX + x * this.tileSize;
    const py = this.offsetY + y * this.tileSize;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
    this.ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);
  }

  drawHighlight(x, y, color) {
    const px = this.offsetX + x * this.tileSize;
    const py = this.offsetY + y * this.tileSize;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
  }

  drawPlayer(x, y) {
    const px = this.offsetX + x * this.tileSize + this.tileSize / 2;
    const py = this.offsetY + y * this.tileSize + this.tileSize / 2;
    const radius = this.tileSize * 0.35;
    this.ctx.fillStyle = '#ffd166';
    this.ctx.beginPath();
    this.ctx.arc(px, py, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#5a3';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  tileAtScreen(x, y) {
    const tileX = Math.floor((x - this.offsetX) / this.tileSize);
    const tileY = Math.floor((y - this.offsetY) / this.tileSize);
    return { x: tileX, y: tileY };
  }
}
