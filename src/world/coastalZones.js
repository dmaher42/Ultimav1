import * as THREE from "three";
import { getSeaLevelY } from "./locations.js";

/**
 * Coastal harbor zone utilities for realistic dock and pier placement
 * Defines buildable zones near water with grid-aligned slots
 */

const SEA_LEVEL_Y = () => getSeaLevelY();
const HARBOR_ZONE_THRESHOLD = 0.1; // Max height above sea level
const COAST_DISTANCE_THRESHOLD = 10; // Max distance from coast (meters)
const GRID_SLOT_SIZE = 10; // Grid alignment for docks/piers (10m slots)
const RAISED_PLATFORM_MIN = 0.3; // Min height for large structures
const RAISED_PLATFORM_MAX = 0.6; // Max height for large structures

/**
 * Calculate distance to nearest coastline (water edge)
 * @param {Function} terrainSampler - Height sampler function
 * @param {number} x - World X coordinate
 * @param {number} z - World Z coordinate
 * @param {number} searchRadius - How far to search for coast (default 50m)
 * @returns {number} Distance to coast in meters, or Infinity if not found
 */
export function getDistanceToCoast(terrainSampler, x, z, searchRadius = 50) {
  if (typeof terrainSampler !== 'function') {
    return Infinity;
  }

  const seaLevel = SEA_LEVEL_Y();
  const currentHeight = terrainSampler(x, z);

  // If already underwater, distance is 0
  if (currentHeight < seaLevel) {
    return 0;
  }

  // Sample in a spiral pattern to find coast
  let minDistance = Infinity;
  const samples = 32;
  const angleStep = (Math.PI * 2) / samples;

  for (let radius = 2; radius <= searchRadius; radius += 2) {
    for (let i = 0; i < samples; i++) {
      const angle = i * angleStep;
      const testX = x + Math.cos(angle) * radius;
      const testZ = z + Math.sin(angle) * radius;

      const height = terrainSampler(testX, testZ);

      // Found water edge
      if (Number.isFinite(height) && height < seaLevel + 0.05) {
        const distance = Math.sqrt(
          Math.pow(testX - x, 2) + Math.pow(testZ - z, 2)
        );
        minDistance = Math.min(minDistance, distance);
        // Early exit if we found a very close coast
        if (minDistance < 3) {
          return minDistance;
        }
      }
    }

    // If we found coast, no need to search further
    if (minDistance < Infinity) {
      return minDistance;
    }
  }

  return minDistance;
}

/**
 * Check if a tile is within the harbor zone
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
export function isInHarborZone(terrainSampler, x, z) {
  if (typeof terrainSampler !== 'function') {
    return false;
  }

  const seaLevel = SEA_LEVEL_Y();
  const elevation = terrainSampler(x, z);

  if (!Number.isFinite(elevation)) {
    return false;
  }

  // Must be at or just above sea level
  if (elevation > seaLevel + HARBOR_ZONE_THRESHOLD) {
    return false;
  }

  // Must be near coast
  const distanceToCoast = getDistanceToCoast(terrainSampler, x, z, 15);
  if (distanceToCoast > COAST_DISTANCE_THRESHOLD) {
    return false;
  }

  return true;
}

/**
 * Check if a tile is suitable for raised harbor structures (lighthouse, clocktower)
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
export function isRaisedPlatformZone(terrainSampler, x, z) {
  if (typeof terrainSampler !== 'function') {
    return false;
  }

  const seaLevel = SEA_LEVEL_Y();
  const elevation = terrainSampler(x, z);

  if (!Number.isFinite(elevation)) {
    return false;
  }

  // Must be in raised platform range
  const relativeHeight = elevation - seaLevel;
  if (relativeHeight < RAISED_PLATFORM_MIN || relativeHeight > RAISED_PLATFORM_MAX) {
    return false;
  }

  // Must be near coast
  const distanceToCoast = getDistanceToCoast(terrainSampler, x, z, 20);
  if (distanceToCoast > COAST_DISTANCE_THRESHOLD + 5) {
    return false;
  }

  return true;
}

/**
 * Snap position to grid-aligned slot
 * @param {number} x
 * @param {number} z
 * @param {number} slotSize - Grid slot size (default 10m)
 * @returns {Object} {x, z} snapped to grid
 */
export function snapToGridSlot(x, z, slotSize = GRID_SLOT_SIZE) {
  return {
    x: Math.round(x / slotSize) * slotSize,
    z: Math.round(z / slotSize) * slotSize,
  };
}

/**
 * Find all valid dock/pier slots within a search area
 * @param {Function} terrainSampler
 * @param {Object} searchArea - {centerX, centerZ, width, depth}
 * @param {number} slotSize - Grid slot size
 * @returns {Array} Array of valid slot positions
 */
