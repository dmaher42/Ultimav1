import * as THREE from "three";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { AGORA_CENTER_3D } from "./locations.js";

const DEFAULT_SEARCH_RADIUS = 80;
const DEFAULT_INNER_RADIUS = 10;
const DEFAULT_RADIAL_STEP = 4;
const DEFAULT_ARC_LENGTH = 6;
const DEFAULT_SLOPE_SAMPLE = 2;
const DEFAULT_MAX_SLOPE = 0.55;

const _workVec = new THREE.Vector3();
const _fallbackVec = new THREE.Vector3();
const _centerVec = new THREE.Vector3();
const _capsule = new Capsule();

export function getDefaultRespawnPoint() {
  return AGORA_CENTER_3D.clone();
}

const toVector3 = (value, target = new THREE.Vector3()) => {
  if (value instanceof THREE.Vector3) {
    return target.copy(value);
  }

  if (value && typeof value === "object") {
    const { x = 0, y = 0, z = 0 } = value;
    return target.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
  }

  return target.set(0, 0, 0);
};

const sampleHeight = (terrain, x, z) => {
  const sampler = terrain?.userData?.getHeightAt;
  if (typeof sampler !== "function") return null;
  const height = sampler(x, z);
  return Number.isFinite(height) ? height : null;
};

const slopeIsAcceptable = (
  terrain,
  x,
  z,
  baseHeight,
  spacing,
  maxSlope
) => {
  if (!(terrain && Number.isFinite(baseHeight))) return false;
  const dist = Math.max(spacing, 0.5);
  const east = sampleHeight(terrain, x + dist, z);
  const west = sampleHeight(terrain, x - dist, z);
  const north = sampleHeight(terrain, x, z + dist);
  const south = sampleHeight(terrain, x, z - dist);

  if (
    east === null ||
    west === null ||
    north === null ||
    south === null
  ) {
    return false;
  }

  const slopeX = Math.max(
    Math.abs(east - baseHeight),
    Math.abs(baseHeight - west)
  );
  const slopeZ = Math.max(
    Math.abs(north - baseHeight),
    Math.abs(baseHeight - south)
  );

  const slope = Math.hypot(slopeX, slopeZ) / dist;
  return slope <= maxSlope;
};

const evaluateCandidate = (
  envCollider,
  terrain,
  x,
  z,
  {
    halfHeight,
    baseClearance,
    seaLevel,
    minAboveSea,
    horizontalBuffer,
    slopeSpacing,
    maxSlope,
  }
) => {
  const groundHeight = sampleHeight(terrain, x, z);
  if (groundHeight === null) return null;

  if (
    Number.isFinite(seaLevel) &&
    groundHeight < seaLevel + (Number.isFinite(minAboveSea) ? minAboveSea : 0)
  ) {
    return null;
  }

  if (!slopeIsAcceptable(terrain, x, z, groundHeight, slopeSpacing, maxSlope)) {
    return null;
  }

  const expandedRadius = Math.max(0, horizontalBuffer);
  const spawnY = groundHeight + halfHeight + baseClearance;
  const startY = spawnY - halfHeight + expandedRadius;
  const endY = spawnY + halfHeight - expandedRadius;
  if (endY <= startY) return null;

  _capsule.radius = expandedRadius;
  _capsule.start.set(x, startY, z);
  _capsule.end.set(x, endY, z);

  if (envCollider?.capsuleIntersect?.(_capsule)) {
    return null;
  }

  return _workVec.set(x, spawnY, z);
};

/**
 * Attempts to locate a collision-free spawn point for the player near a target area.
 *
 * @param {Object} [options]
 * @param {import("../env/EnvironmentCollider.js").EnvironmentCollider} [options.envCollider]
 * @param {THREE.Object3D} [options.terrain]
 * @param {THREE.Vector3 | Object} [options.searchCenter]
 * @param {THREE.Vector3 | Object} [options.fallback]
 * @param {number} [options.playerHeight]
 * @param {number} [options.playerRadius]
 * @param {number} [options.verticalClearance]
 * @param {number} [options.horizontalClearance]
 * @param {number} [options.searchRadius]
 * @param {number} [options.innerRadius]
 * @param {number} [options.radialStep]
 * @param {number} [options.arcLength]
 * @param {number} [options.slopeSampleDistance]
 * @param {number} [options.maxSlope]
 * @param {number} [options.seaLevel]
 * @param {number} [options.minAboveSea]
 * @returns {THREE.Vector3}
 */
