import * as THREE from 'three';
import { ACROPOLIS_PEAK_3D, AGORA_CENTER_3D, HARBOR_CENTER_3D, HARBOR_SETBACKS, HARBOR_WATER_BOUNDS, CITY_CENTER_ORIGIN, getCityGroundY, getSeaLevelY } from './locations.js';
import { resolveBaseUrl, joinPath } from '../utils/baseUrl.js';
import { applyNormalMapConvention } from "../materials/normalMapUtils.js";
import { IS_DEV } from '../utils/env.js';
import { Prefabs, spawnBuilding, poolMaterialsAndMerge } from './buildingSpawner.js';
import { loadDistrictRules } from './districtRules.js';
import { roadNoise } from '../utils/noise.js';
import { 
  getSlope, 
  getAverageSlope, 
  getElevation, 
  isSlopeValidForBuilding, 
  analyzeTile,
  SLOPE_THRESHOLDS 
} from './terrainUtils.js';

/* PATCH: Harbor zone params */
export const HARBOR_ZONE = { bandWidth: 35, spacingScale: 0.7, densityBoost: 0.25 };

// Grid Constants
const MIN_X = -8, MAX_X = 8;
const MIN_Z = -8, MAX_Z = 14;
const BLOCK_SIZE = 24; // Smaller blocks make the city feel tighter and more urban.
const GRID_WARP_STRENGTH = 7.2; // Increased to deeply blur the rigid grid structure
const AGORA_PLAZA_RADIUS = 1;
const AGORA_CIVIC_RADIUS = BLOCK_SIZE * 2.5;
const AGORA_MARKET_RADIUS = BLOCK_SIZE * 4.4;
const ACROPOLIS_SACRED_RADIUS = BLOCK_SIZE * 1.4;

// District Spacing Rules
export const SPACING_RULES = {
  CIVIC_CLUSTER_MAX_DISTANCE: 30 * BLOCK_SIZE, // 30 tiles from starting point (1440m)
};

// Walkability Grid Constants
export const WALKABILITY_CONFIG = {
  PATH_SPACING: 3, // Tighter path spacing suits a denser city fabric
  MAX_PATH_SLOPE: SLOPE_THRESHOLDS.MODERATE, // 0.75 max slope for paths
  MAX_REACHABILITY_DISTANCE: 60, // Max tiles to key buildings
  KEY_LOCATIONS: {
    ACROPOLIS: { x: 0, z: -5 }, // Grid coords
    AGORA: { x: 0, z: 0 },
    HARBOR: { x: 2, z: 0 }, // City-side harbor gate, not the open waterfront
  },
};

export function inHarborBand(
  pos,
  shorelineCenter = { x: HARBOR_CENTER_3D.x, z: HARBOR_CENTER_3D.z }
) {
  if (!pos) return false;
  // Directional Logic: Harbor is East (+X)
  // Treat tiles east of the harbor center (minus a small setback) as harbor frontage.
  const harborStartX = shorelineCenter.x - HARBOR_ZONE.bandWidth;
  return pos.x >= harborStartX;
}

/**
 * Check if position is within civic cluster constraints
 * Civic clusters (Agora, Civic Core) must be within 30 tiles of starting point
 */
export function isWithinCivicClusterRange(x, z) {
  const startX = CITY_CENTER_ORIGIN.x;
  const startZ = CITY_CENTER_ORIGIN.z;
  
  const distance = Math.sqrt(
    Math.pow(x - startX, 2) + Math.pow(z - startZ, 2)
  );
  
  return distance <= SPACING_RULES.CIVIC_CLUSTER_MAX_DISTANCE;
}

/**
 * A* pathfinding algorithm to find shortest path between two grid cells
 * Avoids steep slopes and connects districts
 */
function findPath(grid, startX, startZ, endX, endZ, maxSlope = WALKABILITY_CONFIG.MAX_PATH_SLOPE) {
  const getCell = (x, z) => grid.find(c => c.gridX === x && c.gridZ === z);
  
  const start = getCell(startX, startZ);
  const end = getCell(endX, endZ);
  
  if (!start || !end) return null;

  const openSet = [start];
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(start, 0);
  fScore.set(start, heuristic(start, end));

  function heuristic(a, b) {
    return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridZ - b.gridZ);
  }

  function getNeighbors(cell) {
    const neighbors = [];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    for (const [dx, dz] of dirs) {
      const neighbor = getCell(cell.gridX + dx, cell.gridZ + dz);
      if (neighbor && !neighbor.blocked && neighbor.slope <= maxSlope) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  while (openSet.length > 0) {
    // Find cell with lowest fScore
    openSet.sort((a, b) => (fScore.get(a) || Infinity) - (fScore.get(b) || Infinity));
    const current = openSet.shift();

    if (current === end) {
      // Reconstruct path
      const path = [current];
      let temp = current;
      while (cameFrom.has(temp)) {
        temp = cameFrom.get(temp);
        path.unshift(temp);
      }
      return path;
    }

    closedSet.add(current);

    for (const neighbor of getNeighbors(current)) {
      if (closedSet.has(neighbor)) continue;

      const tentativeGScore = (gScore.get(current) || Infinity) + 1;

      if (!openSet.includes(neighbor)) {
        openSet.push(neighbor);
      } else if (tentativeGScore >= (gScore.get(neighbor) || Infinity)) {
        continue;
      }

      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentativeGScore);
      fScore.set(neighbor, tentativeGScore + heuristic(neighbor, end));
    }
  }

  return null; // No path found
}

/**
 * Generate pedestrian paths connecting all districts
 * Returns path tiles with 4-tile spacing, avoiding steep slopes
 */
export function generatePaths(grid, options = {}) {
  const {
    spacing = WALKABILITY_CONFIG.PATH_SPACING,
    avoidSteepSlopes = true,
    connectAllDistricts = true,
  } = options;

  const pathTiles = [];
  const maxSlope = avoidSteepSlopes ? WALKABILITY_CONFIG.MAX_PATH_SLOPE : Infinity;

  if (IS_DEV) console.log('[CityPlan] Generating pedestrian walkability grid...');

  // Mark existing roads as paths
  for (const cell of grid) {
    if (!cell.blocked && cell.type === 'road') {
      pathTiles.push({
        gridX: cell.gridX,
        gridZ: cell.gridZ,
        position: cell.position.clone(),
        type: 'road',
        isPath: true,
      });
    }
  }

  // Generate additional paths with spacing
  for (let x = MIN_X; x <= MAX_X; x += spacing) {
    for (let z = MIN_Z; z <= MAX_Z; z += spacing) {
      const cell = grid.find(c => c.gridX === x && c.gridZ === z);
      if (cell && !cell.blocked && cell.type !== 'road' && cell.slope <= maxSlope) {
        pathTiles.push({
          gridX: cell.gridX,
          gridZ: cell.gridZ,
          position: cell.position.clone(),
          type: 'footpath',
          slope: cell.slope,
          isPath: true,
        });
      }
    }
  }

  // Ensure connectivity to key locations
  if (connectAllDistricts) {
    const keyLocations = [
      { name: 'Acropolis', ...WALKABILITY_CONFIG.KEY_LOCATIONS.ACROPOLIS },
      { name: 'Agora', ...WALKABILITY_CONFIG.KEY_LOCATIONS.AGORA },
      { name: 'Harbor', ...WALKABILITY_CONFIG.KEY_LOCATIONS.HARBOR },
    ];

    const centerX = 0, centerZ = 0; // Starting point

    for (const location of keyLocations) {
      const path = findPath(grid, centerX, centerZ, location.x, location.z, maxSlope);
      
      if (path) {
        if (IS_DEV) console.log(`[CityPlan] Path to ${location.name}: ${path.length} tiles`);
        
        // Add path tiles
        for (const cell of path) {
          if (!pathTiles.some(p => p.gridX === cell.gridX && p.gridZ === cell.gridZ)) {
            pathTiles.push({
              gridX: cell.gridX,
              gridZ: cell.gridZ,
              position: cell.position.clone(),
              type: 'connector',
              slope: cell.slope,
              isPath: true,
            });
          }
        }
      } else {
        if (IS_DEV) console.warn(`[CityPlan] No path found to ${location.name} - terrain too steep or disconnected`);
      }
    }
  }

  if (IS_DEV) console.log(`[CityPlan] Generated ${pathTiles.length} path tiles`);
  return pathTiles;
}

/**
 * Verify reachability of key buildings within max distance
 */
export function verifyReachability(grid, pathTiles, options = {}) {
  const maxDistance = options.maxDistance || WALKABILITY_CONFIG.MAX_REACHABILITY_DISTANCE;
  const results = {
    reachable: [],
    unreachable: [],
    distances: {},
  };

  const keyLocations = [
    { name: 'Acropolis', ...WALKABILITY_CONFIG.KEY_LOCATIONS.ACROPOLIS },
    { name: 'Agora', ...WALKABILITY_CONFIG.KEY_LOCATIONS.AGORA },
    { name: 'Harbor', ...WALKABILITY_CONFIG.KEY_LOCATIONS.HARBOR },
  ];

  const centerX = 0, centerZ = 0;

  if (IS_DEV) console.log('[CityPlan] Verifying reachability to key buildings...');

  for (const location of keyLocations) {
    const path = findPath(grid, centerX, centerZ, location.x, location.z);
    
    if (path) {
      const distance = path.length;
      results.distances[location.name] = distance;

      if (distance <= maxDistance) {
        results.reachable.push(location.name);
        if (IS_DEV) console.log(`[CityPlan] Ô£à ${location.name}: reachable in ${distance} tiles`);
      } else {
        results.unreachable.push(location.name);
        if (IS_DEV) console.warn(`[CityPlan] ÔÜá´©Å  ${location.name}: ${distance} tiles (exceeds max ${maxDistance})`);
      }
    } else {
      results.unreachable.push(location.name);
      results.distances[location.name] = Infinity;
      if (IS_DEV) console.error(`[CityPlan] ÔØî ${location.name}: unreachable`);
    }
  }

  const allReachable = results.unreachable.length === 0;
  if (IS_DEV) console.log(`[CityPlan] Reachability: ${results.reachable.length}/${keyLocations.length} locations within ${maxDistance} tiles`);

  return {
    ...results,
    allReachable,
    totalLocations: keyLocations.length,
  };
}

const textureCache = new Map();

