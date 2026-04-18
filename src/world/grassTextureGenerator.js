import * as THREE from "three";

const { clamp, lerp } = THREE.MathUtils;

function wrapIndex(value, period) {
  if (!Number.isFinite(period) || period <= 0) {
    return value;
  }
  let wrapped = value % period;
  if (wrapped < 0) {
    wrapped += period;
  }
  return wrapped;
}

function hashNoise(x, y, seed, periodX, periodY) {
  const wrappedX = wrapIndex(x, periodX);
  const wrappedY = wrapIndex(y, periodY);
  const s =
    Math.sin(wrappedX * 127.1 + wrappedY * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y, seed, periodX, periodY) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;

  const n00 = hashNoise(x0, y0, seed, periodX, periodY);
  const n10 = hashNoise(x0 + 1, y0, seed, periodX, periodY);
  const n01 = hashNoise(x0, y0 + 1, seed, periodX, periodY);
  const n11 = hashNoise(x0 + 1, y0 + 1, seed, periodX, periodY);

  const nx0 = lerp(n00, n10, xf);
  const nx1 = lerp(n01, n11, xf);
  return lerp(nx0, nx1, yf);
}

function fbmNoise(x, y, options = {}) {
  const {
    octaves = 4,
    persistence = 0.55,
    lacunarity = 2,
    seed = 1,
    periodX = 0,
    periodY = 0,
  } = options;

  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    const octaveSeed = seed + i * 17.23;
    const octavePeriodX = periodX
      ? Math.max(1, Math.round(periodX * frequency))
      : 0;
    const octavePeriodY = periodY
      ? Math.max(1, Math.round(periodY * frequency))
      : 0;
    sum +=
      smoothNoise(
        x * frequency,
        y * frequency,
        octaveSeed,
        octavePeriodX,
        octavePeriodY,
      ) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  if (max <= 0) return 0;
  return sum / max;
}

function applySaturation(rgb, amount) {
  const [r, g, b] = rgb;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [
    clamp(lum + (r - lum) * amount, 0, 255),
    clamp(lum + (g - lum) * amount, 0, 255),
    clamp(lum + (b - lum) * amount, 0, 255),
  ];
}

function applyContrast(rgb, amount) {
  const [r, g, b] = rgb;
  const adjust = (value) => clamp((value - 128) * amount + 128, 0, 255);
  return [adjust(r), adjust(g), adjust(b)];
}

function composeColor(base, shadow, highlight, params) {
  const { shadowMix, highlightMix, variation } = params;

  const mixChannel = (channelBase, channelShadow, channelHighlight) => {
    const shadowed = lerp(channelBase, channelShadow, shadowMix);
    const highlighted = lerp(shadowed, channelHighlight, highlightMix);
    return clamp(highlighted * (1 + variation), 0, 255);
  };

  return [
    mixChannel(base[0], shadow[0], highlight[0]),
    mixChannel(base[1], shadow[1], highlight[1]),
    mixChannel(base[2], shadow[2], highlight[2]),
  ];
}

function makeTileableSample(nx, ny, freqX, freqY, offsetX, offsetY) {
  const safeFreqX = Math.max(Math.abs(freqX), 1e-6);
  const safeFreqY = Math.max(Math.abs(freqY), 1e-6);
  const periodX = Math.max(1, Math.round(safeFreqX));
  const periodY = Math.max(1, Math.round(safeFreqY));
  const scaleX = periodX / safeFreqX;
  const scaleY = periodY / safeFreqY;
  return {
    x: (nx * freqX + offsetX) * scaleX,
    y: (ny * freqY + offsetY) * scaleY,
    periodX,
    periodY,
  };
}

