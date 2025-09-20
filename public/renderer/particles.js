function clampBlend(blend) {
  return blend === 'lighter' ? 'lighter' : 'source-over';
}

export function createEmitter(capacity = 256) {
  const pool = new Array(Math.max(1, capacity)).fill(null).map(() => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0.5,
    age: 0,
    size: 1,
    gravity: 0,
    blend: 'lighter',
    color: 'rgba(255, 232, 180, 0.9)'
  }));
  let cursor = 0;

  function spawn(x, y, options = {}) {
    const idx = findAvailable();
    const particle = pool[idx];
    particle.active = true;
    particle.x = Number.isFinite(x) ? x : 0;
    particle.y = Number.isFinite(y) ? y : 0;
    particle.vx = Number.isFinite(options.vx) ? options.vx : 0;
    particle.vy = Number.isFinite(options.vy) ? options.vy : 0;
    particle.life = Math.max(0.1, Number.isFinite(options.life) ? options.life : 0.8);
    particle.age = 0;
    const size = Number.isFinite(options.size) ? options.size : 1;
    particle.size = Math.max(1, size);
    particle.gravity = Number.isFinite(options.gravity) ? options.gravity : 0;
    particle.blend = clampBlend(options.blend);
    particle.color = options.color || 'rgba(255, 232, 180, 0.9)';
  }

  function findAvailable() {
    const length = pool.length;
    for (let i = 0; i < length; i += 1) {
      const index = (cursor + i) % length;
      if (!pool[index].active) {
        cursor = (index + 1) % length;
        return index;
      }
    }
    const index = cursor;
    cursor = (cursor + 1) % length;
    return index;
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const delta = dt;
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (!p.active) continue;
      p.age += delta;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
    }
  }

  function draw(ctx) {
    if (!ctx) return;
    ctx.save();
    let currentBlend = null;
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (!p.active) continue;
      if (p.blend !== currentBlend) {
        currentBlend = p.blend;
        ctx.globalCompositeOperation = currentBlend;
      }
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const size = Math.max(1, Math.round(p.size));
      const half = size / 2;
      const px = Math.round(p.x - half);
      const py = Math.round(p.y - half);
      ctx.fillRect(px, py, size, size);
    }
    ctx.restore();
  }

  return {
    spawn,
    update,
    draw
  };
}
