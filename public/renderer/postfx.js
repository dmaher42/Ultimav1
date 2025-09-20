export function vignette(ctx, width, height) {
  if (!ctx || !width || !height) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const maxDim = Math.max(width, height);
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    maxDim * 0.35,
    width / 2,
    height / 2,
    maxDim * 0.75
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
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
