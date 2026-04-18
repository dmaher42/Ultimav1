import * as THREE from "three";
import {
  CITY_CHUNK_CENTER,
  CITY_SEED,
  getSeaLevelY,
  CITY_AREA_RADIUS,
  AGORA_CENTER_3D,
  ACROPOLIS_PEAK_3D,
  HARBOR_CENTER_3D,
  HARBOR_WATER_BOUNDS,
  AEGEAN_OCEAN_BOUNDS,
} from "./locations.js";

function sampleHeight(terrain, x, z, fallback) {
  const getter = terrain?.userData?.getHeightAt;
  if (typeof getter === "function") {
    const height = getter(x, z);
    if (Number.isFinite(height)) return height;
  }
  return fallback;
}

function isWithinRect(x, z, rect) {
  if (!rect) return false;
  const west = Math.min(rect.west, rect.east);
  const east = Math.max(rect.west, rect.east);
  const south = Math.min(rect.south, rect.north);
  const north = Math.max(rect.south, rect.north);
  return x >= west && x <= east && z >= south && z <= north;
}

function isInLegacyHarborExclusion(x, z) {
  const harborNorth = Math.max(HARBOR_WATER_BOUNDS.north, HARBOR_WATER_BOUNDS.south);
  const harborSouth = Math.min(HARBOR_WATER_BOUNDS.north, HARBOR_WATER_BOUNDS.south);
  const harborFrontWest = HARBOR_CENTER_3D.x - 72;

  return (
    isWithinRect(x, z, HARBOR_WATER_BOUNDS) ||
    isWithinRect(x, z, AEGEAN_OCEAN_BOUNDS) ||
    (x >= harborFrontWest && z >= harborSouth - 68 && z <= harborNorth + 68)
  );
}

function isInLegacyCivicCoreExclusion(x, z) {
  const agoraDistance = Math.hypot(x - AGORA_CENTER_3D.x, z - AGORA_CENTER_3D.z);
  const acropolisDistance = Math.hypot(x - ACROPOLIS_PEAK_3D.x, z - ACROPOLIS_PEAK_3D.z);
  return agoraDistance <= 44 || acropolisDistance <= 34;
}

function isInLegacyNeighborhoodBand(x, z, origin, band) {
  if (isInLegacyHarborExclusion(x, z) || isInLegacyCivicCoreExclusion(x, z)) {
    return false;
  }

  const radius = Math.hypot(x - origin.x, z - origin.z);
  const harborApproachLimit = HARBOR_CENTER_3D.x - 34;

  if (x >= harborApproachLimit) {
    return false;
  }

  if (band === "inner") {
    return radius >= 20 && radius <= 74 && z <= origin.z + 18;
  }

  if (band === "middle") {
    return radius >= 42 && radius <= 108 && z <= origin.z + 54;
  }

  if (band === "outer") {
    return radius >= 82 && radius <= 128 && (x <= origin.x + 12 || z <= origin.z - 6);
  }

  return false;
}