function generatePavingTexture(type, color) {
  const cacheKey = `${type}-${color}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Base color
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  if (type === 'cobble') {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 64; i++) {
        for (let j = 0; j < 64; j++) {
            const ox = (i % 2 === 0) ? 4 : 0;
            ctx.strokeRect(i * 8 + ox, j * 8, 8, 8);
            if (Math.random() < 0.1) {
                ctx.fillStyle = 'rgba(0,0,0,0.05)';
                ctx.fillRect(i * 8 + ox, j * 8, 8, 8);
            }
        }
    }
  } else if (type === 'slab') {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 16; j++) {
            const ox = (j % 2 === 0) ? 32 : 0;
            ctx.strokeRect(i * 64 + ox, j * 32, 64, 32);
        }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1.5);
  textureCache.set(cacheKey, texture);
  return texture;
}

function createPavedStrip(length, width, orientation, type, color, opacity = 1.0) {
  const geometry = new THREE.PlaneGeometry(width, length);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    map: generatePavingTexture(type === 'road' ? 'cobble' : 'slab', color),
    opacity: opacity,
    transparent: opacity < 1.0,
    roughness: type === 'road' ? 0.92 : 0.75,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function createCityFabricUnderlay(width, length, color = 0x97785a, opacity = 0.16) {
  const geometry = new THREE.PlaneGeometry(width, length);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function createReservedCourtSurface(cell) {
  if (!cell) return null;

  const seed = Math.abs(cell.gridX * 92821 ^ cell.gridZ * 68917);
  const random01 = (offset = 0) => {
    const value = seed + offset * 17.17;
    const t = value + Math.sin(value * 12.9898) * 43758.5453;
    return t - Math.floor(t);
  };

  let widthScale = 0.42 + random01(1) * 0.07;
  let lengthScale = 0.42 + random01(2) * 0.07;
  let color = 0xa88461;

  if (isAgoraMarketCourtCell(cell.gridX, cell.gridZ)) {
    widthScale = 0.5 + random01(3) * 0.08;
    lengthScale = 0.48 + random01(4) * 0.07;
    color = 0xb19271;
  } else if (isHarborUrbanFrontCell(cell.gridX, cell.gridZ)) {
    widthScale = 0.48 + random01(5) * 0.08;
    lengthScale = 0.4 + random01(6) * 0.08;
    color = 0xa68560;
  } else if (isInlandUrbanBlockCell(cell.gridX, cell.gridZ)) {
    widthScale = 0.4 + random01(7) * 0.07;
    lengthScale = 0.38 + random01(8) * 0.08;
    color = 0xa1805d;
  } else if (isOuterNeighborhoodCell(cell.gridX, cell.gridZ)) {
    widthScale = 0.36 + random01(9) * 0.06;
    lengthScale = 0.36 + random01(10) * 0.06;
    color = 0x9e7d59;
  }

  const group = new THREE.Group();
  const main = createPavedStrip(BLOCK_SIZE * lengthScale, BLOCK_SIZE * widthScale, 0, 'court', color);
  main.rotation.y = (random01(11) - 0.5) * 0.24;
  main.position.y = 0.004;
  if (main.material) {
    main.material.opacity = 0.52;
  }
  group.add(main);

  if (random01(12) < 0.18) {
    const side = createPavedStrip(BLOCK_SIZE * 0.14, BLOCK_SIZE * 0.16, 0, 'court', color + 0x060606);
    side.rotation.y = (random01(13) - 0.5) * 0.25;
    side.position.set(
      (random01(14) - 0.5) * BLOCK_SIZE * 0.24,
      0.005,
      (random01(15) - 0.5) * BLOCK_SIZE * 0.22,
    );
    if (side.material) {
      side.material.opacity = 0.36;
    }
    group.add(side);
  }

  return group;
}

function createStepFlight(width, stepDepth, stepHeight, stepCount, material) {
  const group = new THREE.Group();
  for (let i = 0; i < stepCount; i++) {
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(width, stepHeight, stepDepth),
      material.clone()
    );
    tread.position.set(0, stepHeight * 0.5 + i * stepHeight, i * stepDepth);
    tread.castShadow = true;
    tread.receiveShadow = true;
    group.add(tread);
  }
  return group;
}

function createRetainingWall(length, height, depth, material) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(length, height, depth),
    material
  );
  wall.position.y = height * 0.5;
  wall.castShadow = true;
  wall.receiveShadow = true;
  return wall;
}

function createStreetGradeAccent({
  localX,
  localZ,
  localY,
  sampleLocalHeight,
  span = 7,
  width = 6,
  roadLike = false,
}) {
  if (typeof sampleLocalHeight !== 'function') return null;

  const east = sampleLocalHeight(localX + span, localZ, localY);
  const west = sampleLocalHeight(localX - span, localZ, localY);
  const north = sampleLocalHeight(localX, localZ + span, localY);
  const south = sampleLocalHeight(localX, localZ - span, localY);

  const deltaX = east - west;
  const deltaZ = north - south;
  const dominantAxis = Math.abs(deltaX) >= Math.abs(deltaZ) ? 'x' : 'z';
  const relief = Math.abs(dominantAxis === 'x' ? deltaX : deltaZ);

  if (!Number.isFinite(relief) || relief < 0.22 || relief > 2.4) return null;

  const slopeMaterial = new THREE.MeshStandardMaterial({
    color: 0xb6a183,
    roughness: 0.92,
    metalness: 0.02,
  });
  const accent = new THREE.Group();
  accent.name = roadLike ? 'StreetStepAccent' : 'RetainingEdgeAccent';

  const wallHeight = THREE.MathUtils.clamp(relief * 0.42, 0.22, 0.95);
  const wallDepth = 0.55;
  const wallLength = width;
  const downhillSign = (dominantAxis === 'x' ? deltaX : deltaZ) > 0 ? -1 : 1;

  const wall = createRetainingWall(wallLength, wallHeight, wallDepth, slopeMaterial.clone());
  if (dominantAxis === 'x') {
    wall.rotation.y = Math.PI / 2;
    wall.position.x = downhillSign * (span * 0.72);
    wall.position.z = 0;
  } else {
    wall.position.x = 0;
    wall.position.z = downhillSign * (span * 0.72);
  }
  accent.add(wall);

  if (roadLike) {
    const stepCount = THREE.MathUtils.clamp(Math.round(relief / 0.24), 1, 4);
    const steps = createStepFlight(width * 0.6, 0.5, 0.12, stepCount, slopeMaterial.clone());
    if (dominantAxis === 'x') {
      steps.rotation.y = deltaX > 0 ? -Math.PI / 2 : Math.PI / 2;
      steps.position.x = downhillSign * (span * 0.38);
      steps.position.z = 0;
    } else {
      steps.rotation.y = deltaZ > 0 ? 0 : Math.PI;
      steps.position.x = 0;
      steps.position.z = downhillSign * (span * 0.38);
    }
    accent.add(steps);
  }

  accent.position.set(localX, localY, localZ);
  enableShadowProps(accent);
  return accent;
}

function createDistrictPlatformAccent({
  localX,
  localZ,
  localY,
  sampleLocalHeight,
  radius = 8,
  district = 'civic',
}) {
  if (typeof sampleLocalHeight !== 'function') return null;

  const east = sampleLocalHeight(localX + radius, localZ, localY);
  const west = sampleLocalHeight(localX - radius, localZ, localY);
  const north = sampleLocalHeight(localX, localZ + radius, localY);
  const south = sampleLocalHeight(localX, localZ - radius, localY);

  const maxEdge = Math.max(east, west, north, south);
  const minEdge = Math.min(east, west, north, south);
  const relief = maxEdge - minEdge;
  if (!Number.isFinite(relief) || relief < 0.28) return null;

  const platform = new THREE.Group();
  platform.name = district === 'sacred' ? 'SacredPlatformAccent' : 'CivicPlatformAccent';

  const topColor = district === 'sacred' ? 0xcdbda0 : 0xb99f7c;
  const wallColor = district === 'sacred' ? 0xb5a486 : 0xa88f6d;
  const platformHeight = THREE.MathUtils.clamp(relief * 0.35, 0.22, district === 'sacred' ? 1.05 : 0.72);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.45, 0.18, radius * 1.45),
    new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.9, metalness: 0.02 })
  );
  top.position.y = 0.09;
  platform.add(top);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92, metalness: 0.02 });
  for (const side of [
    { x: 0, z: radius * 0.72, w: radius * 1.45, d: 0.6 },
    { x: 0, z: -radius * 0.72, w: radius * 1.45, d: 0.6 },
    { x: radius * 0.72, z: 0, w: 0.6, d: radius * 1.45 },
    { x: -radius * 0.72, z: 0, w: 0.6, d: radius * 1.45 },
  ]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(side.w, platformHeight, side.d),
      wallMaterial.clone()
    );
    wall.position.set(side.x, -platformHeight * 0.5 + 0.02, side.z);
    platform.add(wall);
  }

  const stepCount = THREE.MathUtils.clamp(Math.round(platformHeight / 0.16), 1, 4);
  const steps = createStepFlight(radius * 0.52, 0.52, 0.12, stepCount, wallMaterial.clone());

  const dominantSides = [
    { key: 'south', value: localY - south, rot: 0, x: 0, z: radius * 0.42 },
    { key: 'north', value: localY - north, rot: Math.PI, x: 0, z: -radius * 0.42 },
    { key: 'west', value: localY - west, rot: Math.PI / 2, x: radius * 0.42, z: 0 },
    { key: 'east', value: localY - east, rot: -Math.PI / 2, x: -radius * 0.42, z: 0 },
  ].sort((a, b) => b.value - a.value);

  const entrySide = dominantSides[0];
  if (entrySide && entrySide.value > 0.08) {
    steps.rotation.y = entrySide.rot;
    steps.position.set(entrySide.x, 0, entrySide.z);
    platform.add(steps);
  }

  platform.position.set(localX, localY, localZ);
  enableShadowProps(platform);
  return platform;
}

function enableShadowProps(group) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function createBannerStand(color = 0xc99b43) {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 3.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a6449, roughness: 0.78, metalness: 0.04 }),
  );
  pole.position.y = 1.8;
  group.add(pole);

  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.6),
    new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.02,
    }),
  );
  cloth.position.set(0.6, 2.3, 0);
  group.add(cloth);

  enableShadowProps(group);
  return group;
}

function createAgoraPlazaAccent() {
  const group = new THREE.Group();
  group.name = "AgoraPlazaAccent";

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 6.1, 0.45, 18),
    new THREE.MeshStandardMaterial({ color: 0xb7a07b, roughness: 0.88, metalness: 0.03 }),
  );
  plinth.position.y = 0.22;
  group.add(plinth);

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.7, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0xcbbca1, roughness: 0.82, metalness: 0.03 }),
  );
  basin.position.y = 0.62;
  group.add(basin);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 2.7, 12),
    new THREE.MeshStandardMaterial({ color: 0xc7b79b, roughness: 0.78, metalness: 0.03 }),
  );
  pillar.position.y = 2;
  group.add(pillar);

  for (const [x, z, rot] of [
    [-7, -7, 0.08],
    [7, -7, -0.05],
    [-7, 7, 0.03],
    [7, 7, -0.08],
  ]) {
    const banner = createBannerStand(0xd0a046);
    banner.position.set(x, 0, z);
    banner.rotation.y = rot;
    group.add(banner);
  }

  enableShadowProps(group);
  return group;
}

function createAgoraPerimeterAccent(gridX, gridZ) {
  const group = new THREE.Group();
  group.name = "AgoraPerimeterAccent";

  const absX = Math.abs(gridX);
  const absZ = Math.abs(gridZ);
  const isCorner = absX === AGORA_PLAZA_RADIUS && absZ === AGORA_PLAZA_RADIUS;

  if (isCorner) {
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.45, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xbda989, roughness: 0.84, metalness: 0.02 }),
    );
    podium.position.set(0, 0.22, 0);
    group.add(podium);

    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.24, 1.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xbe8a63, roughness: 0.68, metalness: 0.04 }),
    );
    jar.position.set(-0.8, 0.92, 0.1);
    group.add(jar);

    const banner = createBannerStand(0xb8843a);
    banner.position.set(1.15, 0, 0);
    group.add(banner);
  } else {
    const stylobate = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.36, 2.8),
      new THREE.MeshStandardMaterial({ color: 0xbca98b, roughness: 0.86, metalness: 0.02 }),
    );
    stylobate.position.set(0, 0.18, 0.35);
    group.add(stylobate);

    for (const x of [-3.1, 0, 3.1]) {
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 3.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xcab99d, roughness: 0.76, metalness: 0.02 }),
      );
      column.position.set(x, 1.78, 0.55);
      group.add(column);
    }

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.32, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xc1ae90, roughness: 0.8, metalness: 0.02 }),
    );
    lintel.position.set(0, 3.42, 0.55);
    group.add(lintel);

    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.42, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xad9878, roughness: 0.86, metalness: 0.02 }),
    );
    bench.position.set(0, 0.64, -1.1);
    group.add(bench);
  }

  enableShadowProps(group);
  return group;
}

function createCommercialAccent(rng) {
  const group = new THREE.Group();
  group.name = "CommercialAccent";

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.18, 1.8),
    new THREE.MeshStandardMaterial({ color: rng() < 0.5 ? 0xc06b3c : 0xd4b064, roughness: 0.74, metalness: 0.02 }),
  );
  awning.position.set(0, 2.2, 1.6);
  group.add(awning);

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.6, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x8b6a46, roughness: 0.84, metalness: 0.02 }),
  );
  crate.position.set(-0.8, 0.3, 2.2);
  group.add(crate);

  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.16, 0.72, 10),
    new THREE.MeshStandardMaterial({ color: 0xc08a66, roughness: 0.64, metalness: 0.05 }),
  );
  jar.position.set(0.9, 0.36, 2.1);
  group.add(jar);

  enableShadowProps(group);
  return group;
}

function createMarketCourtAccent(rng) {
  const group = new THREE.Group();
  group.name = "MarketCourtAccent";

  const stallA = createCommercialAccent(rng);
  stallA.position.set(0, 0, 0);
  stallA.rotation.y = Math.PI / 2;
  stallA.scale.setScalar(0.92);
  group.add(stallA);

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.18, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x8a6944, roughness: 0.84, metalness: 0.02 }),
  );
  bench.position.set(0, 0.72, 1.65);
  group.add(bench);

  enableShadowProps(group);
  return group;
}

function createUrbanCourtAccent(rng) {
  const group = new THREE.Group();
  group.name = "UrbanCourtAccent";

  const benchA = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x8a6944, roughness: 0.84, metalness: 0.02 }),
  );
  benchA.position.set(-1.15, 0.64, 0.55);
  group.add(benchA);

  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.12, 0.68, 10),
    new THREE.MeshStandardMaterial({ color: 0xc08a66, roughness: 0.68, metalness: 0.03 }),
  );
  jar.position.set(0.75, 0.34, -0.85);
  group.add(jar);

  enableShadowProps(group);
  return group;
}

function createResidentialAccent(rng) {
  const group = new THREE.Group();
  group.name = "ResidentialAccent";

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.16, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x8a6944, roughness: 0.84, metalness: 0.02 }),
  );
  bench.position.set(0, 0.62, 1.8);
  group.add(bench);

  for (const x of [-0.65, 0.65]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xb59f7f, roughness: 0.86, metalness: 0.02 }),
    );
    leg.position.set(x, 0.25, 1.8);
    group.add(leg);
  }

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5b3d, roughness: 0.88, metalness: 0.02 }),
  );
  trunk.position.set(-1.55, 1.2, -1.2);
  group.add(trunk);

  for (const [x, y, z, r] of [
    [-1.75, 2.35, -1.1, 0.85],
    [-1.1, 2.2, -1.05, 0.7],
    [-1.45, 2.7, -1.45, 0.78],
  ]) {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x5f7d42, roughness: 0.9, metalness: 0.0 }),
    );
    crown.position.set(x, y, z);
    group.add(crown);
  }

  for (const [x, z] of [[1.05, 1.2], [1.45, 1.45]]) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.12, 0.66, 10),
      new THREE.MeshStandardMaterial({ color: 0xc08a66, roughness: 0.68, metalness: 0.03 }),
    );
    jar.position.set(x, 0.33, z);
    group.add(jar);
  }

  enableShadowProps(group);
  return group;
}

function createCypress(rng) {
  const group = new THREE.Group();
  const height = 3.5 + rng() * 1.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.15, height * 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 })
  );
  trunk.position.y = height * 0.1;
  group.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(0.5 + rng() * 0.3, height * 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a331a, roughness: 1.0 })
  );
  foliage.position.y = height * 0.55;
  group.add(foliage);
  return group;
}

function createOlive(rng) {
  const group = new THREE.Group();
  const trunkHeight = 1.0 + rng() * 0.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 1.0 })
  );
  trunk.position.y = trunkHeight * 0.5;
  group.add(trunk);

  const canopyCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < canopyCount; i++) {
    const size = 0.8 + rng() * 1.0;
    const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.9 })
    );
    foliage.scale.set(1.4, 0.8, 1.4);
    foliage.position.set(
        (rng() - 0.5) * 1.5,
        trunkHeight + (rng() * 0.8),
        (rng() - 0.5) * 1.5
    );
    group.add(foliage);
  }
  return group;
}

function createFountain() {
    const group = new THREE.Group();
    const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.4, 0.4, 12),
        new THREE.MeshStandardMaterial({ color: 0xdfd3bc, roughness: 0.4 })
    );
    basin.position.y = 0.2;
    group.add(basin);

    const water = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a90e2, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.7 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.35;
    group.add(water);

    const spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0xdfd3bc })
    );
    spout.position.y = 0.6;
    group.add(spout);

    return group;
}

function createMedPark(cell, rng) {
  const group = new THREE.Group();
  group.name = "MedPark";
  
  // Base slab
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCK_SIZE * 0.96, 0.2, BLOCK_SIZE * 0.96),
    new THREE.MeshStandardMaterial({ 
        color: 0xdfd3bc, 
        map: generatePavingTexture('slab', 0xdfd3bc),
        roughness: 0.6 
    })
  );
  base.position.y = 0.1;
  group.add(base);

  // Garden plots
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const plot = new THREE.Mesh(
          new THREE.PlaneGeometry(BLOCK_SIZE * 0.35, BLOCK_SIZE * 0.35),
          new THREE.MeshStandardMaterial({ color: 0x3d5a2a, roughness: 1.0 })
      );
      plot.rotation.x = -Math.PI / 2;
      plot.position.set(x * BLOCK_SIZE * 0.25, 0.22, z * BLOCK_SIZE * 0.25);
      group.add(plot);

      const tree = rng() < 0.5 ? createCypress(rng) : createOlive(rng);
      tree.position.set(x * BLOCK_SIZE * 0.25, 0.22, z * BLOCK_SIZE * 0.25);
      tree.scale.multiplyScalar(0.7);
      group.add(tree);
  }

  // Center feature
  const fountain = createFountain();
  fountain.scale.multiplyScalar(0.6);
  fountain.position.y = 0.1;
  group.add(fountain);

  enableShadowProps(group);
  return group;
}

function createTree(rng) {
  const group = new THREE.Group();
  const height = 1.8 + rng() * 1.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, height, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5b3d, roughness: 0.85 })
  );
  trunk.position.y = height * 0.5;
  group.add(trunk);
  
  const crownCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < crownCount; i++) {
    const size = 0.6 + rng() * 0.8;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.9 })
    );
    crown.position.set(
      (rng() - 0.5) * 0.5,
      height + (rng() * 0.5),
      (rng() - 0.5) * 0.5
    );
    group.add(crown);
  }
  return group;
}

function createPocketPark(cell, rng) {
  const group = new THREE.Group();
  group.name = "PocketPark";
  
  // Low stone border or curb
  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCK_SIZE * 0.85, 0.25, BLOCK_SIZE * 0.85),
    new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.9 })
  );
  curb.position.y = 0.12;
  group.add(curb);

  // Grass/Garden soil area
  const lawnWidth = BLOCK_SIZE * 0.78;
  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(lawnWidth, lawnWidth),
    new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 1.0, side: THREE.DoubleSide })
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.26;
  group.add(lawn);
  
  // Central Feature: Either a big tree or a small stone monument
  if (rng() < 0.6) {
    const tree = rng() < 0.5 ? createOlive(rng) : createCypress(rng);
  tree.scale.multiplyScalar(0.7);
  tree.position.set(1.4, 0, -1.2);
  group.add(tree);
  } else {
    const monument = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.0, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xcbbba1, roughness: 0.7 })
    );
    monument.position.y = 0.8;
    group.add(monument);
  }

  // Scattered shrubs
  const shrubCount = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < shrubCount; i++) {
    const sSize = 0.3 + rng() * 0.4;
    const shrub = new THREE.Mesh(
        new THREE.SphereGeometry(sSize, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x3d5a2a, roughness: 1.0 })
    );
    shrub.position.set((rng()-0.5)*lawnWidth*0.8, 0.4, (rng()-0.5)*lawnWidth*0.8);
    group.add(shrub);
  }

  enableShadowProps(group);
  return group;
}

function createHarborFrontAccent(rng) {
  const group = new THREE.Group();
  group.name = "HarborFrontAccent";

  const cargo = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.78, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.86, metalness: 0.02 }),
  );
  cargo.position.set(-0.6, 0.39, 1.6);
  group.add(cargo);

  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.18, 0.84, 10),
    new THREE.MeshStandardMaterial({ color: 0xbd8763, roughness: 0.62, metalness: 0.04 }),
  );
  jar.position.set(0.8, 0.42, 1.9);
  group.add(jar);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.16, 1.5),
    new THREE.MeshStandardMaterial({ color: rng() < 0.5 ? 0x2e7c9a : 0x4b93aa, roughness: 0.72, metalness: 0.02 }),
  );
  canopy.position.set(0, 2.1, 1.45);
  group.add(canopy);

  enableShadowProps(group);
  return group;
}

function createHarborCompoundAccent(rng) {
  const group = new THREE.Group();
  group.name = "HarborCompoundAccent";

  const forecourt = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 0.22, 7.2),
    new THREE.MeshStandardMaterial({ color: 0xb59c79, roughness: 0.9, metalness: 0.02 }),
  );
  forecourt.position.y = 0.11;
  group.add(forecourt);

  const stoaBase = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.5, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xc2b093, roughness: 0.86, metalness: 0.02 }),
  );
  stoaBase.position.set(0, 0.25, -1.8);
  group.add(stoaBase);

  for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 3.0, 12),
      new THREE.MeshStandardMaterial({ color: 0xd3c3a7, roughness: 0.74, metalness: 0.02 }),
    );
    column.position.set(x, 1.95, -0.8);
    group.add(column);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.28, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xc7b596, roughness: 0.8, metalness: 0.02 }),
  );
  lintel.position.set(0, 3.4, -0.8);
  group.add(lintel);

  const cargoShed = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.4, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x8c6f4d, roughness: 0.84, metalness: 0.02 }),
  );
  cargoShed.position.set(2.4, 1.2, 1.7);
  group.add(cargoShed);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.18, 2.4),
    new THREE.MeshStandardMaterial({ color: rng() < 0.5 ? 0xb86d3f : 0x3d7f97, roughness: 0.72, metalness: 0.02 }),
  );
  canopy.position.set(-2.2, 2.0, 2.1);
  group.add(canopy);

  for (const side of [-3.6, -0.8]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 1.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x745b40, roughness: 0.84, metalness: 0.02 }),
    );
    post.position.set(side, 0.95, 1.9);
    group.add(post);
  }

  for (const [x, z] of [[2.8, 3.0], [1.8, 3.1], [3.1, 2.3], [-2.5, 3.05]]) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.14, 0.72, 10),
      new THREE.MeshStandardMaterial({ color: 0xc08a66, roughness: 0.66, metalness: 0.03 }),
    );
    jar.position.set(x, 0.36, z);
    group.add(jar);
  }

  enableShadowProps(group);
  return group;
}

function createSacredGrove(rng) {
  const group = new THREE.Group();
  group.name = "SacredGrove";

  const boundary = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCK_SIZE * 0.9, 0.4, BLOCK_SIZE * 0.9),
    new THREE.MeshStandardMaterial({ color: 0xc4b59a, roughness: 0.8 })
  );
  boundary.position.y = 0.2;
  group.add(boundary);

  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE * 0.8, BLOCK_SIZE * 0.8),
    new THREE.MeshStandardMaterial({ color: 0x2d4a1a, roughness: 1.0 })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.42;
  group.add(soil);

  // Central ancient Olive
  const ancientOlive = createOlive(rng);
  ancientOlive.scale.multiplyScalar(1.2);
  ancientOlive.position.y = 0.4;
  group.add(ancientOlive);

  // Perimeter Cypress
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
      const cypress = createCypress(rng);
      cypress.scale.multiplyScalar(0.6);
      cypress.position.set(x * BLOCK_SIZE, 0.4, z * BLOCK_SIZE);
      group.add(cypress);
  }

  return group;
}

function createStoaPlanters(rng) {
    const group = new THREE.Group();
    for (let i = 0; i < 2; i++) {
        const planter = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.6, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xdfd3bc, roughness: 0.5 })
        );
        planter.position.set((i === 0 ? -1 : 1) * 1.5, 0.3, 1.2);
        group.add(planter);

        const plant = createCypress(rng);
        plant.scale.multiplyScalar(0.35);
        plant.position.set((i === 0 ? -1 : 1) * 1.5, 0.6, 1.2);
        group.add(plant);
    }
    return group;
}

function createSacredAccent() {
  const group = new THREE.Group();
  group.name = "SacredAccent";

  for (const side of [-1.1, 1.1]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 3.8, 12),
      new THREE.MeshStandardMaterial({ color: 0xdfd3bc, roughness: 0.54, metalness: 0.03 }),
    );
    column.position.set(side, 1.9, 1.2);
    group.add(column);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.28, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xd0c1a7, roughness: 0.62, metalness: 0.03 }),
  );
  lintel.position.set(0, 3.7, 1.2);
  group.add(lintel);

  const altar = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.9, 1.1),
    new THREE.MeshStandardMaterial({ color: 0xc4b59a, roughness: 0.76, metalness: 0.03 }),
  );
  altar.position.set(0, 0.45, -1.2);
  group.add(altar);

  const flame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffd28b,
      emissive: 0xffc36f,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0,
    }),
  );
  flame.position.set(0, 1.15, -1.2);
  group.add(flame);

  enableShadowProps(group);
  return group;
}

function isWithinSetbackRect(x, z, rect) {
  if (!rect) return false;
  const west = Math.min(rect.west, rect.east);
  const east = Math.max(rect.west, rect.east);
  const south = Math.min(rect.south, rect.north);
  const north = Math.max(rect.south, rect.north);
  return x >= west && x <= east && z >= south && z <= north;
}

function isInAuthoredHarborFront(worldX, worldZ) {
  const harborNorth = Math.max(HARBOR_WATER_BOUNDS.north, HARBOR_WATER_BOUNDS.south);
  const harborSouth = Math.min(HARBOR_WATER_BOUNDS.north, HARBOR_WATER_BOUNDS.south);
  const harborWestCutoff = HARBOR_CENTER_3D.x - BLOCK_SIZE * 3.1;
  const harborEastCutoff = HARBOR_CENTER_3D.x + BLOCK_SIZE * 0.5;
  const harborZPadding = BLOCK_SIZE * 2.45;

  return (
    worldX >= harborWestCutoff &&
    worldX <= harborEastCutoff &&
    worldZ >= harborSouth - harborZPadding &&
    worldZ <= harborNorth + harborZPadding
  );
}

function isBlockedForCityLayout(worldX, worldZ) {
  const isInSetback = HARBOR_SETBACKS?.some?.((rect) =>
    isWithinSetbackRect(worldX, worldZ, rect),
  );
  return isInSetback || isInAuthoredHarborFront(worldX, worldZ);
}

function resolveDistrictForCell(worldX, worldZ) {
  const harborDistance = Math.hypot(worldX - HARBOR_CENTER_3D.x, worldZ - HARBOR_CENTER_3D.z);
  const agoraDistance = Math.hypot(worldX - AGORA_CENTER_3D.x, worldZ - AGORA_CENTER_3D.z);
  const acropolisDistance = Math.hypot(worldX - ACROPOLIS_PEAK_3D.x, worldZ - ACROPOLIS_PEAK_3D.z);

  if (harborDistance <= BLOCK_SIZE * 3.1 || worldX >= HARBOR_CENTER_3D.x - BLOCK_SIZE * 1.25) {
    return "harbor";
  }

  if (acropolisDistance <= ACROPOLIS_SACRED_RADIUS) {
    return "sacred";
  }

  if (agoraDistance <= AGORA_CIVIC_RADIUS && isWithinCivicClusterRange(worldX, worldZ)) {
    return "civic";
  }

  if (agoraDistance <= AGORA_MARKET_RADIUS && isWithinCivicClusterRange(worldX, worldZ)) {
    return "commercial";
  }

  if (agoraDistance <= AGORA_MARKET_RADIUS + BLOCK_SIZE * 1.4 && isWithinCivicClusterRange(worldX, worldZ)) {
    return "commercial";
  }

  return "residential";
}

function resolveDistrictRuleForCell(district, rulesManifest, cell = null) {
  const match = rulesManifest?.districts?.find?.((rule) => rule?.id === district);
  if (!match) return null;

  const civicDistance = cell
    ? Math.hypot(cell.position.x - AGORA_CENTER_3D.x, cell.position.z - AGORA_CENTER_3D.z)
    : Infinity;

  if (district === 'civic') {
    if (cell && isAgoraUrbanFrontCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'monument'],
        heightRange: [3.2, 4.2],
        courtyardChance: 0,
      };
    }

    return {
      ...match,
      // Keep the Agora ring focused on lower stoas and monuments instead of large temple massing.
      allowedTypes: Array.isArray(match.allowedTypes)
        ? match.allowedTypes.filter((type) => type !== 'temple')
        : ['stoa', 'monument', 'plaza'],
      heightRange: [3.4, 4.8],
      courtyardChance: 0,
    };
  }

  if (district === 'commercial' && civicDistance <= AGORA_MARKET_RADIUS + BLOCK_SIZE * 1.4) {
    if (cell && isAgoraHousingBandCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'shop', 'workshop', 'courtyard'],
        heightRange: [4.1, 5.6],
        courtyardChance: 0.05,
      };
    }

    if (cell && isAgoraMarketCourtCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'market', 'courtyard', 'shop', 'workshop'],
        heightRange: [3.4, 4.8],
        courtyardChance: 0.25,
      };
    }

    if (cell && isAgoraUrbanFrontCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'shop', 'workshop'],
        heightRange: [3.6, 4.8],
        courtyardChance: 0,
      };
    }

    return {
      ...match,
      allowedTypes: ['shop', 'market', 'workshop', 'stoa'],
      heightRange: [3.2, 4.8],
      courtyardChance: 0,
    };
  }

  if (district === 'commercial' && cell && isHarborUrbanFrontCell(cell.gridX, cell.gridZ)) {
    if (isHarborLaneFrontageCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['warehouse', 'stoa', 'workshop'],
        heightRange: [4.4, 6.2],
        courtyardChance: 0.18,
      };
    }

    return {
      ...match,
      // Bias the waterfront toward bigger working compounds and stoas so it
      // reads like a harbor district, not a row of repeated small plots.
      allowedTypes: ['warehouse', 'stoa', 'workshop', 'courtyard'],
      heightRange: [4.1, 5.8],
      courtyardChance: 0.16,
    };
  }

  if (district === 'commercial' && cell && isInlandUrbanBlockCell(cell.gridX, cell.gridZ)) {
    if (isAcropolisSlopeBandCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'workshop', 'courtyard'],
        heightRange: [4.0, 5.5],
        courtyardChance: 0.18,
      };
    }

    if (isInlandStoaEdgeCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'courtyard', 'workshop'],
        heightRange: [3.8, 5.2],
        courtyardChance: 0.45,
      };
    }

    return {
      ...match,
      allowedTypes: ['stoa', 'courtyard', 'workshop', 'shop'],
      heightRange: [3.4, 5.0],
      courtyardChance: 0.3,
    };
  }

  if (district === 'commercial' && cell && isOuterNeighborhoodCell(cell.gridX, cell.gridZ)) {
    return {
      ...match,
      allowedTypes: ['courtyard', 'workshop', 'shop'],
      heightRange: [3.4, 4.8],
      courtyardChance: 0.45,
    };
  }

  if (district === 'residential' && cell && civicDistance <= AGORA_MARKET_RADIUS + BLOCK_SIZE) {
    if (cell && isAgoraHousingBandCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'courtyard', 'workshop', 'shop'],
        heightRange: [4.0, 5.3],
        courtyardChance: 0.1,
      };
    }

    return {
      ...match,
      allowedTypes: ['shop', 'workshop', 'courtyard'],
      heightRange: [3.2, 4.4],
      courtyardChance: 0.32,
    };
  }

  if (district === 'residential' && cell && isHarborUrbanFrontCell(cell.gridX, cell.gridZ)) {
    if (isHarborLaneFrontageCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['courtyard', 'stoa', 'workshop'],
        heightRange: [4.0, 5.4],
        courtyardChance: 0.34,
      };
    }

    return {
      ...match,
      allowedTypes: ['courtyard', 'workshop', 'stoa'],
      heightRange: [3.9, 5.3],
      courtyardChance: 0.28,
    };
  }

  if (district === 'residential' && cell && isInlandUrbanBlockCell(cell.gridX, cell.gridZ)) {
    if (isAcropolisSlopeBandCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['courtyard', 'stoa', 'workshop'],
        heightRange: [3.9, 5.3],
        courtyardChance: 0.22,
      };
    }

    if (isInlandStoaEdgeCell(cell.gridX, cell.gridZ)) {
      return {
        ...match,
        allowedTypes: ['stoa', 'courtyard', 'workshop'],
        heightRange: [3.8, 5.1],
        courtyardChance: 0.62,
      };
    }

    return {
      ...match,
      allowedTypes: ['courtyard', 'workshop', 'shop', 'stoa'],
      heightRange: [3.5, 4.9],
      courtyardChance: 0.58,
    };
  }

  if (district === 'residential' && cell && isOuterNeighborhoodCell(cell.gridX, cell.gridZ)) {
    // Edge of the city / 'Slums' or Outer Farmland
    const isSlum = (cell.gridX + cell.gridZ) % 5 === 0;
    return {
      ...match,
      allowedTypes: isSlum ? ['workshop', 'shop'] : ['courtyard', 'workshop', 'shop'],
      heightRange: isSlum ? [2.8, 3.8] : [3.4, 4.9],
      courtyardChance: isSlum ? 0.1 : 0.55,
    };
  }

  return match;
}

function isAgoraPlazaCell(gridX, gridZ) {
  return Math.abs(gridX) <= AGORA_PLAZA_RADIUS && Math.abs(gridZ) <= AGORA_PLAZA_RADIUS;
}

function isAgoraPlazaPerimeterCell(gridX, gridZ) {
  return isAgoraPlazaCell(gridX, gridZ) && Math.max(Math.abs(gridX), Math.abs(gridZ)) === AGORA_PLAZA_RADIUS;
}

function isAgoraArrivalPromenadeCell(gridX, gridZ) {
  return gridX >= -2 && gridX <= 0 && gridZ >= 2 && gridZ <= 3;
}

function isAgoraFramingCell(gridX, gridZ) {
  const framingRing = AGORA_PLAZA_RADIUS + 1;
  return (
    (Math.abs(gridZ) === framingRing && Math.abs(gridX) <= 2) ||
    (Math.abs(gridX) === framingRing && Math.abs(gridZ) <= 1)
  );
}

function isAgoraEdgeBuildingCell(gridX, gridZ) {
  const framingRing = AGORA_PLAZA_RADIUS + 3;
  return (
    !isAgoraPlazaCell(gridX, gridZ) &&
    !isAgoraArrivalPromenadeCell(gridX, gridZ) &&
    Math.abs(gridX) <= framingRing &&
    Math.abs(gridZ) <= framingRing &&
    (Math.abs(gridX) >= framingRing - 1 || Math.abs(gridZ) >= framingRing - 1)
  );
}

function isCivicMonumentFrontageCell(gridX, gridZ) {
  return (
    Math.abs(gridX) <= AGORA_PLAZA_RADIUS + 2 &&
    Math.abs(gridZ) <= AGORA_PLAZA_RADIUS + 2 &&
    !isAgoraPlazaCell(gridX, gridZ) &&
    !isAgoraArrivalPromenadeCell(gridX, gridZ) &&
    (Math.abs(gridX) >= AGORA_PLAZA_RADIUS + 1 || Math.abs(gridZ) >= AGORA_PLAZA_RADIUS + 1)
  );
}

function isAgoraUrbanFrontCell(gridX, gridZ) {
  return isAgoraFramingCell(gridX, gridZ) || isAgoraEdgeBuildingCell(gridX, gridZ);
}

function isAgoraMarketCourtCell(gridX, gridZ) {
  return (
    !isAgoraPlazaCell(gridX, gridZ) &&
    !isAgoraArrivalPromenadeCell(gridX, gridZ) &&
    !isAgoraUrbanFrontCell(gridX, gridZ) &&
    Math.abs(gridX) <= 3 &&
    Math.abs(gridZ) <= 3 &&
    (Math.abs(gridX) + Math.abs(gridZ)) >= 4
  );
}

function isAgoraHousingBandCell(gridX, gridZ) {
  return (
    !isAgoraPlazaCell(gridX, gridZ) &&
    !isAgoraArrivalPromenadeCell(gridX, gridZ) &&
    !isAgoraUrbanFrontCell(gridX, gridZ) &&
    !isAgoraMarketCourtCell(gridX, gridZ) &&
    gridX >= -7 &&
    gridX <= 5 &&
    gridZ >= -5 &&
    gridZ <= 7
  );
}

function shouldReserveAgoraMarketCourt(gridX, gridZ) {
  // Keep only a few deliberate market yards around the Agora so the center
  // reads as one large civic void wrapped by dense frontage, not a ring of
  // repeated court cells.
  return Math.abs(gridZ) === 3 && Math.abs(gridX) <= 1;
}

function isCentralCityBlanketCell(gridX, gridZ) {
  return (
    gridX >= -8 &&
    gridX <= 8 &&
    gridZ >= -4 &&
    gridZ <= 9 &&
    !isAgoraPlazaCell(gridX, gridZ) &&
    !isAgoraArrivalPromenadeCell(gridX, gridZ) &&
    !isHarborWaterfrontLaneCell(gridX, gridZ) &&
    !isHarborCrossLaneCell(gridX, gridZ)
  );
}

function shouldUseCommercialRoad(gridX, gridZ) {
  if (isAgoraUrbanFrontCell(gridX, gridZ) || isAgoraMarketCourtCell(gridX, gridZ) || isHarborUrbanFrontCell(gridX, gridZ)) {
    return false;
  }

  if (isCentralCityBlanketCell(gridX, gridZ)) {
    const westSpine = gridX === -6 && (gridZ <= -1 || gridZ >= 3);
    const marketConnector = gridZ === 6 && gridX >= -7 && gridX <= -2;
    const harborConnector = gridZ === 7 && gridX >= 2 && gridX <= 6;
    return westSpine || marketConnector || harborConnector;
  }

  const verticalLane = gridX % 7 === 0 && Math.abs(gridZ % 5) <= 1;
  const horizontalLane = gridZ % 8 === 0 && Math.abs(gridX % 4) <= 1;
  return verticalLane || horizontalLane;
}

function shouldUseResidentialRoad(gridX, gridZ) {
  if (isInlandUrbanBlockCell(gridX, gridZ) || isHarborUrbanFrontCell(gridX, gridZ)) {
    return false;
  }

  if (isCentralCityBlanketCell(gridX, gridZ)) {
    return false;
  }

  const verticalLane = gridX % 8 === 0 && Math.abs(gridZ % 5) <= 1;
  const horizontalLane = gridZ % 9 === 0 && Math.abs(gridX % 4) <= 1;
  return verticalLane || horizontalLane;
}

function isOuterNeighborhoodCell(gridX, gridZ) {
  return Math.abs(gridX) >= 5 || gridZ >= 8 || gridZ <= -6;
}

function shouldThinFarEdgeCityCell(gridX, gridZ) {
  // Thin the opposite side of the hill more aggressively so the city mass
  // reads as gathering around the Agora/Acropolis rather than blanketing the
  // far east and north edges with the same density.
  const farEastBand =
    gridX >= 5 &&
    gridZ >= -2 &&
    (((gridX + gridZ) % 2 === 0) || gridX >= 8);
  const farNorthBand =
    gridZ >= 9 &&
    gridX >= -2 &&
    ((Math.abs(gridX + gridZ) % 2 === 1) || gridZ >= 11);
  const farNorthEastPocket = gridX >= 4 && gridZ >= 7 && ((gridX * 2 + gridZ) % 3 === 0);
  return farEastBand || farNorthBand || farNorthEastPocket;
}

function isInlandStoaEdgeCell(gridX, gridZ) {
  return gridX <= -3 && gridX >= -7 && gridZ >= -2 && gridZ <= 7;
}

function shouldReserveNeighborhoodCourt(gridX, gridZ) {
  // Reserve fewer outer-neighborhood courts so the edge of the city reads as
  // larger grouped blocks instead of a near-checkerboard of repeated pads.
  const majorPocket = Math.abs(gridX) % 10 === 4 && Math.abs(gridZ) % 9 === 3;
  const shoreEdgePocket = gridZ <= -6 && Math.abs(gridX) % 11 === 5 && Math.abs(gridZ) % 7 === 4;
  return majorPocket || shoreEdgePocket;
}

function isInlandUrbanBlockCell(gridX, gridZ) {
  return gridX <= -2 && gridX >= -7 && gridZ >= -4 && gridZ <= 9 && !isAgoraUrbanFrontCell(gridX, gridZ);
}

function isAcropolisSlopeBandCell(gridX, gridZ) {
  return (
    gridX >= -3 &&
    gridX <= 2 &&
    gridZ >= -5 &&
    gridZ <= 0 &&
    !isAgoraPlazaCell(gridX, gridZ) &&
    !isAgoraArrivalPromenadeCell(gridX, gridZ)
  );
}

function shouldReserveInlandCourt(gridX, gridZ) {
  // Keep a few shared west-side courts, but let more inland cells merge back
  // into continuous urban blocks around them.
  const sharedYard = Math.abs(gridX + gridZ) % 8 === 0 && Math.abs(gridZ) % 4 === 1;
  const deepBlockPocket = Math.abs(gridX) % 7 === 3 && Math.abs(gridZ) % 7 === 2;
  return sharedYard || deepBlockPocket;
}

function isHarborUrbanFrontCell(gridX, gridZ) {
  return gridX >= 2 && gridX <= 8 && gridZ >= -2 && gridZ <= 8;
}

// --- Civic Route Spine (minimal, non-invasive) ---
function isMainCivicRouteCell(gridX, gridZ) {
  // Harbor ÔåÆ Agora (east-west)
  const harborApproach = Math.abs(gridZ) <= 1 && gridX >= 0 && gridX <= 6;

  // Agora ÔåÆ Acropolis (north-south)
  const acropolisClimb = Math.abs(gridX) <= 1 && gridZ >= -5 && gridZ <= 1;

  return harborApproach || acropolisClimb;
}

function isHarborCompoundCourtCell(gridX, gridZ) {
  if (!isHarborUrbanFrontCell(gridX, gridZ)) return false;

  const bandX = Math.floor((gridX - 2) / 3);
  const bandZ = Math.floor((gridZ + 1) / 4);
  return gridX >= 3 && gridZ >= 0 && gridZ <= 5 && (bandX + bandZ) % 2 === 0;
}

function isHarborWaterfrontLaneCell(gridX, gridZ) {
  return gridX === 4 && gridZ >= -1 && gridZ <= 7;
}

function isHarborCrossLaneCell(gridX, gridZ) {
  return gridZ === 3 && gridX >= 2 && gridX <= 5;
}

function isHarborLaneFrontageCell(gridX, gridZ) {
  if (!isHarborUrbanFrontCell(gridX, gridZ)) return false;

  const alongMainLane = (gridX === 3 || gridX === 5 || gridX === 2 || gridX === 6) && gridZ >= 0 && gridZ <= 7;
  const alongCrossLane = (gridZ === 2 || gridZ === 4 || gridZ === 1 || gridZ === 5) && gridX >= 2 && gridX <= 6;
  return alongMainLane || alongCrossLane;
}

function shouldReserveHarborCourt(gridX, gridZ) {
  if (
    isHarborWaterfrontLaneCell(gridX, gridZ) ||
    isHarborCrossLaneCell(gridX, gridZ) ||
    isHarborLaneFrontageCell(gridX, gridZ)
  ) {
    return false;
  }
  if (isHarborCompoundCourtCell(gridX, gridZ)) return true;
  return false;
}

function getAgoraPlazaAccentRotation(gridX, gridZ) {
  if (gridZ === -AGORA_PLAZA_RADIUS && gridX === 0) return 0;
  if (gridX === AGORA_PLAZA_RADIUS && gridZ === 0) return -Math.PI / 2;
  if (gridZ === AGORA_PLAZA_RADIUS && gridX === 0) return Math.PI;
  if (gridX === -AGORA_PLAZA_RADIUS && gridZ === 0) return Math.PI / 2;
  return Math.atan2(-gridX, -gridZ);
}

function applyAgoraScalePass(buildingGroup, cell) {
  if (!buildingGroup || !cell) return;

  if (isAgoraFramingCell(cell.gridX, cell.gridZ)) {
    buildingGroup.scale.multiplyScalar(0.9);
    return;
  }

  const agoraDistance = Math.hypot(cell.position.x - AGORA_CENTER_3D.x, cell.position.z - AGORA_CENTER_3D.z);
  if (isHarborLaneFrontageCell(cell.gridX, cell.gridZ)) {
    buildingGroup.scale.multiplyScalar(1.22);
    return;
  }
  if (isAgoraHousingBandCell(cell.gridX, cell.gridZ)) {
    buildingGroup.scale.multiplyScalar(1.08);
    return;
  }
  if (isAcropolisSlopeBandCell(cell.gridX, cell.gridZ)) {
    buildingGroup.scale.multiplyScalar(1.1);
    return;
  }
  if (cell.district === 'civic' && isCivicMonumentFrontageCell(cell.gridX, cell.gridZ)) {
    buildingGroup.scale.multiplyScalar(0.88);
    return;
  }
  if (isHarborUrbanFrontCell(cell.gridX, cell.gridZ)) {
    buildingGroup.scale.multiplyScalar(1.14);
    return;
  }
  if (cell.district === 'civic' && agoraDistance <= AGORA_CIVIC_RADIUS + BLOCK_SIZE * 0.5) {
    buildingGroup.scale.multiplyScalar(0.86);
  } else if (cell.district === 'commercial' && agoraDistance <= AGORA_MARKET_RADIUS + BLOCK_SIZE) {
    buildingGroup.scale.multiplyScalar(0.94);
  }
}

function resolveBuildingDetailLevel(cell) {
  if (!cell) return 'full';
  if (cell.district === 'sacred' || cell.district === 'civic') return 'full';
  if (isAgoraUrbanFrontCell(cell.gridX, cell.gridZ)) return 'full';

  const agoraDistance = Math.hypot(
    cell.position.x - AGORA_CENTER_3D.x,
    cell.position.z - AGORA_CENTER_3D.z,
  );
  const harborDistance = Math.hypot(
    cell.position.x - HARBOR_CENTER_3D.x,
    cell.position.z - HARBOR_CENTER_3D.z,
  );

  // Keep the player-facing Agora walk and the immediate harbor approach in the
  // fuller kit so the opening city fabric still reads as Athens, not placeholders.
  if (agoraDistance <= AGORA_MARKET_RADIUS + BLOCK_SIZE * 2.4) {
    return 'full';
  }

  if (harborDistance <= BLOCK_SIZE * 3.2) {
    return 'full';
  }

  if (cell.district === 'commercial' && agoraDistance <= AGORA_MARKET_RADIUS + BLOCK_SIZE * 1.4) {
    return 'full';
  }

  return 'low';
}

function applyBuildingShadowProfile(buildingGroup, cell, detailLevel) {
  if (!buildingGroup) return;

  const preserveLandmarkShadows =
    cell?.district === 'sacred' || cell?.district === 'civic';
  const castsShadows = preserveLandmarkShadows && detailLevel !== 'low';
  const receivesShadows = detailLevel !== 'low';

  buildingGroup.traverse((child) => {
    if (!child?.isMesh) return;
    child.castShadow = castsShadows;
    child.receiveShadow = receivesShadows;
  });
}

/**
 * Procedural road network for the city.
 * A collection of nodes and segments that define the city's skeleton.
 */
class RoadSegment {
  constructor(start, end, width = 3, type = 'artery') {
    this.start = start; // THREE.Vector3
    this.end = end;     // THREE.Vector3
    this.width = width;
    this.type = type;
    this.line = new THREE.Line3(start, end);
  }

  isNear(point, tolerance = 1.2) {
    const closest = new THREE.Vector3();
    this.line.closestPointToPoint(point, true, closest);
    return point.distanceTo(closest) < (this.width / 2 + tolerance);
  }
}

/**
 * Generate a procedural network of roads connecting the city's hubs.
 */
function generateRoadNetwork(terrainSampler) {
  const segments = [];
  
  // 1. Primary Spine: Harbor [East] -> Agora [Center-West]
  // This road connects the main port to the civic heart.
  const harborToAgora = new RoadSegment(
    HARBOR_CENTER_3D.clone(), 
    AGORA_CENTER_3D.clone(), 
    5.5, 
    'artery'
  );
  segments.push(harborToAgora);

  // 2. Sacred Way: Agora [Center-West] -> Acropolis [Center]
  // The ceremonial path up the hill.
  segments.push(new RoadSegment(
    AGORA_CENTER_3D.clone(), 
    ACROPOLIS_PEAK_3D.clone(), 
    4.5, 
    'artery'
  ));

  // 3. Northwest Commercial Strip (extension)
  segments.push(new RoadSegment(
    AGORA_CENTER_3D.clone(), 
    new THREE.Vector3(-110, AGORA_CENTER_3D.y, 45), 
    3.5, 
    'artery'
  ));

  // 4. Feeder Roads (Branching)
  // We'll create a few loops and connectors to break up the city into blocks.
  
  // South Neighborhood Collector
  segments.push(new RoadSegment(
    new THREE.Vector3(0, AGORA_CENTER_3D.y, 10),
    new THREE.Vector3(-45, AGORA_CENTER_3D.y, -60),
    3,
    'local'
  ));

  // North Neighborhood Collector
  segments.push(new RoadSegment(
    new THREE.Vector3(-15, AGORA_CENTER_3D.y, 35),
    new THREE.Vector3(20, AGORA_CENTER_3D.y, 85),
    3,
    'local'
  ));

  // Harbor Perimeter Road
  segments.push(new RoadSegment(
    new THREE.Vector3(68, HARBOR_CENTER_3D.y, -30),
    new THREE.Vector3(68, HARBOR_CENTER_3D.y, 50),
    4,
    'local'
  ));

  return segments;
}

function generateCityGrid(terrainSampler) {
  const cells = [];
  const roadNetwork = generateRoadNetwork(terrainSampler);
  
  if (IS_DEV) console.log('[CityPlan] Generating terrain-aware city grid with Roadmap v1...');
  let slopeRejects = 0;
  let elevationRejects = 0;
  for (let gridX = MIN_X; gridX <= MAX_X; gridX++) {
    for (let gridZ = MIN_Z; gridZ <= MAX_Z; gridZ++) {
      let worldX = CITY_CENTER_ORIGIN.x + (gridX * BLOCK_SIZE);
      let worldZ = CITY_CENTER_ORIGIN.z + (gridZ * BLOCK_SIZE);

      // Apply deterministic organic warp to break the grid, EXCEPT for the core Agora which stays flat and formal.
      if (!isAgoraPlazaCell(gridX, gridZ) && !isAgoraArrivalPromenadeCell(gridX, gridZ)) {
          const warpSeedX = gridX * 0.123 + gridZ * 0.456;
          const warpSeedZ = gridX * 0.789 + gridZ * 0.321;
          worldX += roadNoise(warpSeedX, 100) * GRID_WARP_STRENGTH;
          worldZ += roadNoise(warpSeedZ, 200) * GRID_WARP_STRENGTH;
      }
      
      const cell = {
        gridX,
        gridZ,
        position: new THREE.Vector3(worldX, getCityGroundY(), worldZ),
        type: 'building',
        district: 'residential',
        slope: 0,
        elevation: 0,
        buildable: true,
        blocked: false,
      };

      cell.district = resolveDistrictForCell(worldX, worldZ);

      if (
        cell.district !== 'sacred' &&
        cell.district !== 'harbor' &&
        isOuterNeighborhoodCell(gridX, gridZ) &&
        shouldThinFarEdgeCityCell(gridX, gridZ)
      ) {
        cell.type = 'blocked';
        cell.buildable = false;
        cell.blocked = true;
        cells.push(cell);
        continue;
      }

      if (isBlockedForCityLayout(worldX, worldZ)) {
        cell.type = 'blocked';
        cell.buildable = false;
        cell.blocked = true;
        cells.push(cell);
        continue;
      }
      
      // Civic district must be within 30 tiles of starting point and on flat land
      if (cell.district === 'civic') {
        if (!isWithinCivicClusterRange(worldX, worldZ)) {
          cell.buildable = false;
          console.log(`[CityPlan] Civic building rejected at (${gridX}, ${gridZ}) - outside civic cluster range`);
        }
      }

      // Analyze terrain if sampler available
      if (terrainSampler) {
        const slope = getAverageSlope(terrainSampler, worldX, worldZ, BLOCK_SIZE / 2, 9);
        const elevation = getElevation(terrainSampler, worldX, worldZ);
        
        cell.slope = slope;
        cell.elevation = elevation;

        // Determine building type for slope validation
        let buildingType = 'residential';
        if (cell.district === 'sacred') buildingType = 'temple';
        else if (cell.district === 'civic') buildingType = 'civic';
        else if (cell.district === 'commercial') buildingType = 'shop';
        else if (cell.district === 'harbor') buildingType = 'warehouse';

        // Validate slope for building type
        const slopeValid = isSlopeValidForBuilding(slope, buildingType);
        
        if (!slopeValid) {
          cell.buildable = false;
          slopeRejects++;
        }

        // Strict Water Cutoff
        if (elevation <= getSeaLevelY() + 0.35) {
          cell.type = 'blocked';
          cell.buildable = false;
          elevationRejects++;
        }

        // Extra strict validation for civic/sacred buildings (need flat land)
        if ((cell.district === 'sacred' || cell.district === 'civic') && slope > SLOPE_THRESHOLDS.FLAT) {
          cell.buildable = false;
          elevationRejects++;
        }
      }

      // Primary Road Network Assignment
      const nearestSeg = roadNetwork.find(seg => seg.isNear(cell.position));
      
      if (nearestSeg && cell.district !== 'sacred') {
        cell.type = 'road';
        cell.roadType = nearestSeg.type; // 'artery' or 'local'
        cell.buildable = true;
      } else if (isAgoraPlazaCell(gridX, gridZ) || isAgoraArrivalPromenadeCell(gridX, gridZ)) {
        // Keep the Agora core open as a readable civic plaza.
        cell.type = 'plaza';
        cell.district = 'commercial';
        cell.buildable = true;
      } else if (
        isAgoraMarketCourtCell(gridX, gridZ) &&
        shouldReserveAgoraMarketCourt(gridX, gridZ) &&
        !isRoad
      ) {
        // Break the market ring into shared courts so the Agora reads as joined
        // urban blocks with active inner yards instead of detached little pads.
        cell.type = 'plaza';
        cell.district = 'commercial';
        cell.buildable = true;
      } else if (
        isAgoraHousingBandCell(gridX, gridZ) &&
        cell.district !== 'sacred' &&
        cell.district !== 'harbor'
      ) {
        // Keep the blocks just outside the Agora consistently filled so the
        // center reads as one civic opening wrapped by dense urban fabric.
        cell.type = 'building';
        cell.district = cell.district === 'commercial' ? 'commercial' : 'residential';
        cell.buildable = true;
      } else if (
        isInlandUrbanBlockCell(gridX, gridZ) &&
        cell.district !== 'sacred' &&
        cell.district !== 'harbor' &&
        !isAcropolisSlopeBandCell(gridX, gridZ) &&
        !isRoad &&
        shouldReserveInlandCourt(gridX, gridZ)
      ) {
        // Break the inland west-side fabric into shared courts and larger grouped
        // blocks so it reads as joined neighborhoods instead of repeated small pads.
        cell.type = 'plaza';
        cell.district = 'commercial';
        cell.buildable = true;
      } else if (
        isAcropolisSlopeBandCell(gridX, gridZ) &&
        cell.district !== 'sacred' &&
        cell.district !== 'harbor'
      ) {
        // Keep the city thicker on the Acropolis-facing side so the urban
        // fabric steps up toward the sacred hill instead of staying evenly spread.
        cell.type = 'building';
        cell.district = cell.district === 'commercial' ? 'commercial' : 'residential';
        cell.buildable = true;
      } else if (
        isHarborUrbanFrontCell(gridX, gridZ) &&
        cell.district !== 'harbor' &&
        isHarborLaneFrontageCell(gridX, gridZ)
      ) {
        // Keep the main harbor lane lined with larger frontage buildings so the
        // route feels built up instead of cutting through empty pads.
        cell.type = 'building';
        cell.district = 'commercial';
        cell.buildable = true;
      } else if (
        isHarborUrbanFrontCell(gridX, gridZ) &&
        cell.district !== 'harbor' &&
        !isRoad &&
        shouldReserveHarborCourt(gridX, gridZ)
      ) {
        // Keep the harbor approach as a sequence of larger shared forecourts and
        // working yards instead of a wall of tiny repeated building pads.
        cell.type = 'plaza';
        cell.district = 'commercial';
        cell.buildable = true;
      } else if (
        isHarborUrbanFrontCell(gridX, gridZ) &&
        (isHarborWaterfrontLaneCell(gridX, gridZ) || isHarborCrossLaneCell(gridX, gridZ))
      ) {
        // Give the waterfront one readable main lane and a single cross-connection
        // back into the harbor district instead of many equal-priority strips.
        cell.type = 'road';
        cell.district = 'commercial';
        cell.buildable = true;
      } else if (
        isOuterNeighborhoodCell(gridX, gridZ) &&
        cell.district !== 'sacred' &&
        cell.district !== 'harbor' &&
        !isRoad &&
        shouldReserveNeighborhoodCourt(gridX, gridZ)
      ) {
        // Reserve shared courts and breathing pockets in the outer neighborhoods
        // so the city reads as grouped blocks instead of a field of repeated tiny lots.
        cell.type = 'plaza';
        cell.buildable = true;
      } else if (isAgoraEdgeBuildingCell(gridX, gridZ) && cell.district !== 'sacred') {
        // Keep a continuous wall of city fabric around the Agora instead of letting roads eat the square.
        cell.type = 'building';
        cell.buildable = true;
      } else if (cell.district === 'sacred') {
        cell.type = 'building';
      }

      cells.push(cell);
    }
  }
  
  if (terrainSampler) {
    console.log(`[CityPlan] Terrain analysis: ${slopeRejects} slope rejects, ${elevationRejects} elevation rejects`);
    const totalCells = cells.length;
    const buildableCells = cells.filter(c => c.buildable && c.type !== 'road').length;
    console.log(`[CityPlan] Buildable cells: ${buildableCells}/${totalCells} (${(buildableCells/totalCells*100).toFixed(1)}%)`);
  }
  
  return { cells, roadNetwork };
}

export async function createCivicDistrict(scene, options = {}) {
  const group = new THREE.Group();
  group.name = 'CivicDistrict';
  scene.add(group);

  // Start rule and texture fetches early so they can progress while we build
  // the grid and pathing data for the district.
  const districtRulesPromise = loadDistrictRules();
  const tl = new THREE.TextureLoader();
  const baseUrl = typeof scene?.userData?.baseUrl === "string" ? scene.userData.baseUrl : "";
  const resolvedBase = baseUrl || resolveBaseUrl();
  const plazaMaterialPromise = (async () => {
    try {
      const normalUrl = joinPath(resolvedBase, "textures/marble_normal-dx.jpg");
      const [baseMap, normalMap] = await Promise.all([
        tl.loadAsync(joinPath(resolvedBase, "textures/marble_base.jpg")),
        tl.loadAsync(normalUrl),
      ]);

      baseMap.wrapS = baseMap.wrapT = THREE.RepeatWrapping;
      baseMap.repeat.set(4, 4);
      baseMap.colorSpace = THREE.SRGBColorSpace;

      applyNormalMapConvention(normalMap, normalUrl);
      normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
      normalMap.repeat.set(4, 4);

      return new THREE.MeshStandardMaterial({
        color: 0xbca98a,
        map: baseMap,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
    } catch (e) {
      console.warn("Failed to load plaza textures (marble fallback)", e);
      return null;
    }
  })();

  const centerOption = options.center ?? AGORA_CENTER_3D;
  const terrainSampler =
    options.heightSampler ??
    options.terrainSampler ??
    options.terrain?.userData?.getHeightAt;
  const surfaceOffset = options.surfaceOffset ?? 0.05;

  const center = centerOption instanceof THREE.Vector3
    ? centerOption.clone()
    : new THREE.Vector3(centerOption?.x ?? 0, centerOption?.y ?? 0, centerOption?.z ?? 0);

  let baseHeight = Number.isFinite(center.y) ? center.y : 0;
  if (typeof terrainSampler === 'function') {
    const sampled = terrainSampler(center.x, center.z);
    if (Number.isFinite(sampled)) {
      baseHeight = sampled;
    }
  }

  group.position.set(center.x, baseHeight, center.z);

  const sampleLocalHeight = (offsetX = 0, offsetZ = 0, fallback = 0) => {
    if (typeof terrainSampler === 'function') {
      const worldX = center.x + offsetX;
      const worldZ = center.z + offsetZ;
      const sampled = terrainSampler(worldX, worldZ);
      if (Number.isFinite(sampled)) {
        return sampled - baseHeight + surfaceOffset;
      }
    }
    return fallback + surfaceOffset;
  };

  // Generate grid and road network
  const { grid, roadNetwork } = (function() {
    const result = generateCityGrid(terrainSampler);
    return { grid: result.cells, roadNetwork: result.roadNetwork };
  })();

  // Generate pedestrian paths
  const pathTiles = generatePaths(grid, {
    spacing: 4,
    avoidSteepSlopes: true,
    connectAllDistricts: true,
  });

  // Verify reachability to key buildings
  const reachability = verifyReachability(grid, pathTiles, {
    maxDistance: 60, // Max 60 tiles to key buildings
  });

  const districtRules = await districtRulesPromise;
  const plazaMat = await plazaMaterialPromise;

  group.userData.plan = {
    grid,
    pathTiles,
    reachability,
    minX: MIN_X,
    maxX: MAX_X,
    minZ: MIN_Z,
    maxZ: MAX_Z,
    blockSize: BLOCK_SIZE,
    center: center.clone()
  };

  // Keep a light civic underlay near the Agora only. Broad waterfront-sized
  // rectangles were competing with the terrain and harbor shoreline.
  const civicFabric = createCityFabricUnderlay(BLOCK_SIZE * 7.2, BLOCK_SIZE * 8.4, 0x96775a, 0.15);
  civicFabric.position.set(-BLOCK_SIZE * 1.9, surfaceOffset * 0.08, BLOCK_SIZE * 1.2);
  group.add(civicFabric);

  for (const cell of grid) {
    // Skip unbuildable cells (too steep or unsuitable terrain)
    if (!cell.buildable && cell.type !== 'road') {
      continue;
    }

    const localX = cell.position.x - center.x;
    const localZ = cell.position.z - center.z;
    const localY = sampleLocalHeight(localX, localZ, 0);

    // Compute world-space position to respect harbor exclusions
    const worldX = cell.position.x;
    const worldZ = cell.position.z;
    if (isBlockedForCityLayout(worldX, worldZ)) {
      continue; // Skip placing any city element inside harbor/walkway setbacks
    }

    if (cell.type === 'road') {
      const isArtery = cell.roadType === 'artery';
      // Artery roads are wide and formal, local roads are narrow and organic.
      const roadWidth = isArtery ? BLOCK_SIZE - 6 : BLOCK_SIZE - 12;
      const roadColor = isArtery ? 0x4a4a4a : 0xa2917d; 
      const roadMesh = createPavedStrip(roadWidth, roadWidth, 0, 'road', roadColor);
      roadMesh.position.set(localX, localY + 0.006, localZ);

      // Calculate rotation based on neighboring road cells to smooth out the warped grid overlap
      let nextRoadX = localX;
      let nextRoadZ = localZ;
      let neighbors = 0;

      for (const tCell of grid) {
        if (tCell.type === 'road' && tCell !== cell) {
            const dist = Math.hypot(tCell.position.x - cell.position.x, tCell.position.z - cell.position.z);
            if (dist > 0 && dist < BLOCK_SIZE * 1.5) {
                nextRoadX += (tCell.position.x - center.x);
                nextRoadZ += (tCell.position.z - center.z);
                neighbors++;
            }
        }
      }

      if (neighbors > 0) {
          nextRoadX /= (neighbors + 1);
          nextRoadZ /= (neighbors + 1);
          roadMesh.rotation.y = Math.atan2(nextRoadX - localX, nextRoadZ - localZ);
      }

      group.add(roadMesh);

      if (cell.slope > SLOPE_THRESHOLDS.FLAT * 0.75) {
        const streetAccent = createStreetGradeAccent({
          localX,
          localZ,
          localY,
          sampleLocalHeight,
          span: BLOCK_SIZE * 0.28,
          width: roadWidth * 0.52,
          roadLike: true,
        });
        if (streetAccent) group.add(streetAccent);
      }
    } else if (cell.type === 'plaza') {
      const isPrimaryPlazaCell =
        isAgoraPlazaCell(cell.gridX, cell.gridZ) ||
        isAgoraArrivalPromenadeCell(cell.gridX, cell.gridZ);

      if (isPrimaryPlazaCell) {
        const plazaMesh = createPavedStrip(BLOCK_SIZE - 6, BLOCK_SIZE - 6, 0, 'plaza', 0xb29e7e);
        plazaMesh.position.set(localX, localY + 0.004, localZ);
        if (plazaMat) plazaMesh.material = plazaMat;
        group.add(plazaMesh);
      } else {
        const shouldRenderCourtSurface =
          shouldReserveAgoraMarketCourt(cell.gridX, cell.gridZ) ||
          isHarborCompoundCourtCell(cell.gridX, cell.gridZ) ||
          (isInlandUrbanBlockCell(cell.gridX, cell.gridZ) &&
            (Math.abs(cell.gridX) + Math.abs(cell.gridZ)) % 13 === 0);
        const courtSurface = shouldRenderCourtSurface ? createReservedCourtSurface(cell) : null;
        if (courtSurface) {
          courtSurface.position.set(localX, localY, localZ);
          group.add(courtSurface);
        }
      }

        if (cell.gridX === 0 && cell.gridZ === 0) {
          const civicPlatform = createDistrictPlatformAccent({
            localX,
            localZ,
            localY,
          sampleLocalHeight,
          radius: BLOCK_SIZE * 0.46,
          district: 'civic',
          });
          if (civicPlatform) group.add(civicPlatform);
        }

        if (cell.gridX === 0 && cell.gridZ === 0) {
          const plazaAccent = createAgoraPlazaAccent();
        plazaAccent.position.set(localX, localY, localZ);
        group.add(plazaAccent);
      } else if (isAgoraMarketCourtCell(cell.gridX, cell.gridZ)) {
        if (shouldReserveAgoraMarketCourt(cell.gridX, cell.gridZ)) {
          const marketCourt = createMarketCourtAccent(() => {
            const seed = Math.abs(cell.gridX * 91841 ^ cell.gridZ * 43117);
            const t = seed + Math.sin(seed * 12.9898) * 43758.5453;
            return t - Math.floor(t);
          });
          marketCourt.position.set(localX, localY, localZ);
          marketCourt.rotation.y = ((Math.abs(cell.gridX) + Math.abs(cell.gridZ)) % 4) * (Math.PI / 2);
          group.add(marketCourt);
        }
      } else if (isInlandUrbanBlockCell(cell.gridX, cell.gridZ) || isOuterNeighborhoodCell(cell.gridX, cell.gridZ)) {
        if (
          isInlandUrbanBlockCell(cell.gridX, cell.gridZ)
            ? (Math.abs(cell.gridX) + Math.abs(cell.gridZ)) % 11 === 0
            : (Math.abs(cell.gridX) + Math.abs(cell.gridZ)) % 17 === 0
        ) {
          const urbanCourt = createUrbanCourtAccent(() => {
            const seed = Math.abs(cell.gridX * 73129 ^ cell.gridZ * 54121);
            const t = seed + Math.sin(seed * 12.9898) * 43758.5453;
            return t - Math.floor(t);
          });
          urbanCourt.position.set(localX, localY, localZ);
          urbanCourt.rotation.y = ((Math.abs(cell.gridX * 2) + Math.abs(cell.gridZ)) % 4) * (Math.PI / 2);
          group.add(urbanCourt);
        }
      } else if (isHarborCompoundCourtCell(cell.gridX, cell.gridZ)) {
        const harborCompound = createHarborCompoundAccent(() => {
          const seed = Math.abs(cell.gridX * 92821 ^ cell.gridZ * 68917);
          const t = seed + Math.sin(seed * 12.9898) * 43758.5453;
          return t - Math.floor(t);
        });
        harborCompound.position.set(localX, localY, localZ);
        harborCompound.rotation.y = (Math.abs(cell.gridX - cell.gridZ) % 2) * (Math.PI / 2);
        group.add(harborCompound);
      } else if (isAgoraPlazaPerimeterCell(cell.gridX, cell.gridZ)) {
        const perimeterAccent = createAgoraPerimeterAccent(cell.gridX, cell.gridZ);
        perimeterAccent.position.set(localX, localY, localZ);
        perimeterAccent.rotation.y = getAgoraPlazaAccentRotation(cell.gridX, cell.gridZ);
        group.add(perimeterAccent);
      }
    } else if (cell.type === 'building') {
       // Deterministic RNG
       const seed = Math.abs(cell.gridX * 73856093 ^ cell.gridZ * 19349663);
       const rng = () => {
          let t = seed + Math.sin(seed * 12.9898) * 43758.5453;
          return t - Math.floor(t);
       };

       const detailLevel = resolveBuildingDetailLevel(cell);
       
        if (cell.type === 'building' && cell.buildable) {
            const numSubBuildings = (cell.district === 'commercial' || cell.district === 'harbor') ? 1 : (rng() < 0.4 ? 2 : 1);
            let buildingPlaced = false;

            for (let i = 0; i < numSubBuildings; i++) {
           const buildingGroup = spawnBuilding({
             district: cell.district,
             rng: rng,
             districtRules: resolveDistrictRuleForCell(cell.district, districtRules, cell),
             detailLevel,
             preferRowhouseMass:
               isHarborLaneFrontageCell(cell.gridX, cell.gridZ) ||
               isAgoraEdgeBuildingCell(cell.gridX, cell.gridZ) ||
               (numSubBuildings > 1),
           });

           if (buildingGroup) {
               if (cell.district === 'harbor') {
                 if (i === 0 && rng() < 0.12) {
                   const lowAccent = createHarborFrontAccent(rng);
                   lowAccent.position.set(localX, localY, localZ);
                   lowAccent.rotation.y = Math.floor(rng() * 4) * (Math.PI / 2);
                   group.add(lowAccent);
                 }
                 continue;
               }

               let subX = localX;
               let subZ = localZ;

               if (numSubBuildings > 1) {
                   subX += (rng() - 0.5) * 14.5;
                   subZ += (rng() - 0.5) * 14.5;
               }

               const subY = sampleLocalHeight(subX, subZ, localY);
               const subCell = { ...cell, position: { x: subX, y: subY, z: subZ } };

               applyAgoraScalePass(buildingGroup, subCell);
               applyBuildingShadowProfile(buildingGroup, subCell, detailLevel);
               buildingGroup.position.set(subX, subY, subZ);

               let rot = Math.floor(rng() * 4) * (Math.PI / 2);

               let nearestSeg = null;
               let nearestDist = Infinity;
               let nearestPoint = new THREE.Vector3();

               for (const seg of roadNetwork) {
                   const closest = new THREE.Vector3();
                   seg.line.closestPointToPoint(subCell.position, true, closest);
                   const dist = subCell.position.distanceTo(closest);
                   if (dist < nearestDist) {
                       nearestDist = dist;
                       nearestSeg = seg;
                       nearestPoint.copy(closest);
                   }
               }

               if (nearestSeg && nearestDist <= BLOCK_SIZE * 1.5) {
                   const dx = nearestPoint.x - subX;
                   const dz = nearestPoint.z - subZ;
                   rot = Math.atan2(dx, dz);

                   if (cell.district === 'civic' || cell.district === 'commercial') {
                       const snapped = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
                       rot = rot * 0.55 + snapped * 0.45;
                   }
               } else if (cell.slope > SLOPE_THRESHOLDS.FLAT) {
                   const north = sampleLocalHeight(subX, subZ + 5, subY);
                   const south = sampleLocalHeight(subX, subZ - 5, subY);
                   const east = sampleLocalHeight(subX + 5, subZ, subY);
                   const west = sampleLocalHeight(subX - 5, subZ, subY);

                   const dz = south - north;
                   const dx = west - east;

                   rot = Math.atan2(dx, dz);
               }

               if (cell.district !== 'civic' && cell.district !== 'sacred') {
                   rot += (rng() - 0.5) * (Math.PI / 5.0);
               }

                buildingGroup.rotation.y = rot;
                if (i === 0) cellRot = rot;
                 group.add(buildingGroup);
                 buildingPlaced = true;
            }
        }

            if (!buildingPlaced && rng() < 0.75) {
                // If building failed to spawn, create a park.
                // Large parks for residential/sacred areas, pocket parks elsewhere.
                const isBigPark = (cell.district === 'residential' || cell.district === 'sacred') && rng() < 0.28;
                const park = isBigPark ? createMedPark(cell, rng) : createPocketPark(cell, rng);
                park.position.set(localX, localY, localZ);
                group.add(park);
            }
        }

           if (
             (cell.district === 'civic' || cell.district === 'sacred') &&
             (cell.slope > SLOPE_THRESHOLDS.FLAT * 0.9 || (cell.district === 'sacred' && rng() < 0.24))
           ) {
             const platformAccent = createDistrictPlatformAccent({
               localX,
               localZ,
               localY,
               sampleLocalHeight,
               radius: cell.district === 'sacred' ? BLOCK_SIZE * 0.52 : BLOCK_SIZE * 0.4,
               district: cell.district,
             });
             if (platformAccent) group.add(platformAccent);
           } else if (
             cell.district === 'civic' &&
             isCivicMonumentFrontageCell(cell.gridX, cell.gridZ) &&
             rng() < 0.08
           ) {
             const civicFrontPlatform = createDistrictPlatformAccent({
               localX,
               localZ,
               localY,
               sampleLocalHeight,
               radius: BLOCK_SIZE * 0.2,
               district: 'civic',
             });
             if (civicFrontPlatform) group.add(civicFrontPlatform);
           } else if (
             isHarborLaneFrontageCell(cell.gridX, cell.gridZ) &&
             rng() < 0.12
           ) {
             const harborFrontPlatform = createDistrictPlatformAccent({
               localX,
               localZ,
               localY,
               sampleLocalHeight,
               radius: BLOCK_SIZE * 0.28,
               district: 'civic',
             });
             if (harborFrontPlatform) group.add(harborFrontPlatform);
           }

           const allowRetainingAccent = detailLevel !== 'low';
           if (
             allowRetainingAccent &&
             (
               (cell.slope > SLOPE_THRESHOLDS.FLAT && rng() < 0.34) ||
               (isHarborLaneFrontageCell(cell.gridX, cell.gridZ) && rng() < 0.28) ||
               (cell.district === 'civic' && isCivicMonumentFrontageCell(cell.gridX, cell.gridZ) && rng() < 0.08)
             )
           ) {
             const retainingAccent = createStreetGradeAccent({
               localX,
               localZ,
               localY,
               sampleLocalHeight,
               span: BLOCK_SIZE * 0.34,
               width: BLOCK_SIZE * 0.5,
               roadLike: false,
             });
             if (retainingAccent) group.add(retainingAccent);
           }

           let districtAccent = null;
           if (isAgoraFramingCell(cell.gridX, cell.gridZ)) {
             districtAccent = null;
           } else if (
             cell.district === 'commercial' &&
             !isCivicMonumentFrontageCell(cell.gridX, cell.gridZ) &&
             rng() < 0.1
           ) {
             districtAccent = createCommercialAccent(rng);
           } else if (
             cell.district === 'residential' &&
             !isCivicMonumentFrontageCell(cell.gridX, cell.gridZ) &&
             Math.hypot(cell.position.x - AGORA_CENTER_3D.x, cell.position.z - AGORA_CENTER_3D.z) <= AGORA_MARKET_RADIUS + BLOCK_SIZE * 1.8 &&
             rng() < 0.06
           ) {
             districtAccent = createResidentialAccent(rng);
           } else if (cell.district === 'harbor' && rng() < 0.16) {
             districtAccent = createHarborFrontAccent(rng);
           } else if (cell.district === 'sacred' && rng() < 0.2) {
             districtAccent = rng() < 0.4 ? createSacredGrove(rng) : createSacredAccent();
           } else if (cell.district === 'civic' && isAgoraUrbanFrontCell(cell.gridX, cell.gridZ) && rng() < 0.15) {
             districtAccent = createStoaPlanters(rng);
           }

           if (districtAccent) {
             districtAccent.position.set(localX, localY, localZ);
             districtAccent.rotation.y = cellRot;
             group.add(districtAccent);
           }
       }
    }


  // Render footpaths (non-road paths for pedestrian connectivity)
  if (IS_DEV) console.log(`[CityPlan] Rendering ${pathTiles.length} path tiles...`);
  for (const pathTile of pathTiles) {
    if (pathTile.type === 'footpath' || pathTile.type === 'connector') {
      const localX = pathTile.position.x - center.x;
      const localZ = pathTile.position.z - center.z;
      const localY = sampleLocalHeight(localX, localZ, 0);

      // Check harbor exclusion
      const worldX = pathTile.position.x;
      const worldZ = pathTile.position.z;
      if (isBlockedForCityLayout(worldX, worldZ)) continue;

      // Create narrow footpath (lighter color than roads)
      const pathWidth = pathTile.type === 'connector' ? 6 : 4;
      const pathColor = pathTile.type === 'connector' ? 0xc0a07b : 0xcfb18e;
      const pathMesh = createPavedStrip(pathWidth, pathWidth, 0, 'footpath', pathColor);
      pathMesh.position.set(localX, localY + 0.007, localZ); // Keep paths close to the terrain so they read as paving, not slabs.

      // Calculate rotation based on neighboring path cells to smooth out the warped grid overlap
      let nextPathX = localX;
      let nextPathZ = localZ;
      let pathNeighbors = 0;

      for (const tTile of pathTiles) {
        if ((tTile.type === 'footpath' || tTile.type === 'connector') && tTile !== pathTile) {
            const dist = Math.hypot(tTile.position.x - pathTile.position.x, tTile.position.z - pathTile.position.z);
            if (dist > 0 && dist < BLOCK_SIZE * 1.5) {
                nextPathX += (tTile.position.x - center.x);
                nextPathZ += (tTile.position.z - center.z);
                pathNeighbors++;
            }
        }
      }

      if (pathNeighbors > 0) {
          nextPathX /= (pathNeighbors + 1);
          nextPathZ /= (pathNeighbors + 1);
          pathMesh.rotation.y = Math.atan2(nextPathX - localX, nextPathZ - localZ);
      }

      pathMesh.userData.isFootpath = true;
      group.add(pathMesh);

      if ((pathTile.slope ?? 0) > SLOPE_THRESHOLDS.FLAT * 0.8) {
        const pathAccent = createStreetGradeAccent({
          localX,
          localZ,
          localY,
          sampleLocalHeight,
          span: BLOCK_SIZE * 0.22,
          width: pathWidth * 0.8,
          roadLike: true,
        });
        if (pathAccent) group.add(pathAccent);
      }
    }
  }

  const walkingLoop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(center.x + 10, baseHeight, center.z + 10),
    new THREE.Vector3(center.x - 10, baseHeight, center.z + 10),
    new THREE.Vector3(center.x - 10, baseHeight, center.z - 10),
    new THREE.Vector3(center.x + 10, baseHeight, center.z - 10)
  ], true);

  const walkingLoopInner = new THREE.CatmullRomCurve3([
    new THREE.Vector3(center.x + 6, baseHeight, center.z + 4),
    new THREE.Vector3(center.x - 8, baseHeight, center.z + 6),
    new THREE.Vector3(center.x - 6, baseHeight, center.z - 6),
    new THREE.Vector3(center.x + 8, baseHeight, center.z - 4)
  ], true);

  const walkingLoopOuter = new THREE.CatmullRomCurve3([
    new THREE.Vector3(center.x + 16, baseHeight, center.z + 12),
    new THREE.Vector3(center.x - 18, baseHeight, center.z + 14),
    new THREE.Vector3(center.x - 14, baseHeight, center.z - 16),
    new THREE.Vector3(center.x + 18, baseHeight, center.z - 12)
  ], true);
  const walkingLoops = [walkingLoop, walkingLoopInner, walkingLoopOuter];

  // Optimize: Batch all generated buildings, props, and paths into merged geometries
  poolMaterialsAndMerge(group);

  return {
    group,
    walkingLoop,
    walkingLoops,
    plazaLength: 80, // Legacy support
    promenadeWidth: 14 // Legacy support
  };
}

export default createCivicDistrict;
