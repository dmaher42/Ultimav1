import { DPR } from './canvas.js';

function normaliseArgs(args) {
  if (args.length === 0) return null;
  if (typeof args[0] === 'number') {
    const [x, y, w, h, alpha = 0.5, ms = 80] = args;
    return { x, y, w, h, alpha, ms };
  }
  const [, x, y, w, h, alpha = 0.5, ms = 80] = args;
  return { x, y, w, h, alpha, ms };
}

function clampRect(rect) {
  if (!rect) return null;
  const width = Number.isFinite(rect.w) ? Math.max(0, rect.w) : 0;
  const height = Number.isFinite(rect.h) ? Math.max(0, rect.h) : 0;
  if (width <= 0 || height <= 0) return null;
  return {
    x: Number.isFinite(rect.x) ? rect.x : 0,
    y: Number.isFinite(rect.y) ? rect.y : 0,
    w: width,
    h: height,
    alpha: Number.isFinite(rect.alpha) ? Math.max(0, rect.alpha) : 0.5,
    ms: Number.isFinite(rect.ms) ? Math.max(16, rect.ms) : 80
  };
}

function blendMode(ctx, desired) {
  const previous = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = desired;
  if (ctx.globalCompositeOperation !== desired) {
    ctx.globalCompositeOperation = 'lighter';
  }
  return previous;
}

export function createFlashLayer() {
  const flashes = [];

  function flashRect(...args) {
    const rect = clampRect(normaliseArgs(args));
    if (!rect) return;
    const duration = rect.ms / 1000;
    flashes.push({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      alpha: rect.alpha,
      duration,
      remaining: duration
    });
  }

  function update(dt) {
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (!delta && !flashes.length) return;
    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      const flash = flashes[i];
      flash.remaining -= delta;
      if (flash.remaining <= 0) {
        flashes.splice(i, 1);
      }
    }
  }

  function draw(ctx) {
    if (!ctx || !flashes.length) return;
    ctx.save();
    const prevComposite = blendMode(ctx, 'screen');
    ctx.globalAlpha = 1;
    for (let i = 0; i < flashes.length; i += 1) {
      const flash = flashes[i];
      const progress = Math.max(0, flash.remaining / flash.duration);
      const eased = progress * progress;
      const intensity = flash.alpha * eased;
      if (intensity <= 0) continue;
      const width = Math.round(flash.w * DPR) / DPR;
      const height = Math.round(flash.h * DPR) / DPR;
      const px = Math.round(flash.x * DPR) / DPR;
      const py = Math.round(flash.y * DPR) / DPR;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, intensity)})`;
      ctx.fillRect(px, py, width, height);
    }
    ctx.globalCompositeOperation = prevComposite;
    ctx.restore();
  }

  function clear() {
    flashes.length = 0;
  }

  function hasActive() {
    return flashes.length > 0;
  }

  return {
    flashRect,
    update,
    draw,
    clear,
    hasActive
  };
}

export default createFlashLayer;
