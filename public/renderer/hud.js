import { DPR } from './canvas.js';

function disableSmoothing(ctx) {
  ctx.imageSmoothingEnabled = false;
  if ('mozImageSmoothingEnabled' in ctx) ctx.mozImageSmoothingEnabled = false;
  if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
  if ('msImageSmoothingEnabled' in ctx) ctx.msImageSmoothingEnabled = false;
}

function formatFps(fps) {
  if (!Number.isFinite(fps)) return 'FPS: --';
  return `FPS: ${Math.round(fps).toString().padStart(2, '0')}`;
}

function measurePanel(ctx, lines, paddingX) {
  let width = 0;
  for (let i = 0; i < lines.length; i += 1) {
    width = Math.max(width, ctx.measureText(lines[i]).width);
  }
  return Math.ceil(width + paddingX * 2);
}

function drawPanel(ctx, x, y, width, height, opacity = 0.75) {
  ctx.fillStyle = `rgba(10, 12, 28, ${opacity})`;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = Math.max(1, Math.round(DPR));
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

export function createHUD() {
  const fontPrimary = '12px "Press Start 2P", monospace';
  const fontSmall = '10px "Press Start 2P", monospace';

  function draw(ctx, data = {}) {
    if (!ctx) return;
    ctx.save();
    disableSmoothing(ctx);
    const { fps = 0, resources = {}, castleLevel = 1, debug = {} } = data;
    const entries = Object.entries(resources);
    const lines = [formatFps(fps), ...entries.map(([name, value]) => `${name}: ${value}`)];
    ctx.font = fontPrimary;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f4f5ff';
    const lineHeight = 14;
    const paddingX = 10;
    const paddingY = 8;
    const panelWidth = measurePanel(ctx, lines, paddingX);
    const panelHeight = lines.length * lineHeight + paddingY * 2;
    const panelX = 12;
    const panelY = 12;
    drawPanel(ctx, panelX, panelY, panelWidth, panelHeight);
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      const tx = Math.round(panelX + paddingX);
      const ty = Math.round(panelY + paddingY + i * lineHeight);
      ctx.fillText(text, tx, ty);
    }

    const castleLabel = `Castle L${castleLevel ?? 1}`;
    ctx.font = fontPrimary;
    const castleWidth = ctx.measureText(castleLabel).width;
    const centerX = Math.round(ctx.canvas.width / DPR / 2 - castleWidth / 2);
    const castleY = Math.round(panelY);
    drawPanel(ctx, centerX - paddingX, castleY, castleWidth + paddingX * 2, lineHeight + paddingY);
    ctx.fillText(castleLabel, centerX, castleY + paddingY / 2);

    if (debug?.visible) {
      ctx.font = fontSmall;
      const debugLines = [];
      debugLines.push(formatFps(debug.fps ?? fps));
      if (debug.camera) {
        const cx = Math.round(debug.camera.x);
        const cy = Math.round(debug.camera.y);
        debugLines.push(`Cam: ${cx}, ${cy}`);
      }
      if (Number.isFinite(debug.t)) {
        debugLines.push(`ToD: ${debug.t.toFixed(2)}`);
      }
      if (debug.offset) {
        const ox = debug.offset.x?.toFixed ? debug.offset.x.toFixed(2) : debug.offset.x;
        const oy = debug.offset.y?.toFixed ? debug.offset.y.toFixed(2) : debug.offset.y;
        debugLines.push(`Shake: ${ox}, ${oy}`);
      }
      const dbgPaddingX = 8;
      const dbgPaddingY = 6;
      const dbgLineHeight = 12;
      const debugWidth = measurePanel(ctx, debugLines, dbgPaddingX);
      const debugHeight = debugLines.length * dbgLineHeight + dbgPaddingY * 2;
      const debugX = ctx.canvas.width / DPR - debugWidth - 12;
      const debugY = panelY;
      drawPanel(ctx, Math.round(debugX), Math.round(debugY), debugWidth, debugHeight, 0.65);
      for (let i = 0; i < debugLines.length; i += 1) {
        const text = debugLines[i];
        const tx = Math.round(debugX + dbgPaddingX);
        const ty = Math.round(debugY + dbgPaddingY + i * dbgLineHeight);
        ctx.fillText(text, tx, ty);
      }
    }

    ctx.restore();
  }

  return { draw };
}

export default createHUD;
