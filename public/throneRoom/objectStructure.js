import CoreRenderEngine from '../renderCore.js?v=2';
import { tileLoader } from '../renderer/tileloader.js';
import { CASTLE_PALETTE } from './theme.js';

export const objectStructureMethods = {
getCastleObjectPlacement(object) {
  const ts = this.tileSize;
  const sprite = object?.sprite || object?.type || 'default';
  const metadata = tileLoader.getTileMetadata(sprite) || {};
  const anchoredSprites = new Set([
    'throne',
    'pillar',
    'banner',
    'torch_wall',
    'royal_brazier',
    'royal_drapes',
    'royal_crest',
    'royal_plant'
  ]);
  const fallbackAnchor = anchoredSprites.has(sprite) ? [0.5, 1] : [0, 0];
  const metadataAnchor = Array.isArray(metadata.anchor) ? metadata.anchor : fallbackAnchor;
  const width = (Number.isFinite(object?.width) && object.width > 0 ? object.width : 1) * ts;
  const height = (Number.isFinite(object?.height) && object.height > 0 ? object.height : 1) * ts;
  const anchorX = Number.isFinite(object?.anchorX)
    ? object.anchorX
    : Number.isFinite(metadata.anchorX)
      ? metadata.anchorX
      : Number.isFinite(metadataAnchor[0]) ? metadataAnchor[0] : fallbackAnchor[0];
  const anchorY = Number.isFinite(object?.anchorY)
    ? object.anchorY
    : Number.isFinite(metadata.anchorY)
      ? metadata.anchorY
      : Number.isFinite(metadataAnchor[1]) ? metadataAnchor[1] : fallbackAnchor[1];
  const baseX = this.offsetX + (object.x + 0.5) * ts;
  const baseY = this.offsetY + (object.y + 1) * ts;
  return {
    sprite,
    width,
    height,
    baseX,
    baseY,
    px: baseX - anchorX * width,
    py: baseY - anchorY * height
  };
},

drawObject(ctx, object) {
  if (this.map?.id !== 'castle') {
    CoreRenderEngine.prototype.drawObject.call(this, ctx, object);
    return;
  }

  const placement = this.getCastleObjectPlacement(object);
  const { sprite, px, py, width, height } = placement;

  if (sprite === 'royal_drapes' || sprite === 'royal_crest') return;
  if (sprite === 'throne') {
    this.drawRoyalThrone(ctx, px, py, width, height);
    return;
  }
  if (sprite === 'pillar') {
    this.drawRoyalPillar(ctx, px, py, width, height);
    return;
  }
  if (sprite === 'banner') {
    this.drawRoyalBanner(ctx, px, py, width, height);
    return;
  }
  if (sprite === 'torch_wall') {
    this.drawRoyalTorch(ctx, px, py, width, height);
    return;
  }
  if (sprite === 'royal_brazier') {
    this.drawRoyalBrazier(ctx, px, py, width, height);
    return;
  }

  CoreRenderEngine.prototype.drawObject.call(this, ctx, object);
},

drawRoyalThrone(ctx, px, py, width, height) {
  const w = width;
  const h = height;
  const centerX = px + w * 0.5;
  const baseY = py + h * 0.90;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
  ctx.shadowBlur = Math.max(8, w * 0.08);
  ctx.shadowOffsetY = h * 0.04;

  const back = ctx.createLinearGradient(px, py, px + w, py);
  back.addColorStop(0, '#392013');
  back.addColorStop(0.15, CASTLE_PALETTE.goldDark);
  back.addColorStop(0.28, CASTLE_PALETTE.goldLight);
  back.addColorStop(0.50, '#8c662d');
  back.addColorStop(0.72, CASTLE_PALETTE.goldLight);
  back.addColorStop(0.85, CASTLE_PALETTE.goldDark);
  back.addColorStop(1, '#392013');

  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(px + w * 0.20, py + h * 0.18);
  ctx.lineTo(px + w * 0.30, py + h * 0.06);
  ctx.lineTo(px + w * 0.39, py + h * 0.12);
  ctx.lineTo(centerX, py);
  ctx.lineTo(px + w * 0.61, py + h * 0.12);
  ctx.lineTo(px + w * 0.70, py + h * 0.06);
  ctx.lineTo(px + w * 0.80, py + h * 0.18);
  ctx.lineTo(px + w * 0.79, py + h * 0.77);
  ctx.lineTo(px + w * 0.21, py + h * 0.77);
  ctx.closePath();
  ctx.fill();

  const velvet = ctx.createLinearGradient(px, py, px + w, py + h);
  velvet.addColorStop(0, '#5b1019');
  velvet.addColorStop(0.46, '#a52635');
  velvet.addColorStop(1, '#3d0a12');
  ctx.fillStyle = velvet;
  ctx.beginPath();
  ctx.moveTo(px + w * 0.31, py + h * 0.18);
  ctx.quadraticCurveTo(centerX, py + h * 0.09, px + w * 0.69, py + h * 0.18);
  ctx.lineTo(px + w * 0.67, py + h * 0.58);
  ctx.quadraticCurveTo(centerX, py + h * 0.66, px + w * 0.33, py + h * 0.58);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 237, 194, 0.15)';
  ctx.beginPath();
  ctx.moveTo(px + w * 0.37, py + h * 0.21);
  ctx.quadraticCurveTo(centerX, py + h * 0.15, px + w * 0.50, py + h * 0.18);
  ctx.lineTo(px + w * 0.48, py + h * 0.53);
  ctx.quadraticCurveTo(px + w * 0.40, py + h * 0.50, px + w * 0.37, py + h * 0.21);
  ctx.fill();

  ctx.fillStyle = '#4a2615';
  ctx.fillRect(px + w * 0.12, py + h * 0.48, w * 0.18, h * 0.31);
  ctx.fillRect(px + w * 0.70, py + h * 0.48, w * 0.18, h * 0.31);
  ctx.fillStyle = CASTLE_PALETTE.gold;
  ctx.fillRect(px + w * 0.09, py + h * 0.46, w * 0.24, h * 0.08);
  ctx.fillRect(px + w * 0.67, py + h * 0.46, w * 0.24, h * 0.08);

  ctx.fillStyle = '#6e1420';
  ctx.beginPath();
  ctx.moveTo(px + w * 0.27, py + h * 0.57);
  ctx.lineTo(px + w * 0.73, py + h * 0.57);
  ctx.lineTo(px + w * 0.68, py + h * 0.73);
  ctx.lineTo(px + w * 0.32, py + h * 0.73);
  ctx.closePath();
  ctx.fill();

  const base = ctx.createLinearGradient(0, py + h * 0.72, 0, baseY);
  base.addColorStop(0, '#b98a37');
  base.addColorStop(0.42, '#6a481e');
  base.addColorStop(1, '#2a1b10');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(px + w * 0.13, py + h * 0.72);
  ctx.lineTo(px + w * 0.87, py + h * 0.72);
  ctx.lineTo(px + w * 0.92, baseY);
  ctx.lineTo(px + w * 0.08, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = CASTLE_PALETTE.goldLight;
  ctx.lineWidth = Math.max(2, w * 0.018);
  ctx.strokeRect(px + w * 0.25, py + h * 0.15, w * 0.50, h * 0.49);

  this.drawVirtueSeal(ctx, centerX, py + h * 0.11, w * 0.07, 0.82);
  ctx.restore();
},

drawRoyalPillar(ctx, px, py, width, height) {
  const w = width;
  const h = height;
  const shaftX = px + w * 0.25;
  const shaftW = w * 0.50;
  const capH = h * 0.12;
  const baseH = h * 0.17;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
  ctx.shadowBlur = w * 0.20;
  ctx.shadowOffsetX = w * 0.10;
  ctx.shadowOffsetY = h * 0.03;

  ctx.fillStyle = '#262b33';
  ctx.fillRect(px + w * 0.08, py + h - baseH, w * 0.84, baseH);
  ctx.fillStyle = '#59616b';
  ctx.fillRect(px + w * 0.14, py + h - baseH * 1.16, w * 0.72, baseH * 0.30);

  const shaft = ctx.createLinearGradient(shaftX, 0, shaftX + shaftW, 0);
  shaft.addColorStop(0, '#555d68');
  shaft.addColorStop(0.18, '#a5a9ad');
  shaft.addColorStop(0.42, '#d1cec5');
  shaft.addColorStop(0.62, '#8f949a');
  shaft.addColorStop(1, '#414852');
  ctx.fillStyle = shaft;
  ctx.fillRect(shaftX, py + capH, shaftW, h - capH - baseH);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(32, 36, 43, 0.44)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const fx = shaftX + (shaftW * i) / 5;
    ctx.beginPath();
    ctx.moveTo(fx, py + capH + 2);
    ctx.lineTo(fx, py + h - baseH - 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#69727e';
  ctx.beginPath();
  ctx.moveTo(px + w * 0.10, py + capH);
  ctx.lineTo(px + w * 0.90, py + capH);
  ctx.lineTo(px + w * 0.78, py);
  ctx.lineTo(px + w * 0.22, py);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CASTLE_PALETTE.goldDark;
  ctx.fillRect(px + w * 0.10, py + capH * 0.75, w * 0.80, Math.max(2, h * 0.018));
  ctx.fillStyle = CASTLE_PALETTE.goldLight;
  ctx.fillRect(px + w * 0.14, py + capH * 0.75, w * 0.72, 1);

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(shaftX + shaftW * 0.25, py + capH + 2, shaftW * 0.08, h - capH - baseH - 4);
  ctx.restore();
}
};
