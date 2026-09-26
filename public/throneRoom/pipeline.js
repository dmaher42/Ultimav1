import CoreRenderEngine from '../renderCore.js';

// Castle-only render loop. Other maps remain on renderCore.js.
export const pipelineMethods = {
draw() {
  if (!this.assetsLoaded) return;
  const grid = this.getMapGrid();
  if (!grid || grid.id !== 'castle') {
    CoreRenderEngine.prototype.draw.call(this);
    return;
  }
  this.drawOverhauledCastle(grid);
},

drawOverhauledCastle(grid) {
  this.updateCanvasMetrics();
  const ctx = this.ctx;
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
  this.drawCastleBackdrop(ctx);

  this.camera.apply(ctx);
  this.drawMap(ctx, grid);
  this.drawCastleThroneRoomStage(ctx, grid);
  this.drawCastleCarpetOverlay(ctx, grid);
  this.drawCastleFloorDetailPass(ctx, grid);

  const entities = this.buildCastleEntityList();
  this.drawFloorReflections(ctx, grid, entities);
  entities.sort((a, b) => a.y - b.y);

  entities.forEach((entity) => {
    this.drawSoftShadowForEntity(ctx, entity);
    if (entity.type === 'object') this.drawObject(ctx, entity.data);
    if (entity.type === 'npc') this.drawNPC(ctx, entity.data);
    if (entity.type === 'player') this.drawPlayer(ctx);

    if (
      entity.type === 'object'
      && (entity.data.sprite === 'torch_wall' || entity.data.sprite === 'royal_brazier')
    ) {
      this.drawTorchLight(ctx, entity.data);
    }
  });

  if (Array.isArray(grid.layers)) {
    grid.layers.forEach((layer) => {
      if ((layer.zIndex || 0) > 0) {
        this.renderLayer(ctx, grid, layer.tiles);
      }
    });
  }

  if (this.highlight) this.drawHighlight(ctx, this.highlight);

  this.updateCastleParticles();
  if (this.particles) this.particles.draw(ctx);
  this.drawCastleForegroundFrame(ctx);

  this.camera.reset(ctx);
  this.drawCastleScreenAtmosphere(ctx);
  ctx.restore();

  if (this.flashLayer.hasActive()) {
    this.camera.apply(ctx);
    this.flashLayer.draw(ctx);
    this.camera.reset(ctx);
  }

  if (this.debugOverlay) {
    const cameraState = this.camera.getState();
    this.hudOverlay.draw(ctx, {
      fps: this.fps,
      resources: {},
      castleLevel: 1,
      debug: {
        visible: true,
        fps: this.fps,
        camera: cameraState.position,
        t: this.timeOfDay.t,
        offset: cameraState.offset
      }
    });
  }
},

buildCastleEntityList() {
  const entities = [];
  this.objects.forEach((object) => {
    const height = Number.isFinite(object?.height) ? object.height : 1;
    const y = (object.y + Math.max(1, height * 0.68)) * this.tileSize;
    entities.push({ type: 'object', y, data: object });
  });
  this.npcs.forEach((npc) => {
    const placement = this.getNpcSpritePlacement(npc);
    const y = placement
      ? placement.baseY - this.offsetY
      : (npc.y + 1) * this.tileSize;
    entities.push({ type: 'npc', y, data: npc });
  });
  if (this.player?.position) {
    entities.push({
      type: 'player',
      y: (this.player.position.y + 1) * this.tileSize,
      data: this.player
    });
  }
  return entities;
}
};