export function findDockSlots(terrainSampler, searchArea, slotSize = GRID_SLOT_SIZE) {
  const { centerX, centerZ, width, depth } = searchArea;
  const slots = [];

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += slotSize) {
    for (let z = centerZ - halfDepth; z <= centerZ + halfDepth; z += slotSize) {
      if (isInHarborZone(terrainSampler, x, z)) {
        const snapped = snapToGridSlot(x, z, slotSize);
        
        // Avoid duplicates
        const exists = slots.some(
          (s) => Math.abs(s.x - snapped.x) < 1 && Math.abs(s.z - snapped.z) < 1
        );

        if (!exists) {
          const elevation = terrainSampler(x, z);
          const distanceToCoast = getDistanceToCoast(terrainSampler, x, z);

          slots.push({
            x: snapped.x,
            z: snapped.z,
            elevation,
            distanceToCoast,
            type: 'dock',
          });
        }
      }
    }
  }

  return slots;
}

/**
 * Find raised platform slots for large structures
 * @param {Function} terrainSampler
 * @param {Object} searchArea
 * @returns {Array} Array of raised platform positions
 */
export function findRaisedPlatformSlots(terrainSampler, searchArea, slotSize = GRID_SLOT_SIZE) {
  const { centerX, centerZ, width, depth } = searchArea;
  const platforms = [];

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += slotSize) {
    for (let z = centerZ - halfDepth; z <= centerZ + halfDepth; z += slotSize) {
      if (isRaisedPlatformZone(terrainSampler, x, z)) {
        const snapped = snapToGridSlot(x, z, slotSize);

        const exists = platforms.some(
          (p) => Math.abs(p.x - snapped.x) < 1 && Math.abs(p.z - snapped.z) < 1
        );

        if (!exists) {
          const elevation = terrainSampler(x, z);
          const seaLevel = SEA_LEVEL_Y();

          platforms.push({
            x: snapped.x,
            z: snapped.z,
            elevation,
            relativeHeight: elevation - seaLevel,
            type: 'raised',
          });
        }
      }
    }
  }

  return platforms;
}

/**
 * Analyze harbor zone coverage
 * @param {Function} terrainSampler
 * @param {Object} searchArea
 * @returns {Object} Analysis results
 */
export function analyzeHarborZone(terrainSampler, searchArea) {
  const dockSlots = findDockSlots(terrainSampler, searchArea);
  const raisedSlots = findRaisedPlatformSlots(terrainSampler, searchArea);

  // Calculate coverage statistics
  const totalArea = searchArea.width * searchArea.depth;
  const slotArea = GRID_SLOT_SIZE * GRID_SLOT_SIZE;
  const dockCoverage = (dockSlots.length * slotArea) / totalArea;
  const raisedCoverage = (raisedSlots.length * slotArea) / totalArea;

  // Find best positions for different structures
  const bestDockSlots = dockSlots
    .sort((a, b) => a.distanceToCoast - b.distanceToCoast)
    .slice(0, 20);

  const bestRaisedSlots = raisedSlots
    .sort((a, b) => b.relativeHeight - a.relativeHeight)
    .slice(0, 10);

  return {
    dockSlots: dockSlots.length,
    raisedSlots: raisedSlots.length,
    dockCoverage: dockCoverage * 100,
    raisedCoverage: raisedCoverage * 100,
    bestDockPositions: bestDockSlots,
    bestRaisedPositions: bestRaisedSlots,
    gridSlotSize: GRID_SLOT_SIZE,
  };
}

/**
 * Get zone description for debugging
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @returns {string}
 */
export function getZoneDescription(terrainSampler, x, z) {
  const seaLevel = SEA_LEVEL_Y();
  const elevation = terrainSampler(x, z);
  const distanceToCoast = getDistanceToCoast(terrainSampler, x, z);
  const relativeHeight = elevation - seaLevel;

  const inHarborZone = isInHarborZone(terrainSampler, x, z);
  const inRaisedZone = isRaisedPlatformZone(terrainSampler, x, z);

  let zone = 'none';
  if (inHarborZone) zone = 'harbor (dock/pier)';
  if (inRaisedZone) zone = 'raised (lighthouse/tower)';

  return `Zone: ${zone}, Elevation: ${elevation.toFixed(2)}m (${relativeHeight >= 0 ? '+' : ''}${relativeHeight.toFixed(2)}m), Coast: ${distanceToCoast.toFixed(1)}m`;
}

/**
 * Constants for external use
 */
export const HARBOR_ZONE_CONFIG = {
  SEA_LEVEL_THRESHOLD: HARBOR_ZONE_THRESHOLD,
  COAST_DISTANCE_MAX: COAST_DISTANCE_THRESHOLD,
  GRID_SLOT_SIZE,
  RAISED_MIN: RAISED_PLATFORM_MIN,
  RAISED_MAX: RAISED_PLATFORM_MAX,
};