export function findSafePlayerSpawn(options = {}) {
  const {
    envCollider,
    terrain,
    searchCenter,
    fallback,
    playerHeight = 1.8,
    playerRadius = 0.35,
    verticalClearance = 0.15,
    horizontalClearance = 0.35,
    searchRadius = DEFAULT_SEARCH_RADIUS,
    innerRadius = DEFAULT_INNER_RADIUS,
    radialStep = DEFAULT_RADIAL_STEP,
    arcLength = DEFAULT_ARC_LENGTH,
    slopeSampleDistance = DEFAULT_SLOPE_SAMPLE,
    maxSlope = DEFAULT_MAX_SLOPE,
    seaLevel = undefined,
    minAboveSea = 0.25,
  } = options;

  const fallbackPosition = toVector3(
    fallback ?? { x: 0, y: 0, z: 10 },
    _fallbackVec
  );
  const resolvedCenter = toVector3(
    searchCenter ?? fallbackPosition,
    _centerVec
  );

  const halfHeight = Math.max(playerHeight * 0.5, playerRadius + 0.1);
  const maxExtraRadius = Math.max(0, halfHeight - playerRadius - 0.05);
  const expandedBuffer = Math.min(Math.max(horizontalClearance, 0), maxExtraRadius);
  const baseClearance = Math.max(verticalClearance, 0.1) + 0.02;

  const config = {
    halfHeight,
    baseClearance,
    seaLevel,
    minAboveSea,
    horizontalBuffer: playerRadius + expandedBuffer,
    slopeSpacing: Math.max(slopeSampleDistance, 0.5),
    maxSlope: Math.max(maxSlope, 0),
  };

  const sampler = terrain?.userData?.getHeightAt;
  if (typeof sampler !== "function") {
    return fallbackPosition.clone();
  }

  const maybeReturn = (candidate) => {
    if (!candidate) return null;
    return candidate.clone();
  };

  let candidate = evaluateCandidate(
    envCollider,
    terrain,
    fallbackPosition.x,
    fallbackPosition.z,
    config
  );
  if (candidate) return maybeReturn(candidate);

  candidate = evaluateCandidate(
    envCollider,
    terrain,
    resolvedCenter.x,
    resolvedCenter.z,
    config
  );
  if (candidate) return maybeReturn(candidate);

  const preferredOffsets = [
    [12, 0],
    [-12, 0],
    [0, 12],
    [0, -12],
    [18, 8],
    [-18, -8],
  ];

  for (const [dx, dz] of preferredOffsets) {
    candidate = evaluateCandidate(
      envCollider,
      terrain,
      resolvedCenter.x + dx,
      resolvedCenter.z + dz,
      config
    );
    if (candidate) return maybeReturn(candidate);
  }

  const effectiveInner = Math.max(innerRadius, playerRadius + 2);
  const maxRadius = Math.max(effectiveInner, searchRadius);
  const radialStepSize = Math.max(radialStep, 2);
  const arc = Math.max(arcLength, 4);

  for (let radius = effectiveInner; radius <= maxRadius; radius += radialStepSize) {
    const circumference = Math.max(arc, Math.PI * 2 * radius);
    const steps = Math.max(8, Math.round(circumference / arc));
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      const x = resolvedCenter.x + Math.cos(angle) * radius;
      const z = resolvedCenter.z + Math.sin(angle) * radius;
      candidate = evaluateCandidate(envCollider, terrain, x, z, config);
      if (candidate) return maybeReturn(candidate);
    }
  }

  const fallbackHeight = sampleHeight(terrain, fallbackPosition.x, fallbackPosition.z);
  if (Number.isFinite(fallbackHeight)) {
    const spawnY =
      fallbackHeight + config.halfHeight + Math.max(verticalClearance, 0.1);
    return new THREE.Vector3(
      fallbackPosition.x,
      spawnY,
      fallbackPosition.z
    );
  }

  const finalFallback = fallbackPosition.clone();
  finalFallback.y += config.halfHeight + config.baseClearance;
  return finalFallback;
}

export default findSafePlayerSpawn;
