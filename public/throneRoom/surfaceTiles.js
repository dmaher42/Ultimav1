import CoreRenderEngine from '../renderCore.js?v=2';
import { TileInfo } from '../GameMap.js';
import { CASTLE_PALETTE, hash2D, isCastleFloorType, isCarpetType } from './theme.js';

export const surfaceTilesMethods = {
drawMap(ctx, grid) {
  if (grid?.id !== 'castle') {
    CoreRenderEngine.prototype.drawMap.call(this, ctx, grid);
    return;
  }

  const ts = this.tileSize;
  for (let y = 0; y < grid.height; y += 1) {
    const row = grid.tiles[y];
    if (!row) continue;
    for (let x = 0; x < grid.width; x += 1) {
      const raw = row[x];
      const tileType = grid.legend?.[raw] || raw;
      if (!tileType || tileType === 'none') continue;

      const px = this.offsetX + x * ts;
      const py = this.offsetY + y * ts;

      if (String(tileType).includes('wall')) {
        this.drawCastleStoneTile(ctx, px, py, x, y, tileType);
      } else if (isCastleFloorType(tileType)) {
        this.drawCastleMarbleTile(ctx, px, py, x, y, tileType);
      } else if (isCarpetType(tileType)) {
        this.drawCastleCarpetBaseTile(ctx, px, py, x, y, tileType);
      } else if (tileType === 'castle_door') {
        this.drawCastleDoorTile(ctx, px, py, x, y);
      } else {
        const fallback = TileInfo[tileType]?.color || '#4b4e56';
        this.drawAtlasTile(ctx, tileType, x, y, fallback);
      }
    }
  }
},

drawCastleBackdrop(ctx) {
  const width = this.viewportWidth;
  const height = this.viewportHeight;

  ctx.fillStyle = CASTLE_PALETTE.void;
  ctx.fillRect(0, 0, width, height);

  const upperGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.10,
    0,
    width * 0.5,
    height * 0.10,
    Math.max(width, height) * 0.72
  );
  upperGlow.addColorStop(0, 'rgba(79, 91, 112, 0.42)');
  upperGlow.addColorStop(0.42, 'rgba(30, 35, 48, 0.24)');
  upperGlow.addColorStop(1, 'rgba(5, 7, 13, 0)');
  ctx.fillStyle = upperGlow;
  ctx.fillRect(0, 0, width, height);

  const floorGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.76,
    0,
    width * 0.5,
    height * 0.76,
    Math.max(width, height) * 0.55
  );
  floorGlow.addColorStop(0, 'rgba(132, 92, 48, 0.16)');
  floorGlow.addColorStop(0.5, 'rgba(54, 39, 34, 0.07)');
  floorGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = floorGlow;
  ctx.fillRect(0, 0, width, height);

  const mapX = this.offsetX;
  const mapY = this.offsetY;
  const mapW = this.mapPixelWidth;
  const mapH = this.mapPixelHeight;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.86)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(mapX - 12, mapY - 12, mapW + 24, mapH + 24);
  ctx.restore();

  ctx.strokeStyle = 'rgba(207, 173, 101, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX - 5.5, mapY - 5.5, mapW + 11, mapH + 11);
  ctx.strokeStyle = 'rgba(255, 244, 215, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX - 2.5, mapY - 2.5, mapW + 5, mapH + 5);
},

drawCastleStoneTile(ctx, px, py, x, y, tileType) {
  const ts = this.tileSize;
  const seed = hash2D(x, y, 3);
  const top = seed > 0.55 ? '#404956' : '#39424e';
  const bottom = seed > 0.55 ? '#252c35' : '#2a313b';
  const gradient = ctx.createLinearGradient(px, py, px, py + ts);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(px, py, ts, ts);

  const courseOffset = y % 2 === 0 ? 0 : ts * 0.5;
  ctx.strokeStyle = CASTLE_PALETTE.mortar;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(px, py + ts * 0.5);
  ctx.lineTo(px + ts, py + ts * 0.5);
  ctx.moveTo(px + courseOffset, py);
  ctx.lineTo(px + courseOffset, py + ts * 0.5);
  ctx.moveTo(px + ((courseOffset + ts * 0.5) % ts), py + ts * 0.5);
  ctx.lineTo(px + ((courseOffset + ts * 0.5) % ts), py + ts);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(225, 232, 239, 0.09)';
  ctx.beginPath();
  ctx.moveTo(px + 1, py + 1);
  ctx.lineTo(px + ts - 1, py + 1);
  ctx.stroke();

  if (seed > 0.76) {
    ctx.strokeStyle = 'rgba(12, 14, 18, 0.28)';
    ctx.beginPath();
    ctx.moveTo(px + ts * 0.18, py + ts * 0.22);
    ctx.lineTo(px + ts * 0.33, py + ts * 0.36);
    ctx.lineTo(px + ts * 0.28, py + ts * 0.52);
    ctx.stroke();
  }

  if (tileType === 'marble_wall') {
    ctx.fillStyle = 'rgba(208, 214, 220, 0.035)';
    ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
  }
},

