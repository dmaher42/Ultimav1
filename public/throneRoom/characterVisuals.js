import CoreRenderEngine from '../renderCore.js?v=2';
import { isCastleFloorType, isCarpetType } from './theme.js';

const SHEET_OPTIONS = Object.freeze({
  columns: 4,
  rows: 4,
  directions: ['south', 'west', 'east', 'north']
});

const CASTLE_CHARACTER_SKINS = Object.freeze({
  lord_british: {
    url: 'assets/sprites/lord_british_regal_sheet.svg?v=1',
    prefix: 'king',
    widthTiles: 1.42,
    heightTiles: 1.82,
    offsetTileX: 0.50,
    offsetTileY: -0.30,
    direction: 'south',
    role: 'sovereign',
    bob: 0.55,
    phase: 120,
    filter: 'brightness(1.04) contrast(1.08) saturate(1.08)'
  },
  guard_left: {
    url: 'assets/sprites/royal_sentinel_regal_sheet.svg?v=1',
    prefix: 'sentinel',
    widthTiles: 1.18,
    heightTiles: 1.72,
    offsetTileX: -0.18,
    offsetTileY: -1.15,
    direction: 'south',
    role: 'sentinel',
    bob: 0.18,
    phase: 460,
    filter: 'brightness(1.02) contrast(1.12) saturate(1.03)'
  },
  guard_right: {
    url: 'assets/sprites/royal_sentinel_regal_sheet.svg?v=1',
    prefix: 'sentinel',
    widthTiles: 1.18,
    heightTiles: 1.72,
    offsetTileX: 0.18,
    offsetTileY: -1.15,
    direction: 'south',
    role: 'sentinel',
    bob: 0.18,
    phase: 920,
    filter: 'brightness(1.02) contrast(1.12) saturate(1.03)'
  },
  royal_torch_guard: {
    url: 'assets/sprites/royal_torch_guard_regal_sheet.svg?v=1',
    prefix: 'torchguard',
    widthTiles: 1.12,
    heightTiles: 1.62,
    offsetTileX: -0.05,
    offsetTileY: -0.38,
    direction: 'south',
    role: 'torch',
    bob: 0.22,
    phase: 740,
    filter: 'brightness(1.04) contrast(1.10) saturate(1.05)'
  },
  castle_guard: {
    url: 'assets/sprites/royal_sentinel_regal_sheet.svg?v=1',
    prefix: 'sentinel',
    widthTiles: 1.16,
    heightTiles: 1.66,
    offsetTileX: 0,
    offsetTileY: -1.16,
    direction: 'south',
    role: 'sentinel',
    bob: 0.18,
    phase: 1320,
    filter: 'brightness(1.01) contrast(1.12) saturate(1.02)'
  }
});

function normaliseDirection(direction) {
  const value = String(direction || 'south').toLowerCase();
  return ['south', 'west', 'east', 'north'].includes(value) ? value : 'south';
}

