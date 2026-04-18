import * as THREE from "three";
import {
  getSeaLevelY,
  AGORA_CENTER_3D,
  HARBOR_GROUND_HEIGHT,
  HARBOR_WATER_BOUNDS,
} from "../world/locations.js";
import {
  SEA_SIDE,
  COAST_WIDTH,
  INLAND_RISE,
  RIDGE_START,
  RIDGE_HEIGHT,
} from "../config/terrainShape";
import { validateTerrain } from "../world/terrainValidation";
const DEFAULT_SEED_START = 1337;
const TERRAIN_SIZE = 2400;
const DEFAULT_SEGMENTS = 512;
const TERRAIN_VALIDATION_ATTEMPTS = 5;
const CITY_HEIGHT = 2.5;
const MAINLAND_EDGE_BUFFER = 0.8;
const NOISE_SCALE = 0.05;
const NOISE_AMPLITUDE = 0.45;
const ZERO_NOISE_OFFSET = { x: 0, z: 0 };

const HARBOUR_RADIUS = 70;
const HARBOUR_TARGET_DEPTH = 2;
const EAST_HARBOR_CENTER = new THREE.Vector2(-50, -100);

function seededRandom(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function getNoiseOffset(seed, attempt, size) {
  if (attempt <= 0) return ZERO_NOISE_OFFSET;
  const range = size * 0.35;
  const base = seed + attempt * 1319;
  const randA = seededRandom(base * 1.31);
  const randB = seededRandom(base * 2.17 + 19.7);
  return {
    x: (randA * 2 - 1) * range,
    z: (randB * 2 - 1) * range,
  };
}

function gradientNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xf = x - x0;
  const zf = z - z0;

  const gradients = new Array(4);
  for (let i = 0; i < 4; i++) {
    const ix = x0 + (i & 1);
    const iz = z0 + (i >> 1);
    const seed = Math.sin(ix * 374761393 + iz * 668265263) * 43758.5453;
    const angle = seed - Math.floor(seed);
    gradients[i] = {
      x: Math.cos(angle * Math.PI * 2),
      z: Math.sin(angle * Math.PI * 2),
    };
  }

  const dot00 = gradients[0].x * xf + gradients[0].z * zf;
  const dot10 = gradients[1].x * (xf - 1) + gradients[1].z * zf;
  const dot01 = gradients[2].x * xf + gradients[2].z * (zf - 1);
  const dot11 = gradients[3].x * (xf - 1) + gradients[3].z * (zf - 1);

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(xf);
  const v = fade(zf);
  const lerp = (a, b, t) => a + (b - a) * t;

  const nx0 = lerp(dot00, dot10, u);
  const nx1 = lerp(dot01, dot11, u);
  return lerp(nx0, nx1, v);
}

function getDistanceToSeaNormalized(x, z, halfSize, size) {
  switch (SEA_SIDE) {
    case "west":
      return THREE.MathUtils.clamp((x + halfSize) / size, 0, 1);
    case "north":
      return THREE.MathUtils.clamp((z + halfSize) / size, 0, 1);
    case "south":
      return THREE.MathUtils.clamp((halfSize - z) / size, 0, 1);
    case "east":
    default:
      return THREE.MathUtils.clamp((halfSize - x) / size, 0, 1);
  }
}

function computeCoastData(x, z, halfSize, size) {
  const dSea = getDistanceToSeaNormalized(x, z, halfSize, size);
  const coastBand = THREE.MathUtils.clamp(COAST_WIDTH / size, 0, 1);
  const coastMask = THREE.MathUtils.smoothstep(0, coastBand, dSea);

  return { dSea, coastMask };
}

function applyHarbourCarve(x, z, seaLevel, height) {
  const dx = x - EAST_HARBOR_CENTER.x;
  const dz = z - EAST_HARBOR_CENTER.y;
  const distance = Math.hypot(dx, dz);

  if (distance >= HARBOUR_RADIUS) return height;

  const t = THREE.MathUtils.clamp(1 - distance / HARBOUR_RADIUS, 0, 1);
  const blend = t * t;
  const targetHeight = seaLevel - HARBOUR_TARGET_DEPTH;

  return THREE.MathUtils.lerp(height, targetHeight, blend);
}

function clampHarborBandHeight(x, z, seaLevel, baseHeight) {
  // Define a bounding box for the harbor water area using HARBOR_WATER_BOUNDS
  const west = HARBOR_WATER_BOUNDS.west;
  const east = HARBOR_WATER_BOUNDS.east;
  const north = HARBOR_WATER_BOUNDS.north;
  const south = HARBOR_WATER_BOUNDS.south;

  const harborGroundY = seaLevel + HARBOR_GROUND_HEIGHT;

  const withinWater = x >= west && x <= east && z >= north && z <= south;
  if (withinWater) {
    return seaLevel - 1.4;
  }

  const shelfWidth = 60;
  const shelfStart = west - shelfWidth;
  const shelfDepth = 80;

  if (
    x >= shelfStart &&
    x < west &&
    z >= north - shelfDepth &&
    z <= south + shelfDepth
  ) {
    return harborGroundY;
  }

  const slopeWidth = 25;
  const landStart = shelfStart - slopeWidth;

  if (
    x >= landStart &&
    x < shelfStart &&
    z >= north - shelfDepth - 10 &&
    z <= south + shelfDepth + 10
  ) {
    const t = (x - landStart) / slopeWidth;
    return THREE.MathUtils.lerp(baseHeight, harborGroundY, t);
  }

  return baseHeight;
}

