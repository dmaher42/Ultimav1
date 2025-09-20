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
  const data = await response.json();
  return { data, url: response.url || url };
}

function resolveSource(imageField, fallback, baseUrl) {
  let source = imageField;
  if (Array.isArray(source)) {
    source = source.join('');
  }
  source = source || fallback;
  if (!source) {
    return null;
  }

  if (typeof source !== 'string') {
    return source;
  }

  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (hasScheme || trimmed.startsWith('//') || trimmed.startsWith('/')) {
    return trimmed;
  }

  if (baseUrl) {
    try {
      return new URL(trimmed, baseUrl).href;
    } catch (error) {
      // Ignore resolution errors and fall back to the trimmed string.
    }
  }

  return trimmed;
}

export async function loadAtlas(imageUrl, jsonUrl) {
  const { data: metaData, url: metaUrl } = await loadMeta(jsonUrl);
  const frames = metaData.frames || metaData;
  const baseForRelative = metaUrl || (typeof window !== 'undefined' ? window.location.href : undefined);
  const source = resolveSource(metaData.image, imageUrl, baseForRelative);
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
