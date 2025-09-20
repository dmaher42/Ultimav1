export function vignette(ctx, width, height, strength = 0.35) {
  if (!ctx || !width || !height) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const maxDim = Math.max(width, height);
  const clampStrength = Math.min(0.8, Math.max(0, strength));
  const inner = maxDim * (0.35 + clampStrength * 0.1);
  const outer = maxDim * (0.75 + clampStrength * 0.15);
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    inner,
    width / 2,
    height / 2,
    outer
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${clampStrength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function colorGrade(ctx, tint = 'rgba(255,230,200,0.06)', width, height) {
  if (!ctx) return;
  const w = typeof width === 'number' ? width : ctx.canvas.width;
  const h = typeof height === 'number' ? height : ctx.canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
