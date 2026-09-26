import { CASTLE_PALETTE } from './theme.js';

export const architectureMethods = {
drawCastleThroneRoomStage(ctx) {
  const ts = this.tileSize;
  const centerX = this.offsetX + 15 * ts;
  const top = this.offsetY + 1.1 * ts;
  const apseBottom = this.offsetY + 8.35 * ts;
  const hallLeft = this.offsetX + 2 * ts;
  const hallRight = this.offsetX + 28 * ts;

  ctx.save();

  const wallShade = ctx.createLinearGradient(0, top, 0, apseBottom);
  wallShade.addColorStop(0, 'rgba(10, 14, 22, 0.44)');
  wallShade.addColorStop(0.58, 'rgba(20, 22, 27, 0.13)');
  wallShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = wallShade;
  ctx.fillRect(hallLeft, top, hallRight - hallLeft, apseBottom - top + ts);

  this.drawCastleUpperFrieze(ctx, hallLeft, hallRight, top);
  this.drawThroneApse(ctx, centerX, top, apseBottom);
  this.drawCastleSideNiches(ctx, hallLeft, hallRight, top);
  this.drawCastleDais(ctx, centerX);

  ctx.restore();
},

drawCastleUpperFrieze(ctx, left, right, top) {
  const ts = this.tileSize;
  const bandY = top + ts * 0.25;
  const bandH = ts * 0.78;
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  band.addColorStop(0, '#454d59');
  band.addColorStop(0.46, '#2b323c');
  band.addColorStop(1, '#1d222a');
  ctx.fillStyle = band;
  ctx.fillRect(left, bandY, right - left, bandH);

  ctx.fillStyle = CASTLE_PALETTE.goldDark;
  ctx.fillRect(left, bandY + bandH * 0.16, right - left, 3);
  ctx.fillStyle = 'rgba(242, 212, 139, 0.42)';
  ctx.fillRect(left, bandY + bandH * 0.16, right - left, 1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.fillRect(left, bandY + bandH * 0.82, right - left, 4);

  const sealGap = ts * 2.2;
  for (let x = left + ts * 1.1; x < right - ts; x += sealGap) {
    this.drawVirtueSeal(ctx, x, bandY + bandH * 0.50, ts * 0.24, 0.22);
  }
},

drawThroneApse(ctx, centerX, top, bottom) {
  const ts = this.tileSize;
  const outerW = ts * 9.8;
  const innerW = ts * 7.6;
  const archTop = top + ts * 0.65;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
  ctx.shadowBlur = ts * 0.55;
  ctx.shadowOffsetY = ts * 0.28;
  ctx.fillStyle = '#151a22';
  ctx.beginPath();
  ctx.moveTo(centerX - outerW * 0.5, bottom);
  ctx.lineTo(centerX - outerW * 0.5, archTop + ts * 2.6);
  ctx.bezierCurveTo(
    centerX - outerW * 0.48,
    archTop - ts * 0.15,
    centerX - outerW * 0.24,
    archTop - ts * 0.68,
    centerX,
    archTop - ts * 0.68
  );
  ctx.bezierCurveTo(
    centerX + outerW * 0.24,
    archTop - ts * 0.68,
    centerX + outerW * 0.48,
    archTop - ts * 0.15,
    centerX + outerW * 0.5,
    archTop + ts * 2.6
  );
  ctx.lineTo(centerX + outerW * 0.5, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const stone = ctx.createLinearGradient(centerX - outerW * 0.5, 0, centerX + outerW * 0.5, 0);
  stone.addColorStop(0, '#2b323d');
  stone.addColorStop(0.18, '#5b6571');
  stone.addColorStop(0.5, '#343b46');
  stone.addColorStop(0.82, '#5b6571');
  stone.addColorStop(1, '#2b323d');
  ctx.strokeStyle = stone;
  ctx.lineWidth = ts * 0.36;
  ctx.beginPath();
  ctx.moveTo(centerX - outerW * 0.5, bottom);
  ctx.lineTo(centerX - outerW * 0.5, archTop + ts * 2.55);
  ctx.bezierCurveTo(
    centerX - outerW * 0.46,
    archTop,
    centerX - outerW * 0.22,
    archTop - ts * 0.42,
    centerX,
    archTop - ts * 0.42
  );
  ctx.bezierCurveTo(
    centerX + outerW * 0.22,
    archTop - ts * 0.42,
    centerX + outerW * 0.46,
    archTop,
    centerX + outerW * 0.5,
    archTop + ts * 2.55
  );
  ctx.lineTo(centerX + outerW * 0.5, bottom);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(242, 212, 139, 0.48)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const interior = ctx.createLinearGradient(0, archTop, 0, bottom);
  interior.addColorStop(0, '#121a29');
  interior.addColorStop(0.48, '#1d2430');
  interior.addColorStop(1, '#0b0e14');
  ctx.fillStyle = interior;
  ctx.fillRect(centerX - innerW * 0.5, archTop + ts * 1.05, innerW, bottom - archTop - ts * 1.05);

  this.drawRoseWindow(ctx, centerX, archTop + ts * 0.72, ts * 1.02);
  this.drawStainedGlassWindow(ctx, centerX - ts * 2.9, archTop + ts * 2.05, ts * 1.28, ts * 3.0, 'blue');
  this.drawStainedGlassWindow(ctx, centerX + ts * 2.9, archTop + ts * 2.05, ts * 1.28, ts * 3.0, 'red');

  const curtainTop = archTop + ts * 1.92;
  const curtainBottom = bottom - ts * 0.16;
  this.drawRoyalCurtain(ctx, centerX - ts * 2.12, curtainTop, ts * 1.42, curtainBottom - curtainTop, -1);
  this.drawRoyalCurtain(ctx, centerX + ts * 0.70, curtainTop, ts * 1.42, curtainBottom - curtainTop, 1);

  ctx.fillStyle = CASTLE_PALETTE.goldDark;
  ctx.fillRect(centerX - ts * 2.20, curtainTop - 4, ts * 4.40, 5);
  ctx.fillStyle = CASTLE_PALETTE.goldLight;
  ctx.fillRect(centerX - ts * 2.20, curtainTop - 4, ts * 4.40, 1);

  this.drawVirtueSeal(ctx, centerX, bottom - ts * 0.78, ts * 0.52, 0.42);
},

drawCastleSideNiches(ctx, hallLeft, hallRight, top) {
  const ts = this.tileSize;
  const nicheY = top + ts * 2.3;
  const positions = [hallLeft + ts * 2.7, hallRight - ts * 2.7];

  positions.forEach((x, index) => {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 9, 14, 0.62)';
    ctx.beginPath();
    ctx.moveTo(x - ts * 1.15, nicheY + ts * 3.9);
    ctx.lineTo(x - ts * 1.15, nicheY + ts * 1.25);
    ctx.quadraticCurveTo(x, nicheY - ts * 0.45, x + ts * 1.15, nicheY + ts * 1.25);
    ctx.lineTo(x + ts * 1.15, nicheY + ts * 3.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(112, 124, 140, 0.42)';
    ctx.lineWidth = ts * 0.16;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235, 205, 134, 0.23)';
    ctx.lineWidth = 2;
    ctx.stroke();

    this.drawStainedGlassWindow(
      ctx,
      x,
      nicheY + ts * 0.75,
      ts * 0.92,
      ts * 2.35,
      index === 0 ? 'red' : 'blue'
    );
    ctx.restore();
  });
},

drawCastleDais(ctx, centerX) {
  const ts = this.tileSize;
  const topY = this.offsetY + 6.10 * ts;
  const bottomY = this.offsetY + 9.36 * ts;

  const shadow = ctx.createRadialGradient(centerX, bottomY, 0, centerX, bottomY, ts * 5.6);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.43)');
  shadow.addColorStop(0.64, 'rgba(0, 0, 0, 0.14)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(centerX - ts * 6, topY, ts * 12, ts * 4.2);

  const tiers = [
    { y: bottomY - ts * 0.10, half: 5.10, depth: 0.58, top: '#675b4f', face: '#302820' },
    { y: bottomY - ts * 0.64, half: 4.42, depth: 0.54, top: '#827463', face: '#41362b' },
    { y: bottomY - ts * 1.16, half: 3.72, depth: 0.52, top: '#a3957f', face: '#544638' }
  ];

  tiers.forEach((tier, index) => {
    const y = tier.y;
    const half = tier.half * ts;
    const depth = tier.depth * ts;
    const taper = ts * (0.44 + index * 0.06);

    const topGrad = ctx.createLinearGradient(0, y - depth, 0, y);
    topGrad.addColorStop(0, index === 2 ? '#b8ab94' : tier.top);
    topGrad.addColorStop(1, tier.top);
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo(centerX - half + taper, y - depth);
    ctx.lineTo(centerX + half - taper, y - depth);
    ctx.lineTo(centerX + half, y);
    ctx.lineTo(centerX - half, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = tier.face;
    ctx.beginPath();
    ctx.moveTo(centerX - half, y);
    ctx.lineTo(centerX + half, y);
    ctx.lineTo(centerX + half - ts * 0.18, y + ts * 0.22);
    ctx.lineTo(centerX - half + ts * 0.18, y + ts * 0.22);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = index === 2
      ? 'rgba(244, 218, 157, 0.58)'
      : 'rgba(215, 183, 121, 0.30)';
    ctx.lineWidth = index === 2 ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.moveTo(centerX - half + taper, y - depth + 1);
    ctx.lineTo(centerX + half - taper, y - depth + 1);
    ctx.stroke();
  });

  const thronePool = ctx.createRadialGradient(
    centerX,
    this.offsetY + 6.10 * ts,
    0,
    centerX,
    this.offsetY + 6.10 * ts,
    ts * 4.3
  );
  thronePool.addColorStop(0, 'rgba(255, 220, 135, 0.16)');
  thronePool.addColorStop(0.44, 'rgba(255, 181, 72, 0.05)');
  thronePool.addColorStop(1, 'rgba(255, 181, 72, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = thronePool;
  ctx.fillRect(centerX - ts * 4.5, this.offsetY + ts * 3.8, ts * 9, ts * 5.4);
  ctx.restore();
}
};