function frameIndexForActor(skin) {
  const elapsed = performance.now() + (skin.phase || 0);
  const step = Math.floor(elapsed / 780) % 10;
  if (step === 2) return 0;
  if (step === 7) return 2;
  return 1;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
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

export const characterVisualsMethods = {
  getCastleCharacterSkin(npc) {
    if (this.map?.id !== 'castle' || !npc?.id) return null;
    return CASTLE_CHARACTER_SKINS[npc.id] || null;
  },

  getCastleCharacterFrame(npc, skin) {
    const direction = normaliseDirection(npc?.facing || skin?.direction);
    const frame = frameIndexForActor(skin);
    return `${skin.prefix}_${direction}_${frame}`;
  },

  getNpcSpritePlacement(npc) {
    const skin = this.getCastleCharacterSkin(npc);
    if (!skin) {
      return CoreRenderEngine.prototype.getNpcSpritePlacement.call(this, npc);
    }

    const ts = this.tileSize;
    const width = skin.widthTiles * ts;
    const height = skin.heightTiles * ts;
    const idle = Math.sin((performance.now() + skin.phase) * 0.0021) * skin.bob;
    const baseX = this.offsetX + (npc.x + 0.5 + skin.offsetTileX) * ts;
    const baseY = this.offsetY + (npc.y + 1 + skin.offsetTileY) * ts + idle;

    return {
      width,
      height,
      px: baseX - width * 0.5,
      py: baseY - height,
      baseX,
      baseY
    };
  },

  getPlayerSpritePlacement(player = this.player) {
    const placement = CoreRenderEngine.prototype.getPlayerSpritePlacement.call(this, player);
    if (!placement || this.map?.id !== 'castle') return placement;

    const scale = 1.16;
    const width = placement.width * scale;
    const height = placement.height * scale;
    const idle = this.isMoving ? 0 : Math.sin(performance.now() * 0.0024) * 0.42;
    const baseX = placement.baseX;
    const baseY = placement.baseY + idle;
    return {
      width,
      height,
      px: baseX - width * 0.5,
      py: baseY - height,
      baseX,
      baseY
    };
  },

  drawCastleCharacterPlate(ctx, placement, role = 'player') {
    const ts = this.tileSize;
    const { baseX, baseY, width } = placement;
    ctx.save();

    const shadow = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, Math.max(ts * 0.34, width * 0.46));
    shadow.addColorStop(0, 'rgba(3, 7, 13, 0.58)');
    shadow.addColorStop(0.62, 'rgba(3, 7, 13, 0.22)');
    shadow.addColorStop(1, 'rgba(3, 7, 13, 0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + ts * 0.02, Math.max(ts * 0.42, width * 0.40), ts * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();

    if (role === 'sovereign') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255, 218, 119, 0.32)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(baseX, baseY + ts * 0.01, ts * 0.70, ts * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (role === 'player') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(104, 177, 255, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(baseX, baseY + ts * 0.02, ts * 0.48, ts * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawOutlinedCharacterFrame(ctx, sheet, frameKey, placement, outlineWidth = 1.6) {
    const { px, py, width, height } = placement;
    const offsets = [
      [-outlineWidth, 0], [outlineWidth, 0], [0, -outlineWidth], [0, outlineWidth],
      [-outlineWidth, -outlineWidth], [outlineWidth, -outlineWidth],
      [-outlineWidth, outlineWidth], [outlineWidth, outlineWidth]
    ];

    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.filter = 'brightness(0) saturate(100%)';
    offsets.forEach(([dx, dy]) => {
      this.drawSpriteSheetFrame(ctx, sheet, frameKey, px + dx, py + dy, width, height);
    });
    ctx.restore();
  },

  drawCastleCharacterHighlight(ctx, npc, placement, skin) {
    const { baseX, py, width, height } = placement;
    const ts = this.tileSize;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (skin.role === 'sovereign') {
      const crownGlow = ctx.createRadialGradient(baseX, py + height * 0.15, 0, baseX, py + height * 0.15, ts * 0.56);
      crownGlow.addColorStop(0, 'rgba(255, 238, 160, 0.24)');
      crownGlow.addColorStop(1, 'rgba(255, 197, 74, 0)');
      ctx.fillStyle = crownGlow;
      ctx.fillRect(baseX - ts * 0.62, py, ts * 1.24, ts * 0.88);
      ctx.fillStyle = 'rgba(255, 249, 211, 0.82)';
      ctx.fillRect(baseX - 1, py + height * 0.075, 2, 5);
      ctx.fillRect(baseX - 4, py + height * 0.10, 8, 1);
    } else if (skin.role === 'torch') {
      const glowX = baseX - width * 0.30;
      const glowY = py + height * 0.38;
      const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, ts * 0.72);
      glow.addColorStop(0, 'rgba(255, 223, 130, 0.20)');
      glow.addColorStop(0.48, 'rgba(255, 135, 46, 0.08)');
      glow.addColorStop(1, 'rgba(255, 120, 36, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(glowX, glowY, ts * 0.72, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const side = npc.id === 'guard_left' ? -1 : 1;
      ctx.strokeStyle = 'rgba(238, 246, 255, 0.26)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX + side * width * 0.17, py + height * 0.20);
      ctx.lineTo(baseX + side * width * 0.28, py + height * 0.58);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawNearbyCharacterPrompt(ctx, npc, placement) {
    if (!this.player?.position || this.inCombat) return;
    const dx = this.player.position.x - npc.x;
    const dy = this.player.position.y - npc.y;
    if (Math.hypot(dx, dy) > 2.25) return;

    const label = `T  ${String(npc.name || 'Talk').toUpperCase()}`;
    ctx.save();
    ctx.font = '600 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(label).width;
    const width = textWidth + 18;
    const height = 22;
    const x = placement.baseX - width * 0.5;
    const y = placement.py - 25;

    drawRoundedRect(ctx, x, y, width, height, 7);
    ctx.fillStyle = 'rgba(5, 9, 17, 0.90)';
    ctx.fill();
    ctx.strokeStyle = npc.id === 'lord_british'
      ? 'rgba(239, 199, 100, 0.72)'
      : 'rgba(145, 181, 218, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#f3ead2';
    ctx.fillText(label, placement.baseX, y + height * 0.52);
    ctx.restore();
  },

  drawNPC(ctx, npc) {
    const skin = this.getCastleCharacterSkin(npc);
    if (!skin) {
      CoreRenderEngine.prototype.drawNPC.call(this, ctx, npc);
      return;
    }

    const options = { ...SHEET_OPTIONS, framePrefix: skin.prefix };
    const sheet = this.getSpriteSheetSync(skin.url, options);
    if (!sheet) {
      this.requestSpriteSheet(skin.url, options);
      CoreRenderEngine.prototype.drawNPC.call(this, ctx, npc);
      return;
    }

    const placement = this.getNpcSpritePlacement(npc);
    if (!placement) return;
    const frameKey = this.getCastleCharacterFrame(npc, skin);

    this.drawCastleCharacterPlate(ctx, placement, skin.role);
    this.drawRoyalNpcBacking(ctx, npc, placement);
    this.drawOutlinedCharacterFrame(ctx, sheet, frameKey, placement, skin.role === 'sovereign' ? 1.9 : 1.55);

    ctx.save();
    ctx.filter = skin.filter;
    ctx.shadowColor = skin.role === 'sovereign'
      ? 'rgba(255, 202, 92, 0.20)'
      : 'rgba(23, 45, 69, 0.22)';
    ctx.shadowBlur = skin.role === 'sovereign' ? 4 : 2;
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

    this.drawRoyalNpcAccent(ctx, npc, placement);
    this.drawCastleCharacterHighlight(ctx, npc, placement, skin);
    this.drawNearbyCharacterPrompt(ctx, npc, placement);
  },

  drawPlayer(ctx) {
    if (this.map?.id !== 'castle') {
      CoreRenderEngine.prototype.drawPlayer.call(this, ctx);
      return;
    }

    const placement = this.getPlayerSpritePlacement();
    const sheet = this.getPlayerSpriteSheetForState();
    if (!placement || !sheet) {
      CoreRenderEngine.prototype.drawPlayer.call(this, ctx);
      return;
    }

    const frameKey = this.playerAnim.frame() || 'player_champion_south_1';
    this.drawCastleCharacterPlate(ctx, placement, 'player');
    this.drawOutlinedCharacterFrame(ctx, sheet, frameKey, placement, 1.65);

    ctx.save();
    ctx.filter = 'brightness(1.04) contrast(1.09) saturate(1.05)';
    ctx.shadowColor = 'rgba(80, 145, 222, 0.18)';
    ctx.shadowBlur = 3;
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

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(197, 225, 255, 0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(placement.px + placement.width * 0.23, placement.py + placement.height * 0.20);
    ctx.lineTo(placement.px + placement.width * 0.18, placement.py + placement.height * 0.62);
    ctx.stroke();
    ctx.restore();
  },

  drawFloorReflections(ctx, grid, entities) {
    if (grid?.id !== 'castle') {
      CoreRenderEngine.prototype.drawFloorReflections.call(this, ctx, grid, entities);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      this.offsetX + this.tileSize * 2,
      this.offsetY + this.tileSize * 8.2,
      this.mapPixelWidth - this.tileSize * 4,
      this.mapPixelHeight - this.tileSize * 8.2
    );
    ctx.clip();

    entities.forEach((entity) => {
      if (entity.type !== 'player' && entity.type !== 'npc') return;
      const placement = entity.type === 'player'
        ? this.getPlayerSpritePlacement(entity.data)
        : this.getNpcSpritePlacement(entity.data);
      if (!placement) return;

      const tileX = Math.floor((placement.baseX - this.offsetX) / this.tileSize);
      const tileY = Math.floor((placement.baseY - this.offsetY) / this.tileSize);
      const raw = grid.tiles[tileY]?.[tileX];
      const tileType = grid.legend?.[raw] || raw;
      if (!isCastleFloorType(tileType) || isCarpetType(tileType)) return;

      let sheet = null;
      let frameKey = null;
      if (entity.type === 'player') {
        sheet = this.getPlayerSpriteSheetForState();
        frameKey = this.playerAnim.frame() || 'player_champion_south_1';
      } else {
        const skin = this.getCastleCharacterSkin(entity.data);
        if (!skin) return;
        const options = { ...SHEET_OPTIONS, framePrefix: skin.prefix };
        sheet = this.getSpriteSheetSync(skin.url, options);
        frameKey = this.getCastleCharacterFrame(entity.data, skin);
      }
      if (!sheet || !frameKey) return;

      ctx.save();
      ctx.globalAlpha = entity.type === 'player' ? 0.09 : 0.065;
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'blur(0.75px) brightness(0.88)';
      ctx.translate(placement.px + placement.width * 0.5, placement.baseY + 1);
      ctx.scale(1, -0.31);
      ctx.translate(-(placement.px + placement.width * 0.5), -(placement.baseY + 1));
      this.drawSpriteSheetFrame(
        ctx,
        sheet,
        frameKey,
        placement.px,
        placement.baseY - placement.height,
        placement.width,
        placement.height
      );
      ctx.restore();
    });

    ctx.restore();
  }
};
