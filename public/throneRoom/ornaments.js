import { CASTLE_PALETTE } from './theme.js';

export const ornamentsMethods = {
drawRoseWindow(ctx, centerX, centerY, radius) {
  ctx.save();
  ctx.fillStyle = '#080d16';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.10, 0, Math.PI * 2);
  ctx.fill();

  const glass = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  glass.addColorStop(0, '#f6d77e');
  glass.addColorStop(0.32, '#a02b3d');
  glass.addColorStop(0.62, '#315e99');
  glass.addColorStop(1, '#122746');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#161a21';
  ctx.lineWidth = Math.max(2, radius * 0.10);
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(239, 204, 126, 0.70)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.04, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2.4);
  glow.addColorStop(0, 'rgba(116, 166, 230, 0.18)');
  glow.addColorStop(0.46, 'rgba(101, 137, 194, 0.055)');
  glow.addColorStop(1, 'rgba(101, 137, 194, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
},

drawStainedGlassWindow(ctx, centerX, topY, width, height, theme = 'blue') {
  const left = centerX - width * 0.5;
  const colors = theme === 'red'
    ? ['#5e1020', '#bb3b43', '#d8a046', '#263d68']
    : ['#112d55', '#2f67a1', '#d8a046', '#70243d'];

  ctx.save();
  ctx.fillStyle = '#070b12';
  ctx.beginPath();
  ctx.moveTo(left - width * 0.10, topY + height);
  ctx.lineTo(left - width * 0.10, topY + width * 0.55);
  ctx.quadraticCurveTo(centerX, topY - width * 0.30, left + width * 1.10, topY + width * 0.55);
  ctx.lineTo(left + width * 1.10, topY + height);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, topY + height);
  ctx.lineTo(left, topY + width * 0.58);
  ctx.quadraticCurveTo(centerX, topY - width * 0.12, left + width, topY + width * 0.58);
  ctx.lineTo(left + width, topY + height);
  ctx.closePath();
  ctx.clip();

  const paneH = height / 4;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.fillStyle = colors[(row + col) % colors.length];
      ctx.fillRect(left + col * width * 0.5, topY + row * paneH, width * 0.5, paneH);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(left + width * 0.15, topY, width * 0.14, height);

  ctx.strokeStyle = '#12161d';
  ctx.lineWidth = Math.max(1.5, width * 0.055);
  ctx.beginPath();
  ctx.moveTo(centerX, topY);
  ctx.lineTo(centerX, topY + height);
  for (let row = 1; row < 4; row += 1) {
    ctx.moveTo(left, topY + paneH * row);
    ctx.lineTo(left + width, topY + paneH * row);
  }
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(220, 190, 125, 0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, topY + height);
  ctx.lineTo(left, topY + width * 0.58);
  ctx.quadraticCurveTo(centerX, topY - width * 0.12, left + width, topY + width * 0.58);
  ctx.lineTo(left + width, topY + height);
  ctx.stroke();
  ctx.restore();
},

drawRoyalCurtain(ctx, x, y, width, height, direction) {
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, direction < 0 ? '#2c0710' : '#761322');
  gradient.addColorStop(0.35, '#9f1e30');
  gradient.addColorStop(0.64, '#53101b');
  gradient.addColorStop(1, direction < 0 ? '#761322' : '#2c0710');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width * (direction < 0 ? 0.86 : 0.14), y + height);
  ctx.lineTo(x + width * (direction < 0 ? 0.08 : 0.92), y + height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 202, 156, 0.12)';
  ctx.lineWidth = Math.max(1, width * 0.03);
  for (let i = 1; i < 4; i += 1) {
    const fx = x + (width * i) / 4;
    ctx.beginPath();
    ctx.moveTo(fx, y + 3);
    ctx.lineTo(fx + direction * width * 0.08, y + height - 3);
    ctx.stroke();
  }
},

drawVirtueSeal(ctx, centerX, centerY, radius, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(centerX, centerY);
  ctx.rotate(Math.PI / 8);

  ctx.fillStyle = CASTLE_PALETTE.goldDark;
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.48;
    const angle = (Math.PI * 2 * i) / 16;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = CASTLE_PALETTE.goldLight;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.31, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2612';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
},

drawCarpetMedallion(ctx, centerX, centerY, radius, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY);
  ctx.rotate(Math.PI / 4);

  ctx.strokeStyle = CASTLE_PALETTE.goldLight;
  ctx.lineWidth = Math.max(1, radius * 0.10);
  ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
  ctx.strokeStyle = 'rgba(255, 228, 157, 0.50)';
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.strokeRect(-radius * 0.58, -radius * 0.58, radius * 1.16, radius * 1.16);

  ctx.rotate(-Math.PI / 4);
  this.drawVirtueSeal(ctx, 0, 0, radius * 0.38, 0.85);
  ctx.restore();
}
};
