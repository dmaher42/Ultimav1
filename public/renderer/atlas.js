async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load atlas image: ${url}`));
    image.src = url;
  });
}

async function loadMeta(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load atlas metadata: ${url}`);
  }
  return response.json();
}

export async function loadAtlas(imageUrl, jsonUrl) {
  const metaData = await loadMeta(jsonUrl);
  const frames = metaData.frames || metaData;
  let source = metaData.image;
  if (Array.isArray(source)) {
    source = source.join('');
  }
  source = source || imageUrl;
  if (!source) {
    throw new Error('Atlas image source missing.');
  }
  const img = await loadImage(source);
  return { img, meta: frames };
}

export function drawSprite(ctx, atlas, name, dx, dy, dw, dh) {
  if (!ctx || !atlas || !atlas.img || !atlas.meta) return false;
  const frame = atlas.meta[name] || atlas.meta.default;
  if (!frame) return false;
  const { x, y, w, h } = frame;
  const width = typeof dw === 'number' ? dw : w;
  const height = typeof dh === 'number' ? dh : h;
  const px = Math.round(dx);
  const py = Math.round(dy);
  ctx.drawImage(atlas.img, x, y, w, h, px, py, width, height);
  return true;
}