export function createGrassTexture(options = {}) {
  const {
    size = 256,
    seed = 1337,
    baseColor = [92, 148, 70],
    shadowColor = [36, 74, 34],
    highlightColor = [164, 214, 116],
    bladeFrequency = 5.5,
    bladeTaper = 1.45,
    highlightStrength = 0.55,
    shadowStrength = 0.65,
    noiseScale = 3.5,
    patchiness = 0.2,
    saturation = 1.08,
    contrast = 1.06,
  } = options;

  const width = size;
  const height = size;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      const patchSample = makeTileableSample(
        nx,
        ny,
        noiseScale,
        noiseScale,
        seed * 0.13,
        seed * 0.19,
      );
      const patchNoise = fbmNoise(patchSample.x, patchSample.y, {
        octaves: 4,
        persistence: 0.55,
        seed,
        periodX: patchSample.periodX,
        periodY: patchSample.periodY,
      });

      const bladeSample = makeTileableSample(
        nx,
        ny,
        noiseScale * 1.7,
        noiseScale * 1.1,
        seed * 0.31,
        seed * 0.47,
      );
      const bladeNoise = fbmNoise(bladeSample.x, bladeSample.y, {
        octaves: 5,
        persistence: 0.5,
        seed: seed * 1.7,
        periodX: bladeSample.periodX,
        periodY: bladeSample.periodY,
      });

      const bladePhase =
        Math.sin((nx + ny * 0.25) * Math.PI * bladeFrequency + bladeNoise * Math.PI * 2) *
          0.5 +
        0.5;
      const bladeProfile = Math.pow(bladePhase, bladeTaper);

      const shadowMix = clamp(bladeProfile * shadowStrength, 0, 1);
      const highlightMix = clamp(
        Math.pow(1 - bladeProfile, 2.0) * highlightStrength,
        0,
        1,
      );
      const variation = clamp((patchNoise - 0.5) * (patchiness * 2.4), -0.35, 0.4);

      let color = composeColor(baseColor, shadowColor, highlightColor, {
        shadowMix,
        highlightMix,
        variation,
      });

      color = applySaturation(color, saturation);
      color = applyContrast(color, contrast);

      const index = (y * width + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = false;
  if ("colorSpace" in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

export function createGrassDetailTexture(options = {}) {
  const detailTexture = createGrassTexture({
    size: options.size ?? 256,
    seed: (options.seed ?? 1337) * 3.1,
    baseColor: options.baseColor ?? [86, 146, 68],
    shadowColor: options.shadowColor ?? [30, 64, 32],
    highlightColor: options.highlightColor ?? [182, 226, 128],
    bladeFrequency: options.bladeFrequency ?? 9.5,
    bladeTaper: options.bladeTaper ?? 1.1,
    highlightStrength: options.highlightStrength ?? 0.85,
    shadowStrength: options.shadowStrength ?? 0.75,
    noiseScale: options.noiseScale ?? 5.5,
    patchiness: options.patchiness ?? 0.35,
    saturation: options.saturation ?? 1.12,
    contrast: options.contrast ?? 1.15,
  });

  return detailTexture;
}

export function createFreshGrassLowlandsTexture(options = {}) {
  return createGrassTexture({
    size: options.size ?? 256,
    seed: (options.seed ?? 733) * 2.7,
    baseColor: options.baseColor ?? [112, 168, 98],
    shadowColor: options.shadowColor ?? [58, 106, 64],
    highlightColor: options.highlightColor ?? [196, 232, 150],
    bladeFrequency: options.bladeFrequency ?? 6.25,
    bladeTaper: options.bladeTaper ?? 1.3,
    highlightStrength: options.highlightStrength ?? 0.68,
    shadowStrength: options.shadowStrength ?? 0.52,
    noiseScale: options.noiseScale ?? 4.1,
    patchiness: options.patchiness ?? 0.22,
    saturation: options.saturation ?? 1.08,
    contrast: options.contrast ?? 1.04,
  });
}

export function createDryGrassDetailTexture(options = {}) {
  return createGrassTexture({
    size: options.size ?? 256,
    seed: (options.seed ?? 905) * 3.5,
    baseColor: options.baseColor ?? [170, 156, 108],
    shadowColor: options.shadowColor ?? [102, 96, 68],
    highlightColor: options.highlightColor ?? [216, 206, 150],
    bladeFrequency: options.bladeFrequency ?? 8.4,
    bladeTaper: options.bladeTaper ?? 1.05,
    highlightStrength: options.highlightStrength ?? 0.58,
    shadowStrength: options.shadowStrength ?? 0.48,
    noiseScale: options.noiseScale ?? 5.9,
    patchiness: options.patchiness ?? 0.32,
    saturation: options.saturation ?? 0.94,
    contrast: options.contrast ?? 1.1,
  });
}