export function createCityLayoutMetadata(terrain, options = {}) {
  const origin = options.origin ? options.origin.clone() : CITY_CHUNK_CENTER.clone();
  const seaLevel = Number.isFinite(options.seaLevel) ? options.seaLevel : getSeaLevelY();
  const rng = (seed) => {
    let s = seed;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  };
  const random = rng(options.seed ?? CITY_SEED);

  const roadCurves = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + random() * 0.4;
    const start = origin.clone();
    const end = new THREE.Vector3(
      origin.x + Math.cos(angle) * CITY_AREA_RADIUS,
      origin.y,
      origin.z + Math.sin(angle) * CITY_AREA_RADIUS,
    );
    const mid = start.clone().lerp(end, 0.5);
    mid.x += (random() - 0.5) * 30;
    mid.z += (random() - 0.5) * 30;
    [start, mid, end].forEach((point) => {
      point.y = sampleHeight(terrain, point.x, point.z, origin.y) + 0.05;
    });
    roadCurves.push(new THREE.CatmullRomCurve3([start, mid, end]));
  }

  const roadSamples = roadCurves.map((curve) => curve.getSpacedPoints(60));
  const placedPoints = [];
  const buildingPlacements = [];

  const sampleElevation = (x, z) => {
    const oceanHeight = seaLevel - 12.0;
    const cityHeight = seaLevel + 4.0;
    let baseHeight = cityHeight;

    if (z < -100) {
      baseHeight = oceanHeight;
    } else if (z <= -40) {
      const t = (z + 100) / 60;
      baseHeight = THREE.MathUtils.lerp(oceanHeight, cityHeight, t);
    }

    if (z > -40 && baseHeight < seaLevel + 2.0) {
      baseHeight = seaLevel + 2.0;
    }

    const sampled = sampleHeight(terrain, x, z, baseHeight);
    return Number.isFinite(sampled) ? sampled : baseHeight;
  };

  const findNearestRoad = (x, z) => {
    let bestDist = Infinity;
    let bestCurve = null;
    let bestT = 0;
    roadCurves.forEach((curve, idx) => {
      const samples = roadSamples[idx];
      for (let s = 0; s < samples.length; s++) {
        const pt = samples[s];
        const d = Math.hypot(x - pt.x, z - pt.z);
        if (d < bestDist) {
          bestDist = d;
          bestCurve = curve;
          bestT = s / (samples.length - 1);
        }
      }
    });
    return { bestDist, bestCurve, bestT };
  };

  const gridSize = 20;
  const spatialGrid = {};
  const getGridKey = (x, z) => `${Math.floor(x / gridSize)},${Math.floor(z / gridSize)}`;
  const addToSpatialGrid = (point) => {
    const key = getGridKey(point.x, point.z);
    if (!spatialGrid[key]) spatialGrid[key] = [];
    spatialGrid[key].push(point);
  };

  const canPlace = (x, z, radius) => {
    const gx = Math.floor(x / gridSize);
    const gz = Math.floor(z / gridSize);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${gx + dx},${gz + dz}`;
        const points = spatialGrid[key];
        if (points) {
          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const dx_ = x - p.x;
            const dz_ = z - p.z;
            if (dx_ * dx_ + dz_ * dz_ < (radius + p.radius) * (radius + p.radius)) {
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  const placeBand = (config) => {
    let placed = 0;
    let attempts = 0;

    while (placed < config.count && attempts < config.count * config.maxAttemptsMultiplier) {
      attempts++;
      const r = config.radiusStart + Math.sqrt(random()) * config.radiusSpan;
      const theta = random() * Math.PI * 2;
      const x = origin.x + r * Math.cos(theta);
      const z = origin.z + r * Math.sin(theta);
      if (!isInLegacyNeighborhoodBand(x, z, origin, config.band)) continue;

      const y = sampleElevation(x, z);
      if (!Number.isFinite(y) || y < seaLevel + config.minSeaClearance) continue;
      if (config.minAbsoluteHeight != null && y <= seaLevel + config.minAbsoluteHeight) continue;

      const { bestDist, bestCurve, bestT } = findNearestRoad(x, z);
      if (config.maxRoadDistance != null && bestDist > config.maxRoadDistance) continue;
      if (config.minRoadDistance != null && bestDist < config.minRoadDistance) continue;

      const neighborRadius = Math.max(config.width, config.depth) * 0.5 + config.spacingPadding;
      if (!canPlace(x, z, neighborRadius)) continue;

      let angle = 0;
      if (bestCurve) {
        const tangent = bestCurve.getTangent(bestT);
        angle = Math.atan2(tangent.x, tangent.z);
      }
      angle += THREE.MathUtils.degToRad((random() - 0.5) * config.angleJitterDeg);

      const newPoint = { x, z, radius: neighborRadius };
      placedPoints.push(newPoint);
      addToSpatialGrid(newPoint);
      
      buildingPlacements.push({
        x,
        z,
        rotation: angle,
        width: config.width,
        depth: config.depth,
      });
      placed++;
    }
  };

  placeBand({
    band: "inner",
    count: 320,
    maxAttemptsMultiplier: 8,
    radiusStart: 18,
    radiusSpan: 56,
    width: 2.5,
    depth: 2.5,
    spacingPadding: 0.5,
    angleJitterDeg: 60,
    minSeaClearance: 0.5,
    maxRoadDistance: 18,
    minRoadDistance: 2,
  });

  placeBand({
    band: "middle",
    count: 220,
    maxAttemptsMultiplier: 8,
    radiusStart: 44,
    radiusSpan: 62,
    width: 4.0,
    depth: 4.0,
    spacingPadding: 2.0,
    angleJitterDeg: 12,
    minSeaClearance: 0.5,
    maxRoadDistance: 20,
    minRoadDistance: 3,
  });

  placeBand({
    band: "outer",
    count: 70,
    maxAttemptsMultiplier: 12,
    radiusStart: 86,
    radiusSpan: 40,
    width: 6.0,
    depth: 6.0,
    spacingPadding: 8.0,
    angleJitterDeg: 30,
    minSeaClearance: 0.5,
    minAbsoluteHeight: 6.5,
    minRoadDistance: 3,
  });

  return {
    roadCurves,
    buildingPlacements,
  };
}
