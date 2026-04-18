import * as THREE from 'three';
import { resolveBaseUrl, joinPath } from './baseUrl.js';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

/**
 * Loads a texture with a fallback if the primary URL fails.
 */
export function loadSafeTexture(url, options = {}) {
  const {
    fallback = 0x888888,
    repeat = [1, 1],
    isColor = false
  } = options;

  if (!url) return createColorTexture(fallback);

  const fullUrl = joinPath(resolveBaseUrl(), url);
  const cacheKey = `${fullUrl}|${repeat.join(',')}|${isColor}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const texture = textureLoader.load(
    fullUrl,
    (tex) => {
      // On success
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat[0], repeat[1]);
      if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
    },
    undefined,
    (err) => {
      console.warn(`[TextureUtils] Failed to load ${url}, using fallback.`, err);
      // On error, we try to load the fallback or use a color
      if (typeof fallback === 'string' && fallback.startsWith('http')) {
        // Recurse once with the fallback URL if it's a real URL
        // In a real app we'd prevent infinite loops here
      } else {
        const fallbackTex = createColorTexture(fallback);
        texture.image = fallbackTex.image;
        texture.needsUpdate = true;
      }
    }
  );

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Creates a 1x1 data texture of a solid color.
 */
function createColorTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  
  const c = new THREE.Color(color);
  ctx.fillStyle = c.getStyle();
  ctx.fillRect(0, 0, 1, 1);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `color_${c.getHexString()}`;
  return texture;
}