function getElevation(x, z, seaLevel, coastData, noiseOffset, halfSize, size) {
  let h = seaLevel + CITY_HEIGHT;

  const coast = coastData ?? computeCoastData(x, z, halfSize, size);
  const dSea = coast.dSea;

  h += INLAND_RISE * (dSea + dSea * dSea);

  const ridgeNoise =
    gradientNoise(
      (x + noiseOffset.x) * NOISE_SCALE * 0.2,
      (z + noiseOffset.z) * NOISE_SCALE * 0.2,
    ) *
      0.5 +
    0.5;
  const ridgeMask = THREE.MathUtils.smoothstep(RIDGE_START, 1.0, dSea);
  h += ridgeMask * ridgeNoise * RIDGE_HEIGHT;

  const rawNoise = gradientNoise(
    (x + noiseOffset.x) * NOISE_SCALE,
    (z + noiseOffset.z) * NOISE_SCALE,
  );
  const noise = rawNoise * NOISE_AMPLITUDE * (0.35 + dSea * 0.65);

  const coastalNoiseAttenuation = 1 - coast.coastMask;
  const shapedNoise = noise * (0.4 + coastalNoiseAttenuation * 0.6);

  h += shapedNoise;

  const borderBand = THREE.MathUtils.clamp(COAST_WIDTH / size, 0, 1);
  const borderDistances = {
    east: THREE.MathUtils.clamp((halfSize - x) / size, 0, 1),
    west: THREE.MathUtils.clamp((x + halfSize) / size, 0, 1),
    north: THREE.MathUtils.clamp((z + halfSize) / size, 0, 1),
    south: THREE.MathUtils.clamp((halfSize - z) / size, 0, 1),
  };
  const nonSeaBorders = Object.entries(borderDistances)
    .filter(([side]) => side !== SEA_SIDE)
    .map(([, distance]) => 1 - THREE.MathUtils.smoothstep(0, borderBand, distance));
  const nonSeaBorderMask =
    nonSeaBorders.length > 0 ? Math.max(...nonSeaBorders) : 0;
  if (nonSeaBorderMask > 0) {
    // Islands can happen when a slope threshold is used as a height buffer on borders.
    h = Math.max(h, seaLevel + MAINLAND_EDGE_BUFFER * nonSeaBorderMask);
  }

  h = applyHarbourCarve(x, z, seaLevel, h);
  h = clampHarborBandHeight(x, z, seaLevel, h);

  const agoraDist = Math.hypot(x - AGORA_CENTER_3D.x, z - AGORA_CENTER_3D.z);
  if (agoraDist < 60) {
    h = h * 0.7 + (seaLevel + CITY_HEIGHT) * 0.3;
  }

  if (coast.coastMask < 1) {
    h = THREE.MathUtils.lerp(seaLevel, h, coast.coastMask);
  }

  return h;
}

function buildBaseHeights({
  seed,
  attempt,
  size,
  segments,
  seaLevel,
  halfSize,
}) {
  const stride = segments + 1;
  const step = size / segments;
  const baseHeights = new Float32Array(stride * stride);
  const noiseOffset = getNoiseOffset(seed, attempt, size);

  let index = 0;
  for (let zIndex = 0; zIndex < stride; zIndex++) {
    const z = -halfSize + zIndex * step;
    for (let xIndex = 0; xIndex < stride; xIndex++) {
      const x = -halfSize + xIndex * step;
      const coastData = computeCoastData(x, z, halfSize, size);
      baseHeights[index] = getElevation(
        x,
        z,
        seaLevel,
        coastData,
        noiseOffset,
        halfSize,
        size,
      );
      index += 1;
    }
  }

  return baseHeights;
}

export function runTerrainValidationDev({
  seedStart = DEFAULT_SEED_START,
  seedCount = 50,
  attempts = TERRAIN_VALIDATION_ATTEMPTS,
} = {}) {
  const isDev = Boolean(import.meta?.env?.DEV);
  if (!isDev) {
    console.warn(
      "[TerrainValidationDev] Skipping dev validation run outside development mode.",
    );
    return null;
  }

  const seaLevel = getSeaLevelY();
  const size = TERRAIN_SIZE;
  const segments = DEFAULT_SEGMENTS;
  const halfSize = size * 0.5;
  const failureCounts = new Map();
  let failureTotal = 0;

  for (let seedIndex = 0; seedIndex < seedCount; seedIndex++) {
    const seed = seedStart + seedIndex;
    let validationResult = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const baseHeights = buildBaseHeights({
        seed,
        attempt,
        size,
        segments,
        seaLevel,
        halfSize,
      });

      validationResult = validateTerrain({
        baseHeights,
        segments,
        size,
        seaLevel,
        seaSide: SEA_SIDE,
      });

      if (validationResult.valid) break;
    }

    if (!validationResult || !validationResult.valid) {
      failureTotal += 1;
      const failures = validationResult?.failures ?? ["unknown"];
      for (const failure of failures) {
        failureCounts.set(failure, (failureCounts.get(failure) ?? 0) + 1);
      }
    }
  }

  const failureRate = seedCount > 0 ? failureTotal / seedCount : 0;
  const failureSummary = Array.from(failureCounts.entries()).sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
  );

  console.log(
    "[TerrainValidationDev] Runs:",
    seedCount,
    "Start:",
    seedStart,
  );
  console.log(
    "[TerrainValidationDev] Failures:",
    failureTotal,
    `(${(failureRate * 100).toFixed(2)}%)`,
  );
  if (failureSummary.length > 0) {
    console.table(
      failureSummary.map(([reason, count]) => ({ reason, count })),
    );
  }

  return {
    seedCount,
    seedStart,
    attempts,
    segments,
    size,
    failureTotal,
    failureRate,
    failureSummary,
  };
}

if (import.meta?.env?.DEV && typeof window !== "undefined") {
  window.runTerrainValidationDev = runTerrainValidationDev;
}
