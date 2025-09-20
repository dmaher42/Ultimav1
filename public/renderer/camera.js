import { DPR } from './canvas.js';

/**
 * @typedef {Object} CameraBounds
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */

/**
 * Create a smooth-follow camera with optional screen shake.
 * @param {Object} [options]
 * @param {number} [options.x=0]
 * @param {number} [options.y=0]
 * @param {number} [options.w=800]
 * @param {number} [options.h=450]
 * @param {number} [options.lerp=0.15]
 */
export function createCamera({ x = 0, y = 0, w = 800, h = 450, lerp = 0.15 } = {}) {
  const position = { x, y };
  const target = { x, y };
  const viewport = { w: Math.max(1, w), h: Math.max(1, h) };
  /** @type {CameraBounds} */
  let bounds = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };
  let shakeDuration = 0;
  let shakeRemaining = 0;
  let shakeIntensity = 0;
  const shakeOffset = { x: 0, y: 0 };

  function clamp(value, min, max) {
    if (min > max) {
      return (min + max) / 2;
    }
    return Math.min(Math.max(value, min), max);
  }

  function clampTarget() {
    const halfW = viewport.w / 2;
    const halfH = viewport.h / 2;
    const minX = bounds.minX + halfW;
    const maxX = bounds.maxX - halfW;
    const minY = bounds.minY + halfH;
    const maxY = bounds.maxY - halfH;

    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      target.x = Math.min(Math.max(target.x, -Infinity), Infinity);
    } else if (bounds.maxX - bounds.minX <= viewport.w) {
      target.x = (bounds.minX + bounds.maxX) / 2;
    } else {
      target.x = clamp(target.x, minX, maxX);
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      target.y = Math.min(Math.max(target.y, -Infinity), Infinity);
    } else if (bounds.maxY - bounds.minY <= viewport.h) {
      target.y = (bounds.minY + bounds.maxY) / 2;
    } else {
      target.y = clamp(target.y, minY, maxY);
    }
  }

  function follow(tx, ty) {
    if (Number.isFinite(tx)) {
      target.x = tx;
    }
    if (Number.isFinite(ty)) {
      target.y = ty;
    }
    clampTarget();
  }

  function setViewport(width, height) {
    viewport.w = Math.max(1, width || viewport.w);
    viewport.h = Math.max(1, height || viewport.h);
    clampTarget();
  }

  function setBounds(minX, minY, maxX, maxY) {
    bounds = {
      minX: Number.isFinite(minX) ? minX : -Infinity,
      minY: Number.isFinite(minY) ? minY : -Infinity,
      maxX: Number.isFinite(maxX) ? maxX : Infinity,
      maxY: Number.isFinite(maxY) ? maxY : Infinity
    };
    clampTarget();
  }

  function shake(intensity = 6, time = 0.2) {
    shakeIntensity = Math.max(0, intensity);
    shakeDuration = Math.max(0, time);
    shakeRemaining = shakeDuration;
  }

  function update(dt) {
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (delta > 0) {
      const base = Math.min(Math.max(lerp, 0.01), 0.99);
      const steps = Math.max(1, delta * 60);
      const speed = 1 - Math.pow(1 - base, steps);
      position.x += (target.x - position.x) * speed;
      position.y += (target.y - position.y) * speed;
      shakeRemaining = Math.max(0, shakeRemaining - delta);
    } else {
      shakeRemaining = Math.max(0, shakeRemaining - 0.016);
    }

    if (shakeRemaining > 0 && shakeDuration > 0) {
      const decay = shakeRemaining / shakeDuration;
      const magnitude = shakeIntensity * decay * decay;
      shakeOffset.x = (Math.random() - 0.5) * 2 * magnitude;
      shakeOffset.y = (Math.random() - 0.5) * 2 * magnitude;
    } else {
      shakeOffset.x = 0;
      shakeOffset.y = 0;
    }
  }

  function apply(ctx) {
    if (!ctx) return;
    ctx.save();
    const offsetX = viewport.w / 2 - position.x + shakeOffset.x;
    const offsetY = viewport.h / 2 - position.y + shakeOffset.y;
    const snappedX = Math.round(offsetX * DPR) / DPR;
    const snappedY = Math.round(offsetY * DPR) / DPR;
    ctx.translate(snappedX, snappedY);
  }

  function reset(ctx) {
    if (!ctx) return;
    ctx.restore();
  }

  function getState() {
    return {
      position: { x: position.x, y: position.y },
      target: { x: target.x, y: target.y },
      offset: { x: shakeOffset.x, y: shakeOffset.y }
    };
  }

  return {
    follow,
    shake,
    update,
    apply,
    reset,
    setViewport,
    setBounds,
    getState
  };
}

export default createCamera;
