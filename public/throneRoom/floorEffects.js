import { vignette, colorGrade } from '../renderer/postfx.js';
import { CASTLE_PALETTE, clamp } from './theme.js';

export const floorEffectsMethods = {
drawCastleCarpetOverlay(ctx) {
  const ts = this.tileSize;
  const centerX = this.offsetX + 15 * ts;
  const topY = this.offsetY + 8.15 * ts;
  const bottomY = this.offsetY + 18.18 * ts;
  const topHalf = ts * 1.42;
  const bottomHalf = ts * 2.02;

  const runnerPath = new Path2D();
  runnerPath.moveTo(centerX - topHalf, topY);
  runnerPath.lineTo(centerX + topHalf, topY);
  runnerPath.lineTo(centerX + bottomHalf, bottomY);
  runnerPath.lineTo(centerX - bottomHalf, bottomY);
  runnerPath.closePath();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = ts * 0.32;
  ctx.shadowOffsetY = ts * 0.12;
  ctx.fillStyle = '#251016';
  ctx.fill(runnerPath);
  ctx.restore();

  ctx.save();
  ctx.clip(runnerPath);

  const carpet = ctx.createLinearGradient(0, topY, 0, bottomY);
  carpet.addColorStop(0, CASTLE_PALETTE.crimsonDark);
  carpet.addColorStop(0.36, CASTLE_PALETTE.crimson);
  carpet.addColorStop(0.72, '#7b1321');
  carpet.addColorStop(1, '#4d0c16');
  ctx.fillStyle = carpet;
  ctx.fillRect(centerX - bottomHalf, topY, bottomHalf * 2, bottomY - topY);

  const centralSheen = ctx.createLinearGradient(centerX - bottomHalf, 0, centerX + bottomHalf, 0);
  centralSheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
  centralSheen.addColorStop(0.44, 'rgba(255, 224, 218, 0.07)');
  centralSheen.addColorStop(0.56, 'rgba(255, 224, 218, 0.09)');
  centralSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = centralSheen;
  ctx.fillRect(centerX - bottomHalf, topY, bottomHalf * 2, bottomY - topY);

  const time = Date.now() * 0.0006;
  for (let y = topY + ts * 0.72, index = 0; y < bottomY - ts * 0.40; y += ts * 1.54, index += 1) {
    const progress = clamp((y - topY) / (bottomY - topY));
    const widthScale = 0.72 + progress * 0.32;
    const drift = Math.sin(time + index * 0.5) * 0.35;
    this.drawCarpetMedallion(ctx, centerX, y + drift, ts * 0.46 * widthScale, 0.40 + progress * 0.16);
  }

  ctx.restore();

  ctx.save();
  ctx.strokeStyle = CASTLE_PALETTE.goldDark;
  ctx.lineWidth = ts * 0.18;
  ctx.stroke(runnerPath);
  ctx.strokeStyle = CASTLE_PALETTE.goldLight;
  ctx.lineWidth = 2.2;
  ctx.stroke(runnerPath);

  const innerPath = new Path2D();
  innerPath.moveTo(centerX - topHalf + ts * 0.25, topY + ts * 0.10);
  innerPath.lineTo(centerX + topHalf - ts * 0.25, topY + ts * 0.10);
  innerPath.lineTo(centerX + bottomHalf - ts * 0.28, bottomY - ts * 0.10);
  innerPath.lineTo(centerX - bottomHalf + ts * 0.28, bottomY - ts * 0.10);
  innerPath.closePath();
  ctx.strokeStyle = 'rgba(245, 207, 120, 0.72)';
  ctx.lineWidth = 1.6;
  ctx.stroke(innerPath);
  ctx.restore();
},

drawCastleFloorDetailPass(ctx) {
  const ts = this.tileSize;
  const centerX = this.offsetX + 15 * ts;
  const topY = this.offsetY + 8.3 * ts;
  const bottomY = this.offsetY + 18.1 * ts;

  ctx.save();

  const inlaySets = [
    { left: 3.1, right: 11.7 },
    { left: 18.3, right: 26.9 }
  ];
  inlaySets.forEach((set) => {
    const x1 = this.offsetX + set.left * ts;
    const x2 = this.offsetX + set.right * ts;
    ctx.strokeStyle = 'rgba(20, 23, 30, 0.42)';
    ctx.lineWidth = 5;
    ctx.strokeRect(x1, topY, x2 - x1, bottomY - topY);
    ctx.strokeStyle = 'rgba(207, 166, 86, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x1 + 3, topY + 3, x2 - x1 - 6, bottomY - topY - 6);
  });

  ctx.globalCompositeOperation = 'screen';
  const windowPools = [
    { x: 7.0, y: 10.7, angle: -0.18 },
    { x: 23.0, y: 10.7, angle: 0.18 }
  ];
  windowPools.forEach((pool) => {
    const x = this.offsetX + pool.x * ts;
    const y = this.offsetY + pool.y * ts;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(pool.angle);
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, ts * 4.3);
    light.addColorStop(0, 'rgba(111, 166, 226, 0.11)');
    light.addColorStop(0.45, 'rgba(90, 132, 190, 0.045)');
    light.addColorStop(1, 'rgba(90, 132, 190, 0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(0, 0, ts * 3.3, ts * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const centerSheen = ctx.createLinearGradient(centerX - ts * 4, 0, centerX + ts * 4, 0);
  centerSheen.addColorStop(0, 'rgba(255,255,255,0)');
  centerSheen.addColorStop(0.5, 'rgba(255, 236, 203, 0.045)');
  centerSheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = centerSheen;
  ctx.fillRect(centerX - ts * 4, topY, ts * 8, bottomY - topY);

  ctx.restore();
},

drawCastleForegroundFrame(ctx) {
  const ts = this.tileSize;
  const left = this.offsetX + ts * 1.55;
  const right = this.offsetX + this.mapPixelWidth - ts * 1.55;
  const bottom = this.offsetY + this.mapPixelHeight;

  ctx.save();
  const leftShade = ctx.createLinearGradient(left, 0, left + ts * 2.5, 0);
  leftShade.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
  leftShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = leftShade;
  ctx.fillRect(left, this.offsetY + ts * 1.2, ts * 2.5, this.mapPixelHeight - ts * 1.2);

  const rightShade = ctx.createLinearGradient(right, 0, right - ts * 2.5, 0);
  rightShade.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
  rightShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rightShade;
  ctx.fillRect(right - ts * 2.5, this.offsetY + ts * 1.2, ts * 2.5, this.mapPixelHeight - ts * 1.2);

  const bottomShade = ctx.createLinearGradient(0, bottom - ts * 1.8, 0, bottom);
  bottomShade.addColorStop(0, 'rgba(0,0,0,0)');
  bottomShade.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = bottomShade;
  ctx.fillRect(this.offsetX, bottom - ts * 1.8, this.mapPixelWidth, ts * 1.8);
  ctx.restore();
},

drawCastleScreenAtmosphere(ctx) {
  const width = this.viewportWidth;
  const height = this.viewportHeight;
  const time = Date.now() * 0.0007;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const coolBeam = ctx.createLinearGradient(width * 0.12, 0, width * 0.62, height);
  coolBeam.addColorStop(0, 'rgba(164, 202, 244, 0.11)');
  coolBeam.addColorStop(0.44, 'rgba(116, 162, 215, 0.035)');
  coolBeam.addColorStop(1, 'rgba(116, 162, 215, 0)');
  ctx.fillStyle = coolBeam;
  ctx.beginPath();
  ctx.moveTo(width * 0.18, 0);
  ctx.lineTo(width * 0.38, 0);
  ctx.lineTo(width * (0.72 + Math.sin(time) * 0.01), height);
  ctx.lineTo(width * 0.50, height);
  ctx.closePath();
  ctx.fill();

  const warmFocus = ctx.createRadialGradient(
    width * 0.5,
    height * 0.31,
    0,
    width * 0.5,
    height * 0.31,
    Math.max(width, height) * 0.34
  );
  warmFocus.addColorStop(0, 'rgba(255, 221, 151, 0.09)');
  warmFocus.addColorStop(0.46, 'rgba(255, 179, 72, 0.025)');
  warmFocus.addColorStop(1, 'rgba(255, 179, 72, 0)');
  ctx.fillStyle = warmFocus;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  const upperShade = ctx.createLinearGradient(0, 0, 0, height);
  upperShade.addColorStop(0, 'rgba(2, 5, 10, 0.24)');
  upperShade.addColorStop(0.28, 'rgba(2, 5, 10, 0.03)');
  upperShade.addColorStop(1, 'rgba(2, 5, 10, 0.08)');
  ctx.fillStyle = upperShade;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  vignette(ctx, width, height, 0.28);
  colorGrade(ctx, 'rgba(41, 49, 68, 0.075)', width, height);
},

updateCastleParticles() {
  if (!this.particles || Math.random() > 0.035) return;
  const ts = this.tileSize;
  const centerX = this.offsetX + 15 * ts;
  const topY = this.offsetY + 2.4 * ts;
  this.particles.spawn(
    centerX + (Math.random() - 0.5) * ts * 12,
    topY + Math.random() * ts * 8,
    {
      vx: (Math.random() - 0.5) * 3.5,
      vy: -1.2 - Math.random() * 2.2,
      life: 2.8 + Math.random() * 2.4,
      size: 0.65 + Math.random() * 0.85,
      color: 'rgba(232, 225, 201, 0.22)'
    }
  );
}
};
