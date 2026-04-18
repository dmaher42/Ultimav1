import * as THREE from "three";
import {
  ACROPOLIS_PEAK_3D,
  AGORA_CENTER_3D,
  CITY_AREA_RADIUS,
  HARBOR_CENTER_3D,
} from "./locations.js";

// Lightweight instanced grass that keeps a 3×3 ring of tiles centered on the
// player. Each tile holds thousands of blades driven entirely on the GPU so we
// avoid per-frame allocations and CPU skinning work.

const TILE_SIZE = 40;
const TILE_RADIUS = 1; // results in a 3x3 ring
const BLADES_PER_TILE = 200;
const MAX_TILE_COUNT = (TILE_RADIUS * 2 + 1) ** 2;
const BLADE_HEIGHT_MIN = 0.75;
const BLADE_HEIGHT_MAX = 1.6;
const WIND_DIR = new THREE.Vector2(0.6, 0.4).normalize();
const BASE_COLOR = new THREE.Color(0x4c8f3a);
const NIGHT_DESAT = 0.55;
const NIGHT_DARKEN = 0.45;
const CITY_GRASS_EXCLUSION_RADIUS = CITY_AREA_RADIUS + 18;
const HARBOR_GRASS_EXCLUSION_RADIUS = 42;
const WORLD_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-TILE_SIZE, -10, -TILE_SIZE),
  new THREE.Vector3(TILE_SIZE, 30, TILE_SIZE)
);

let grassState = null;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(x, z, baseSeed) {
  let h = x * 374761393 + z * 668265263 + baseSeed * 362437;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function createBladeGeometry(instanceCount) {
  // A simple two-triangle wedge so we get a double-sided blade with no texture.
  const base = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0.0, 0.0, 0.0,
    -0.04, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.04, 0.0, 0.0,
  ]);
  base.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  base.computeVertexNormals();

  // Promote the blade to an instanced geometry with per-instance attributes for
  // position, scale, and a random phase used for wind + rotation variation.
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = instanceCount;
  geometry.setAttribute("position", base.getAttribute("position"));
  geometry.setAttribute("normal", base.getAttribute("normal"));

  const offsets = new Float32Array(instanceCount * 3);
  const scales = new Float32Array(instanceCount);
  const phases = new Float32Array(instanceCount);

  geometry.setAttribute(
    "instanceOffset",
    new THREE.InstancedBufferAttribute(offsets, 3)
  );
  geometry.setAttribute(
    "instanceScale",
    new THREE.InstancedBufferAttribute(scales, 1)
  );
  geometry.setAttribute(
    "instancePhase",
    new THREE.InstancedBufferAttribute(phases, 1)
  );

  geometry.boundingBox = WORLD_BOUNDS.clone();
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, BLADE_HEIGHT_MAX * 0.5, 0),
    Math.sqrt(2 * TILE_SIZE * TILE_SIZE) + BLADE_HEIGHT_MAX
  );

  return {
    geometry,
    offsets,
    scales,
    phases,
  };
}

function createGrassMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uWindDir: { value: WIND_DIR.clone() },
    uColor: { value: BASE_COLOR.clone() },
    uNightFactor: { value: 0 },
  };

  const vertexShader = /* glsl */ `
    attribute vec3 instanceOffset;
    attribute float instanceScale;
    attribute float instancePhase;

    uniform float uTime;
    uniform vec2 uWindDir;

    varying float vTipFactor;
    varying float vWorldY;

    mat2 rotation2D(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    void main() {
      float phase = instancePhase * 6.28318530718;
      float fastSway = sin(uTime * 7.0 + phase) * 0.05;
      float slowSway = sin(uTime * 1.3 + phase * 1.7) * 0.02;
      float sway = fastSway + slowSway;

      vec3 transformed = position;
      float tip = clamp(position.y, 0.0, 1.0);

      transformed.y *= instanceScale;

      vec2 rotated = rotation2D(phase) * vec2(transformed.x, transformed.z);
      transformed.x = rotated.x;
      transformed.z = rotated.y;

      float bend = tip * tip;
      vec2 windOffset = uWindDir * sway * bend;
      transformed.x += windOffset.x;
      transformed.z += windOffset.y;

      vec3 worldPosition = transformed + instanceOffset;

      vTipFactor = tip;
      vWorldY = worldPosition.y;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uNightFactor;

    varying float vTipFactor;
    varying float vWorldY;

    // Avoid conflict with Three.js ShaderChunk-defined helpers
    float luma3(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      float heightTint = mix(0.55, 1.08, clamp(vTipFactor, 0.0, 1.0));
      float altitudeTint = clamp((vWorldY + 2.0) * 0.03, 0.85, 1.1);
      vec3 color = uColor * heightTint * altitudeTint;

      float desatAmount = uNightFactor * ${NIGHT_DESAT.toFixed(2)};
      float darkenAmount = uNightFactor * ${NIGHT_DARKEN.toFixed(2)};

      float lum = luma3(color);
      color = mix(color, vec3(lum), desatAmount);
      color *= mix(1.0, 0.6, darkenAmount);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  return material;
}

function resolveHeightSampler(scene) {
  if (!scene) return null;
  const explicit = scene.userData?.terrainHeightSampler;
  if (typeof explicit === "function") return explicit;
  const direct = scene.userData?.getHeightAt;
  if (typeof direct === "function") return direct;
  const terrain = scene.userData?.terrain;
  const sampler = terrain?.userData?.getHeightAt;
  return typeof sampler === "function" ? sampler : null;
}

function isInsideUrbanGrassExclusion(worldX, worldZ) {
  const isNearAgora =
    Math.hypot(worldX - AGORA_CENTER_3D.x, worldZ - AGORA_CENTER_3D.z) <
    CITY_GRASS_EXCLUSION_RADIUS;
  if (isNearAgora) return true;

  const isNearAcropolis =
    Math.hypot(worldX - ACROPOLIS_PEAK_3D.x, worldZ - ACROPOLIS_PEAK_3D.z) <
    CITY_GRASS_EXCLUSION_RADIUS * 0.85;
  if (isNearAcropolis) return true;

  return (
    Math.hypot(worldX - HARBOR_CENTER_3D.x, worldZ - HARBOR_CENTER_3D.z) <
    HARBOR_GRASS_EXCLUSION_RADIUS
  );
}

function populateTile(tile, coordX, coordZ, state) {
  const { geometry, offsets, scales, phases } = tile;
  const sampler = state.heightSampler;
  const baseSeed = state.seed;

  const originX = (coordX + 0.5) * TILE_SIZE;
  const originZ = (coordZ + 0.5) * TILE_SIZE;
  const rng = mulberry32(hashSeed(coordX, coordZ, baseSeed));

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let instanceCount = 0;

  for (let i = 0; i < BLADES_PER_TILE; i += 1) {
    const dx = (rng() - 0.5) * TILE_SIZE;
    const dz = (rng() - 0.5) * TILE_SIZE;
    const worldX = originX + dx;
    const worldZ = originZ + dz;

    if (isInsideUrbanGrassExclusion(worldX, worldZ)) {
      continue;
    }

    let worldY = 0;
    if (sampler) {
      const h = sampler(worldX, worldZ);
      if (Number.isFinite(h)) {
        worldY = h;
      }
    }

    const offsetIndex = instanceCount * 3;
    offsets[offsetIndex + 0] = worldX;
    offsets[offsetIndex + 1] = worldY;
    offsets[offsetIndex + 2] = worldZ;

    const bladeScale = THREE.MathUtils.lerp(
      BLADE_HEIGHT_MIN,
      BLADE_HEIGHT_MAX,
      rng()
    );
    scales[instanceCount] = bladeScale;
    phases[instanceCount] = rng();
    instanceCount += 1;

    // Track bounds for frustum culling
    if (worldX < minX) minX = worldX;
    if (worldX > maxX) maxX = worldX;
    if (worldY < minY) minY = worldY;
    if (worldY + bladeScale > maxY) maxY = worldY + bladeScale;
    if (worldZ < minZ) minZ = worldZ;
    if (worldZ > maxZ) maxZ = worldZ;
  }

  // Update bounding volume to match the new instance positions
  const padding = 0.5; // Account for blade width and wind sway
  if (instanceCount > 0) {
    geometry.boundingBox.min.set(minX - padding, minY, minZ - padding);
    geometry.boundingBox.max.set(maxX + padding, maxY, maxZ + padding);
  } else {
    geometry.boundingBox.min.set(0, 0, 0);
    geometry.boundingBox.max.set(0, 0, 0);
  }

  if (!geometry.boundingSphere) {
    geometry.boundingSphere = new THREE.Sphere();
  }
  geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);

  geometry.instanceCount = instanceCount;
  geometry.attributes.instanceOffset.needsUpdate = true;
  geometry.attributes.instanceScale.needsUpdate = true;
  geometry.attributes.instancePhase.needsUpdate = true;

  tile.coord.set(coordX, coordZ);
}

function createTile(state) {
  const { geometry, offsets, scales, phases } = createBladeGeometry(
    BLADES_PER_TILE
  );
  const tile = {
    geometry: geometry,
    mesh: new THREE.Mesh(geometry, state.material),
    offsets,
    scales,
    phases,
    coord: new THREE.Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
  };
  tile.mesh.frustumCulled = true;
  tile.mesh.name = "GrassTile";
  tile.mesh.userData.isGrassTile = true;
  return tile;
}

function ensureState(scene) {
  if (!scene) return null;
  if (grassState) return grassState;

  const material = createGrassMaterial();
  const root = new THREE.Group();
  root.name = "InstancedGrass";
  scene.add(root);

  const state = {
    root,
    scene,
    material,
    tiles: [],
    seed: 1013904223,
    heightSampler: resolveHeightSampler(scene),
    time: 0,
    lastCenter: new THREE.Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
  };

  for (let i = 0; i < MAX_TILE_COUNT; i += 1) {
    const tile = createTile(state);
    state.tiles.push(tile);
    root.add(tile.mesh);
  }

  grassState = state;
  return state;
}

function updateTileAssignments(state, centerX, centerZ) {
  const desired = [];
  for (let dz = -TILE_RADIUS; dz <= TILE_RADIUS; dz += 1) {
    for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx += 1) {
      desired.push({ x: centerX + dx, z: centerZ + dz });
    }
  }

  const tiles = state.tiles;
  const unmatched = new Set(desired.map((_, idx) => idx));
  const freeTiles = [];

  for (const tile of tiles) {
    let matchedIndex = -1;
    for (let i = 0; i < desired.length; i += 1) {
      const coord = desired[i];
      if (
        unmatched.has(i) &&
        tile.coord.x === coord.x &&
        tile.coord.y === coord.z
      ) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex !== -1) {
      unmatched.delete(matchedIndex);
    } else {
      freeTiles.push(tile);
    }
  }

  if (unmatched.size === 0) return;

  const unmatchedList = Array.from(unmatched);
  let freeIndex = 0;
  for (const desiredIndex of unmatchedList) {
    const coord = desired[desiredIndex];
    const tile = freeTiles[freeIndex] ?? tiles[freeIndex % tiles.length];
    freeIndex += 1;
    populateTile(tile, coord.x, coord.z, state);
  }
}

export function mount(scene) {
  const state = ensureState(scene);
  if (!state) return null;
  state.heightSampler = resolveHeightSampler(scene);
  for (const tile of state.tiles) {
    tile.coord.set(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  }
  return state.root;
}

export function update(dt = 0, playerPosition = null) {
  if (!grassState) return;

  grassState.time += dt;
  grassState.material.uniforms.uTime.value = grassState.time;

  if (!playerPosition) return;

  const px = playerPosition.x ?? 0;
  const pz = playerPosition.z ?? 0;

  const tileX = Math.floor(px / TILE_SIZE);
  const tileZ = Math.floor(pz / TILE_SIZE);

  if (grassState.lastCenter.x !== tileX || grassState.lastCenter.y !== tileZ) {
    updateTileAssignments(grassState, tileX, tileZ);
    grassState.lastCenter.set(tileX, tileZ);
  }
}

export function setNightFactor(value) {
  if (!grassState) return;
  grassState.material.uniforms.uNightFactor.value = THREE.MathUtils.clamp(
    value ?? 0,
    0,
    1
  );
}

export function dispose() {
  if (!grassState) return;
  const { root, tiles, material } = grassState;

  if (root && root.parent) {
    root.parent.remove(root);
  }

  for (const tile of tiles) {
    if (tile.mesh) {
      tile.mesh.parent?.remove(tile.mesh);
    }
    tile.geometry?.dispose();
    tile.mesh = undefined;
    tile.geometry = undefined;
  }

  material.dispose();

  grassState = null;
}
