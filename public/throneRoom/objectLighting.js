import CoreRenderEngine from '../renderCore.js?v=2';
import { CASTLE_PALETTE } from './theme.js';

export const objectLightingMethods = {
drawRoyalBanner(ctx, px, py, width, height) {
  const w = width;
  const h = height;
  ctx.save();

  ctx.fillStyle = '#1b120b';
  ctx.fillRect(px + w * 0.46, py, Math.max(2, w * 0.08), h * 0.94);
  ctx.fillStyle = CASTLE_PALETTE.gold;
  ctx.fillRect(px + w * 0.12, py + h * 0.08, w * 0.76, Math.max(3, h * 0.035));

  const cloth = ctx.createLinearGradient(px, py, px + w, py + h);
  cloth.addColorStop(0, CASTLE_PALETTE.royalBlueLight);
  cloth.addColorStop(0.35, CASTLE_PALETTE.royalBlue);
  cloth.addColorStop(1, CASTLE_PALETTE.royalBlueDark);
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(px + w * 0.16, py + h * 0.12);
  ctx.lineTo(px + w * 0.84, py + h * 0.12);
  ctx.lineTo(px + w * 0.80, py + h * 0.72);
  ctx.lineTo(px + w * 0.50, py + h * 0.93);
  ctx.lineTo(px + w * 0.20, py + h * 0.72);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = CASTLE_PALETTE.goldLight;
  ctx.lineWidth = Math.max(1.5, w * 0.05);
  ctx.stroke();
  this.drawVirtueSeal(ctx, px + w * 0.50, py + h * 0.42, w * 0.18, 0.90);

  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(px + w * 0.24, py + h * 0.18);
  ctx.lineTo(px + w * 0.36, py + h * 0.18);
  ctx.lineTo(px + w * 0.31, py + h * 0.68);
  ctx.lineTo(px + w * 0.24, py + h * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
},

drawRoyalTorch(ctx, px, py, width, height) {
  const w = width;
  const h = height;
  const time = Date.now() * 0.008;
  const flicker = Math.sin(time + px * 0.013) * h * 0.025;

  ctx.save();
  ctx.fillStyle = '#16100b';
  ctx.fillRect(px + w * 0.44, py + h * 0.24, w * 0.12, h * 0.68);
  ctx.fillStyle = CASTLE_PALETTE.goldDark;
  ctx.fillRect(px + w * 0.20, py + h * 0.27, w * 0.60, h * 0.14);
  ctx.fillStyle = CASTLE_PALETTE.gold;
  ctx.fillRect(px + w * 0.32, py + h * 0.17, w * 0.36, h * 0.15);

  this.drawFlame(ctx, px + w * 0.50, py + h * 0.16, w * 0.25, h * 0.30 + flicker);
  ctx.restore();
},

drawRoyalBrazier(ctx, px, py, width, height) {
  const w = width;
  const h = height;
  const time = Date.now() * 0.007;
  const flicker = Math.sin(time + px * 0.019) * h * 0.025;

  ctx.save();
  ctx.fillStyle = '#17120e';
  ctx.fillRect(px + w * 0.43, py + h * 0.46, w * 0.14, h * 0.42);
  ctx.fillStyle = '#33261a';
  ctx.fillRect(px + w * 0.28, py + h * 0.84, w * 0.44, h * 0.09);

  const bowl = ctx.createLinearGradient(px, py, px + w, py);
  bowl.addColorStop(0, '#493015');
  bowl.addColorStop(0.5, '#d19a3e');
  bowl.addColorStop(1, '#493015');
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(px + w * 0.12, py + h * 0.38);
  ctx.quadraticCurveTo(px + w * 0.50, py + h * 0.62, px + w * 0.88, py + h * 0.38);
  ctx.lineTo(px + w * 0.78, py + h * 0.52);
  ctx.quadraticCurveTo(px + w * 0.50, py + h * 0.68, px + w * 0.22, py + h * 0.52);
  ctx.closePath();
  ctx.fill();

  this.drawFlame(ctx, px + w * 0.50, py + h * 0.36, w * 0.30, h * 0.42 + flicker);
  ctx.restore();
},

drawFlame(ctx, centerX, baseY, halfWidth, height) {
  const flame = ctx.createLinearGradient(0, baseY - height, 0, baseY);
  flame.addColorStop(0, 'rgba(255, 255, 224, 0.96)');
  flame.addColorStop(0.36, CASTLE_PALETTE.flameHot);
  flame.addColorStop(0.72, '#ff9f43');
  flame.addColorStop(1, 'rgba(166, 40, 20, 0.20)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(centerX, baseY - height);
  ctx.bezierCurveTo(
    centerX + halfWidth * 1.1,
    baseY - height * 0.58,
    centerX + halfWidth,
    baseY - height * 0.14,
    centerX,
    baseY
  );
  ctx.bezierCurveTo(
    centerX - halfWidth,
    baseY - height * 0.14,
    centerX - halfWidth * 1.0,
    baseY - height * 0.55,
    centerX,
    baseY - height
  );
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,235,0.88)';
  ctx.beginPath();
  ctx.ellipse(centerX, baseY - height * 0.28, halfWidth * 0.26, height * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
},

drawTorchLight(ctx, torch) {
  if (this.map?.id !== 'castle') {
    CoreRenderEngine.prototype.drawTorchLight.call(this, ctx, torch);
    return;
  }
  const ts = this.tileSize;
  const tx = this.offsetX + (torch.x + 0.5) * ts;
  const ty = this.offsetY + (torch.y + (torch.sprite === 'royal_brazier' ? 0.35 : 0.28)) * ts;
  const time = Date.now() * 0.004;
  const flicker = 0.94 + Math.sin(time + torch.x * 1.9) * 0.07;
  const radius = ts * (torch.sprite === 'royal_brazier' ? 2.9 : 2.25) * flicker;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius);
  glow.addColorStop(0, 'rgba(255, 232, 168, 0.24)');
  glow.addColorStop(0.20, 'rgba(255, 166, 66, 0.15)');
  glow.addColorStop(0.58, 'rgba(255, 106, 35, 0.045)');
  glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(tx, ty, radius, 0, Math.PI * 2);
  ctx.fill();

  const pool = ctx.createRadialGradient(tx, ty + ts * 0.85, 0, tx, ty + ts * 0.85, radius * 0.90);
  pool.addColorStop(0, 'rgba(255, 188, 91, 0.08)');
  pool.addColorStop(0.55, 'rgba(255, 128, 40, 0.02)');
  pool.addColorStop(1, 'rgba(255, 128, 40, 0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(tx, ty + ts * 0.82, radius * 0.72, radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
},

drawSoftShadowForEntity(ctx, entity) {
  if (this.map?.id !== 'castle') {
    CoreRenderEngine.prototype.drawSoftShadowForEntity.call(this, ctx, entity);
    return;
  }

  const data = entity.data;
  if (data?.shadow === false || data?.sprite === 'banner' || data?.sprite === 'royal_drapes' || data?.sprite === 'royal_crest') {
    return;
  }

  const ts = this.tileSize;
  let centerX;
  let baseY;
  let width = ts * 0.82;
  let height = ts * 0.20;
  let opacity = 0.30;

  if (entity.type === 'player') {
    const placement = this.getPlayerSpritePlacement(data);
    centerX = placement?.baseX;
    baseY = placement?.baseY;
  } else if (entity.type === 'npc') {
    const placement = this.getNpcSpritePlacement(data);
    centerX = placement?.baseX;
    baseY = placement?.baseY;
    width = data.stageRole === 'throne_sentinel' ? ts * 1.14 : ts * 0.94;
    opacity = data.stageRole ? 0.38 : 0.28;
  } else {
    const placement = this.getCastleObjectPlacement(data);
    centerX = placement.baseX;
    baseY = placement.baseY;
    width = Math.max(ts * 0.72, placement.width * 0.62);
    height = Math.max(ts * 0.18, placement.height * 0.08);
    if (placement.sprite === 'throne') {
      width = ts * 3.0;
      height = ts * 0.30;
      opacity = 0.46;
    }
    if (placement.sprite === 'pillar') opacity = 0.42;
  }

  if (!Number.isFinite(centerX) || !Number.isFinite(baseY)) return;

  ctx.save();
  ctx.fillStyle = `rgba(4, 5, 8, ${opacity})`;
  ctx.filter = 'blur(1.5px)';
  ctx.beginPath();
  ctx.ellipse(centerX + ts * 0.10, baseY - height * 0.12, width * 0.5, height, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'none';
  ctx.restore();
}
};
