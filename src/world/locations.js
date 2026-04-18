import * as THREE from "three";
import {
  getSeaLevelY,
  setSeaLevelY,
  subscribeSeaLevelChange,
  SEA_LEVEL_Y,
} from "./seaLevelState.js";

export { getSeaLevelY, setSeaLevelY, SEA_LEVEL_Y } from "./seaLevelState.js";

const resolveSeaLevelY = () => getSeaLevelY();

// --- UNIFORM HEIGHT FIX ---
// Define a single consistent ground elevation for the entire city.
// 2.5m is a safe height above water (Dry but close to sea level).
const getCityGroundY = () => resolveSeaLevelY() + 2.5;
export { getCityGroundY }; // Export for use across city systems
// --------------------------

// Shared city origin for all layout systems
export const CITY_CENTER_ORIGIN = new THREE.Vector3(0, getCityGroundY(), 0);

// Harbor ground height above sea level
export const HARBOR_GROUND_HEIGHT = 2.2;

// --- HARBOR POSITION ---
// SINGLE SOURCE OF TRUTH for the harbor's world position.
// All other systems (terrain, placement, etc.) should derive from this.
export const HARBOR_CENTER_3D = new THREE.Vector3(
  68,
  resolveSeaLevelY() + HARBOR_GROUND_HEIGHT,
  10,
);

// All districts now sit on the same flat plane
export const AGORA_CENTER_3D = new THREE.Vector3(-30, getCityGroundY(), 20);
export const ACROPOLIS_PEAK_3D = new THREE.Vector3(-4, getCityGroundY(), 0);
export const ISLAND_RADIUS = 205; // Kept for legacy ref, but world is mainland now

// Shrink exclusion zones to fit the tighter map
export const HARBOR_EXCLUDE_RADIUS = 60;
export const AGORA_RADIUS = 18;
export const ACROPOLIS_RADIUS = 15;
export const CITY_AREA_RADIUS = 56;

export const MIN_ABOVE_SEA = 2.0; 
export const MAX_SLOPE_DELTA = 0.35; 

export const MAIN_ROAD_WIDTH = 3.2;

export const HARBOR_CENTER = new THREE.Vector2(HARBOR_CENTER_3D.x, HARBOR_CENTER_3D.z);
export function getHarborSeaLevel() {
  return getSeaLevelY();
}

// Ensure the main city chunk grid aligns perfectly with the Agora/Acropolis height
export const CITY_CHUNK_CENTER = new THREE.Vector3(-20, getCityGroundY(), 12);
export const CITY_CHUNK_SIZE = new THREE.Vector2(50, 50);
export const CITY_SEED = 0x4d534349;

export const HARBOR_WATER_OFFSET = new THREE.Vector2(0, 0); 

const HARBOR_WATER_HALF_WIDTH = 95; // Extended east to reach new pin locations (±95 units in X)
const HARBOR_WATER_HALF_DEPTH_NORTH = 80; // Extended north for shipping lanes
const HARBOR_WATER_HALF_DEPTH_SOUTH = 33; // Extended south to reach new pin locations

// Compact harbor footprint for a tighter, more demo-friendly waterfront.
const COMPACT_HARBOR_WATER_HALF_WIDTH = 62;
const COMPACT_HARBOR_WATER_HALF_DEPTH_NORTH = 48;
const COMPACT_HARBOR_WATER_HALF_DEPTH_SOUTH = 28;

// East Harbor: Water extends East from the basin
export const HARBOR_WATER_EAST_LIMIT = HARBOR_CENTER_3D.x + COMPACT_HARBOR_WATER_HALF_WIDTH;

export const HARBOR_WATER_BOUNDS = {
  west: HARBOR_CENTER_3D.x - COMPACT_HARBOR_WATER_HALF_WIDTH,
  east: HARBOR_CENTER_3D.x + COMPACT_HARBOR_WATER_HALF_WIDTH,
  north: HARBOR_CENTER_3D.z + COMPACT_HARBOR_WATER_HALF_DEPTH_NORTH,
  south: HARBOR_CENTER_3D.z - COMPACT_HARBOR_WATER_HALF_DEPTH_SOUTH,
};

// The ocean sheet extends west to cover the full harbor basin so the carved
// seabed is never left exposed without a water plane above it.
export const AEGEAN_OCEAN_BOUNDS = {
  west: HARBOR_WATER_BOUNDS.east,
  east: HARBOR_CENTER_3D.x + 2400,
  north: HARBOR_CENTER_3D.z + 920,
  south: HARBOR_CENTER_3D.z - 860,
};

export const HARBOR_WATER_NORMAL_CANDIDATES = [
  "textures/water/normals.png",
  "textures/water/normals.jpg",
  "textures/ground/waternormals.jpg",
  "textures/ground/shader.png",
  "textures/ground/step_sea.gif",
];

// Walkway is West of the water (City side)
const HARBOR_WALKWAY_WEST = HARBOR_CENTER_3D.x - 42;
const HARBOR_WALKWAY_HALF_WIDTH = 9;

export const HARBOR_SETBACKS = [
  {
    west: HARBOR_WATER_BOUNDS.west,
    east: HARBOR_WATER_BOUNDS.east,
    north: HARBOR_WATER_BOUNDS.north,
    south: HARBOR_WATER_BOUNDS.south,
  },
  {
    // Walkway setback
    west: HARBOR_WALKWAY_WEST - 3,
    east: HARBOR_WALKWAY_WEST + 3,
    north: HARBOR_CENTER_3D.z - HARBOR_WALKWAY_HALF_WIDTH,
    south: HARBOR_CENTER_3D.z + HARBOR_WALKWAY_HALF_WIDTH,
  },
  {
    // Open sea setback for procedural city layout. The harbor basin and Aegean
    // read as water-owned space, so city roads/buildings should not render
    // across this larger seaward sheet.
    west: AEGEAN_OCEAN_BOUNDS.west,
    east: AEGEAN_OCEAN_BOUNDS.east,
    north: AEGEAN_OCEAN_BOUNDS.north,
    south: AEGEAN_OCEAN_BOUNDS.south,
  },
];

export const HARBOR_WATER_CENTER = new THREE.Vector3(
  HARBOR_CENTER_3D.x + HARBOR_WATER_OFFSET.x,
  resolveSeaLevelY(),
  HARBOR_CENTER_3D.z + HARBOR_WATER_OFFSET.y
);

// Sync updates
subscribeSeaLevelChange((seaLevelY) => {
  HARBOR_CENTER_3D.y = seaLevelY;
  HARBOR_WATER_CENTER.y = seaLevelY;

  const newGroundY = seaLevelY + 2.5;
  AGORA_CENTER_3D.y = newGroundY;
  ACROPOLIS_PEAK_3D.y = newGroundY;
  CITY_CHUNK_CENTER.y = newGroundY;
});
