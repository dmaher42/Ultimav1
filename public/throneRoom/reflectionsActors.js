import CoreRenderEngine from '../renderCore.js';
import { isCastleFloorType, isCarpetType } from './theme.js';

export const reflectionsActorsMethods = {
drawFloorReflections(ctx, grid, entities) {
  if (grid?.id !== 'castle') {
    CoreRenderEngine.prototype.drawFloorReflections.call(this, ctx, grid, entities);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(this.offsetX + this.tileSize * 2, this.offsetY + this.tileSize * 8.2, this.mapPixelWidth - this.tileSize * 4, this.mapPixelHeight - this.tileSize * 8.2);
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

    const { px, baseY, width, height } = placement;
    ctx.save();
    ctx.globalAlpha = entity.type === 'player' ? 0.085 : 0.065;
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(0.8px)';
    ctx.translate(px + width * 0.5, baseY + 1);
    ctx.scale(1, -0.34);
    ctx.translate(-(px + width * 0.5), -(baseY + 1));

    if (entity.type === 'player') {
      const frameKey = this.playerAnim.frame() || 'player_south_1';
      const sheet = this.getPlayerSpriteSheetForState();
      if (sheet) {
        this.drawSpriteSheetFrame(ctx, sheet, frameKey, px, baseY - height, width, height);
      }
    } else if (entity.data.spriteSheet) {
      const sheetOptions = this.getNpcSpriteSheetOptions(entity.data);
      const sheet = this.getSpriteSheetSync(entity.data.spriteSheet, sheetOptions);
      if (sheet) {
        this.drawSpriteSheetFrame(
          ctx,
          sheet,
          entity.data.spriteFrame || 'player_south_1',
          px,
          baseY - height,
          width,
          height
        );
      }
    }
    ctx.restore();
  });

  ctx.restore();
},

drawRoyalNpcBacking(ctx, npc, placement) {
  if (!this.isRoyalThroneActor(npc)) return;
  const ts = this.tileSize;
  const { baseX, baseY, py, height } = placement;

  ctx.save();
  if (npc.stageRole === 'sovereign') {
    ctx.globalCompositeOperation = 'screen';
    const halo = ctx.createRadialGradient(baseX, py + height * 0.40, 0, baseX, py + height * 0.40, ts * 1.18);
    halo.addColorStop(0, 'rgba(255, 237, 178, 0.18)');
    halo.addColorStop(0.54, 'rgba(255, 195, 89, 0.045)');
    halo.addColorStop(1, 'rgba(255, 195, 89, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(baseX, py + height * 0.40, ts * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const plinth = ctx.createLinearGradient(0, baseY, 0, baseY + ts * 0.26);
    plinth.addColorStop(0, 'rgba(225, 186, 100, 0.34)');
    plinth.addColorStop(1, 'rgba(58, 38, 20, 0.06)');
    ctx.fillStyle = plinth;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + ts * 0.10, ts * 0.72, ts * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const side = npc.id === 'guard_left' ? -1 : 1;
    const rim = ctx.createLinearGradient(
      baseX - ts * 0.7,
      0,
      baseX + ts * 0.7,
      0
    );
    rim.addColorStop(side < 0 ? 0 : 1, 'rgba(255, 215, 132, 0.13)');
    rim.addColorStop(0.5, 'rgba(255, 215, 132, 0.025)');
    rim.addColorStop(side < 0 ? 1 : 0, 'rgba(255, 215, 132, 0)');
    ctx.fillStyle = rim;
    ctx.fillRect(baseX - ts * 0.72, py, ts * 1.44, height);
  }
  ctx.restore();
},

drawRoyalNpcAccent(ctx, npc, placement) {
  if (!this.isRoyalThroneActor(npc)) return;
  const ts = this.tileSize;
  const { baseX, py, width, height } = placement;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  if (npc.stageRole === 'sovereign') {
    ctx.strokeStyle = 'rgba(255, 234, 167, 0.56)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(baseX - width * 0.19, py + height * 0.12);
    ctx.quadraticCurveTo(baseX, py + height * 0.04, baseX + width * 0.19, py + height * 0.12);
    ctx.stroke();
  } else {
    const side = npc.id === 'guard_left' ? -1 : 1;
    ctx.strokeStyle = 'rgba(244, 220, 158, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(baseX + side * width * 0.22, py + height * 0.11);
    ctx.lineTo(baseX + side * width * 0.27, py + height * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}
};