drawCastleMarbleTile(ctx, px, py, x, y, tileType) {
  const ts = this.tileSize;
  const seed = hash2D(x, y, 17);
  const isDais = tileType === 'dais_floor';
  const isEdge = tileType === 'marble_edge';

  const top = isDais
    ? '#a69a87'
    : isEdge
      ? '#5b5e66'
      : seed > 0.52 ? '#777a82' : '#6d7079';
  const bottom = isDais
    ? '#7f7464'
    : isEdge
      ? '#3e424a'
      : seed > 0.52 ? '#60636c' : '#595d66';

  const gradient = ctx.createLinearGradient(px, py, px + ts * 0.32, py + ts);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(px, py, ts, ts);

  const slabX = x % 2 === 0;
  const slabY = y % 2 === 0;
  ctx.strokeStyle = isDais
    ? 'rgba(56, 43, 30, 0.34)'
    : 'rgba(25, 29, 36, 0.38)';
  ctx.lineWidth = slabX || slabY ? 1.35 : 0.7;
  ctx.beginPath();
  if (slabX) {
    ctx.moveTo(px + 0.5, py);
    ctx.lineTo(px + 0.5, py + ts);
  }
  if (slabY) {
    ctx.moveTo(px, py + 0.5);
    ctx.lineTo(px + ts, py + 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = isDais
    ? 'rgba(255, 244, 218, 0.15)'
    : 'rgba(245, 248, 255, 0.09)';
  ctx.beginPath();
  ctx.moveTo(px + 2, py + 2);
  ctx.lineTo(px + ts - 2, py + 2);
  ctx.stroke();

  const vein = hash2D(x, y, 41);
  if (!isEdge && vein > 0.38) {
    const direction = hash2D(x, y, 57) > 0.5 ? 1 : -1;
    ctx.strokeStyle = isDais
      ? 'rgba(88, 67, 49, 0.23)'
      : 'rgba(35, 39, 47, 0.27)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (direction > 0) {
      ctx.moveTo(px + ts * 0.08, py + ts * 0.72);
      ctx.bezierCurveTo(
        px + ts * 0.30,
        py + ts * 0.52,
        px + ts * 0.61,
        py + ts * 0.58,
        px + ts * 0.92,
        py + ts * 0.24
      );
    } else {
      ctx.moveTo(px + ts * 0.08, py + ts * 0.24);
      ctx.bezierCurveTo(
        px + ts * 0.35,
        py + ts * 0.44,
        px + ts * 0.60,
        py + ts * 0.34,
        px + ts * 0.92,
        py + ts * 0.78
      );
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.translate(0, 1);
    ctx.stroke();
    ctx.translate(0, -1);
  }

  if (isEdge) {
    ctx.fillStyle = 'rgba(211, 175, 94, 0.10)';
    ctx.fillRect(px + ts * 0.42, py, ts * 0.16, ts);
  }
},

drawCastleCarpetBaseTile(ctx, px, py, x, y) {
  const ts = this.tileSize;
  const gradient = ctx.createLinearGradient(px, py, px + ts, py + ts);
  gradient.addColorStop(0, '#4f0d17');
  gradient.addColorStop(1, '#2b0910');
  ctx.fillStyle = gradient;
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
  if ((x + y) % 2 === 0) {
    ctx.fillStyle = 'rgba(205, 158, 74, 0.035)';
    ctx.fillRect(px + ts * 0.44, py, ts * 0.12, ts);
  }
},

drawCastleDoorTile(ctx, px, py, x, y) {
  const ts = this.tileSize;
  const wood = ctx.createLinearGradient(px, py, px + ts, py);
  wood.addColorStop(0, '#241610');
  wood.addColorStop(0.5, '#54331f');
  wood.addColorStop(1, '#21130d');
  ctx.fillStyle = wood;
  ctx.fillRect(px, py, ts, ts);

  ctx.strokeStyle = 'rgba(8, 7, 6, 0.55)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(px + (ts * i) / 4, py);
    ctx.lineTo(px + (ts * i) / 4, py + ts);
    ctx.stroke();
  }
  ctx.fillStyle = '#816231';
  ctx.fillRect(px, py + ts * 0.16, ts, ts * 0.08);
  ctx.fillRect(px, py + ts * 0.76, ts, ts * 0.08);
  ctx.fillStyle = '#d1a452';
  ctx.fillRect(px + ts * 0.76, py + ts * 0.48, 3, 3);

  if ((x + y) % 2 === 0) {
    ctx.fillStyle = 'rgba(255, 234, 180, 0.05)';
    ctx.fillRect(px + 2, py + 2, ts * 0.20, ts - 4);
  }
}
};
