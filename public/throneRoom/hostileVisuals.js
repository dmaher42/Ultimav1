import { characterVisualsMethods } from './characterVisuals.js?v=2';
import { isThroneAmbushNpc } from '../ThroneRoomEnemies.js?v=1';

const VARIANT_STYLE = Object.freeze({
  vanguard: {
    filter: 'brightness(0.93) contrast(1.18) saturate(1.20)',
    glow: 'rgba(224, 64, 74, 0.24)',
    edge: 'rgba(255, 151, 126, 0.56)',
    label: '#ffb3a8'
  },
  skirmisher: {
    filter: 'brightness(0.90) contrast(1.20) saturate(1.08)',
    glow: 'rgba(237, 98, 48, 0.20)',
    edge: 'rgba(255, 178, 112, 0.50)',
    label: '#ffc18d'
  },
  seer: {
    filter: 'brightness(0.94) contrast(1.16) saturate(1.16) hue-rotate(14deg)',
    glow: 'rgba(175, 78, 204, 0.22)',
    edge: 'rgba(222, 157, 255, 0.52)',
    label: '#dfb6ff'
  }
});

function getStyle(npc) {
  return VARIANT_STYLE[npc?.visualVariant] || VARIANT_STYLE.vanguard;
}

function hostileFrameKey(npc, alerting = false) {
  let direction = String(npc?.facing || 'south').toLowerCase();
  if (direction === 'west') direction = 'east';
  if (!['south', 'east', 'north'].includes(direction)) direction = 'south';

  if (alerting) return `gargoyle_${direction}_3`;
  const phase = Number(npc?.visualPhase || 0);
  const sequence = [0, 1, 2, 1];
  const index = Math.floor((performance.now() + phase) / 260) % sequence.length;
  return `gargoyle_${direction}_${sequence[index]}`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const hostileVisualsMethods = {
  isThroneRoomHostile(npc) {
    return this.map?.id === 'castle' && isThroneAmbushNpc(npc);
  },

  isHostileAlertActive(npc = null) {
    const active = Number(this.hostileAlertUntil || 0) > performance.now();
    if (!active) return false;
    return !this.hostileAlertNpcId || !npc || this.hostileAlertNpcId === npc.id;
  },

  playHostileAlert(npc = null) {
    this.hostileAlertUntil = performance.now() + 720;
    this.hostileAlertNpcId = npc?.id || null;
    this.shakeCamera?.(3.5, 0.18);
  },

  playHostileDefeat() {
    this.hostileAlertUntil = 0;
    this.hostileAlertNpcId = null;
    this.shakeCamera?.(2.4, 0.14);
  },

  getHostileVisualPlacement(npc) {
    const placement = this.getNpcSpritePlacement(npc);
    if (!placement) return null;
    const phase = Number(npc?.visualPhase || 0);
    const hoverAmount = npc?.visualVariant === 'seer' ? 0.92 : 0.48;
    const hover = Math.sin((performance.now() + phase) * 0.0032) * hoverAmount;
    return {
      ...placement,
      py: placement.py + hover,
      baseY: placement.baseY + hover
    };
  },

  drawHostileGroundMark(ctx, npc, placement, style) {
    const ts = this.tileSize;
    const pulse = 0.88 + Math.sin((performance.now() + Number(npc.visualPhase || 0)) * 0.004) * 0.12;
    const radius = ts * (npc.visualVariant === 'vanguard' ? 0.72 : 0.61) * pulse;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(
      placement.baseX,
      placement.baseY,
      0,
      placement.baseX,
      placement.baseY,
      radius
    );
    glow.addColorStop(0, style.glow);
    glow.addColorStop(0.58, style.glow.replace(/0\.(\d+)\)/, '0.07)'));
    glow.addColorStop(1, 'rgba(255, 40, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(placement.baseX, placement.baseY + ts * 0.03, radius, radius * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = style.edge;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(placement.baseX, placement.baseY + ts * 0.03, radius * 0.74, radius * 0.19, 0, 0, Math.PI * 2);
    ctx.stroke();

    const markY = placement.baseY + ts * 0.03;
    ctx.beginPath();
    ctx.moveTo(placement.baseX - radius * 0.31, markY);
    ctx.lineTo(placement.baseX, markY - radius * 0.12);
    ctx.lineTo(placement.baseX + radius * 0.31, markY);
    ctx.moveTo(placement.baseX, markY - radius * 0.12);
    ctx.lineTo(placement.baseX, markY + radius * 0.12);
    ctx.stroke();
    ctx.restore();
  },

  drawHostileAccent(ctx, npc, placement, style, alerting) {
    const ts = this.tileSize;
    const eyeY = placement.py + placement.height * 0.22;
    const eyeSpread = placement.width * 0.12;
    const eyeRadius = alerting ? 4.4 : 3.0;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    [-1, 1].forEach((side) => {
      const eyeX = placement.baseX + side * eyeSpread;
      const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, eyeRadius * 2.5);
      eyeGlow.addColorStop(0, 'rgba(255, 246, 215, 0.95)');
      eyeGlow.addColorStop(0.34, style.edge);
      eyeGlow.addColorStop(1, 'rgba(255, 70, 55, 0)');
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    if (alerting) {
      ctx.strokeStyle = style.edge;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(placement.baseX, placement.py + placement.height * 0.45, ts * 0.84, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawNearbyHostilePrompt(ctx, npc, placement, style) {
    if (!this.player?.position) return;
    const dx = this.player.position.x - npc.x;
    const dy = this.player.position.y - npc.y;
    if (Math.hypot(dx, dy) > 2.75) return;

    const label = `T  ENGAGE  •  ${String(npc.name || 'HOSTILE').toUpperCase()}`;
    ctx.save();
    ctx.font = '700 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width + 18;
    const height = 22;
    const x = placement.baseX - width * 0.5;
    const y = placement.py - 27;

    roundedRect(ctx, x, y, width, height, 7);
    ctx.fillStyle = 'rgba(18, 5, 10, 0.93)';
    ctx.fill();
    ctx.strokeStyle = style.edge;
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.label;
    ctx.fillText(label, placement.baseX, y + height * 0.52);
    ctx.restore();
  },

  drawNPC(ctx, npc) {
    if (!this.isThroneRoomHostile(npc)) {
      characterVisualsMethods.drawNPC.call(this, ctx, npc);
      return;
    }

    const options = npc.spriteSheetOptions || {
      columns: 4,
      rows: 3,
      directions: ['south', 'east', 'north'],
      framePrefix: 'gargoyle'
    };
    const sheet = this.getSpriteSheetSync(npc.spriteSheet, options);
    if (!sheet) {
      this.requestSpriteSheet(npc.spriteSheet, options);
      characterVisualsMethods.drawNPC.call(this, ctx, npc);
      return;
    }

    const placement = this.getHostileVisualPlacement(npc);
    if (!placement) return;
    const style = getStyle(npc);
    const alerting = this.isHostileAlertActive(npc);
    const frameKey = hostileFrameKey(npc, alerting);

    this.drawHostileGroundMark(ctx, npc, placement, style);
    this.drawCastleCharacterPlate?.(ctx, placement, 'hostile');
    this.drawOutlinedCharacterFrame?.(ctx, sheet, frameKey, placement, alerting ? 2.5 : 2.0);

    ctx.save();
    ctx.filter = style.filter;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = alerting ? 9 : 4;
    this.drawSpriteSheetFrame(
      ctx,
      sheet,
      frameKey,
      placement.px,
      placement.py,
      placement.width,
      placement.height
    );
    ctx.restore();

    this.drawHostileAccent(ctx, npc, placement, style, alerting);
    this.drawNearbyHostilePrompt(ctx, npc, placement, style);
  }
};
