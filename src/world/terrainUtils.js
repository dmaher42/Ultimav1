import * as THREE from "three";

/**
 * Terrain analysis utilities for slope and elevation-based city planning
 * Enables realistic, walkable city layouts based on topography
 */

// Slope thresholds for different building types
export const SLOPE_THRESHOLDS = {
  FLAT: 0.2,      // Civic landmarks, temples, monuments
  GENTLE: 0.5,    // Residential, markets, shops
  MODERATE: 0.75, // Max buildable slope
};

// Elevation preferences for different districts
export const ELEVATION_PREFERENCES = {
  SACRED: { min: 5, ideal: 15, max: 40 },      // High ground (Acropolis)
  CIVIC: { min: 2, ideal: 4, max: 8 },         // Flat, accessible (Agora)
  RESIDENTIAL: { min: 1, ideal: 5, max: 20 },  // Varied terrain
  COMMERCIAL: { min: 0.5, ideal: 3, max: 10 }, // Near flat, accessible
  HARBOR: { min: 0, ideal: 2, max: 4 },        // Low, near water
};

/**
 * Calculate slope at a point using terrain sampler
 * @param {Function} terrainSampler - Function that returns height at (x, z)
 * @param {number} x - World X coordinate
 * @param {number} z - World Z coordinate
 * @param {number} sampleDistance - Distance for gradient calculation (default 2.0)
 * @returns {number} Slope magnitude (0 = flat, higher = steeper)
 */
export function getSlope(terrainSampler, x, z, sampleDistance = 2.0) {
  if (typeof terrainSampler !== 'function') {
    console.warn('[TerrainUtils] Invalid terrain sampler');
    return 0;
  }

  const h = terrainSampler(x, z);
  const hx = terrainSampler(x + sampleDistance, z);
  const hz = terrainSampler(x, z + sampleDistance);

  if (!Number.isFinite(h) || !Number.isFinite(hx) || !Number.isFinite(hz)) {
    return 0;
  }

  const dx = (hx - h) / sampleDistance;
  const dz = (hz - h) / sampleDistance;

  // Return gradient magnitude (slope)
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Calculate average slope over an area
 * @param {Function} terrainSampler
 * @param {number} x - Center X
 * @param {number} z - Center Z
 * @param {number} radius - Area radius
 * @param {number} samples - Number of sample points
 * @returns {number} Average slope
 */
export function getAverageSlope(terrainSampler, x, z, radius = 10, samples = 9) {
  if (typeof terrainSampler !== 'function') return 0;

  const slopes = [];
  const step = radius / Math.sqrt(samples);

  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dz = -radius; dz <= radius; dz += step) {
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance <= radius) {
        const slope = getSlope(terrainSampler, x + dx, z + dz);
        if (Number.isFinite(slope)) {
          slopes.push(slope);
        }
      }
    }
  }

  if (slopes.length === 0) return 0;
  return slopes.reduce((a, b) => a + b, 0) / slopes.length;
}

/**
 * Get elevation at a point
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @returns {number} Elevation or 0 if invalid
 */
export function getElevation(terrainSampler, x, z) {
  if (typeof terrainSampler !== 'function') return 0;
  const h = terrainSampler(x, z);
  return Number.isFinite(h) ? h : 0;
}

/**
 * Check if a location is suitable for a building type based on slope
 * @param {number} slope
 * @param {string} buildingType - 'civic', 'residential', 'commercial', etc.
 * @returns {boolean}
 */
export function isSlopeValidForBuilding(slope, buildingType) {
  // All buildings must be below moderate slope threshold
  if (slope > SLOPE_THRESHOLDS.MODERATE) {
    return false;
  }

  switch (buildingType) {
    case 'civic':
    case 'temple':
    case 'monument':
    case 'sacred':
      // Civic/cultural landmarks need flat land
      return slope < SLOPE_THRESHOLDS.FLAT;

    case 'residential':
    case 'commercial':
    case 'market':
    case 'shop':
      // Housing and markets can handle gentle slopes
      return slope < SLOPE_THRESHOLDS.GENTLE;

    case 'warehouse':
    case 'workshop':
    case 'harbor':
      // Industrial buildings prefer flatter terrain
      return slope < SLOPE_THRESHOLDS.FLAT + 0.1;

    default:
      // Generic buildings use gentle slope threshold
      return slope < SLOPE_THRESHOLDS.GENTLE;
  }
}

/**
 * Check if elevation is within preferred range for district
 * @param {number} elevation
 * @param {string} district
 * @returns {number} Suitability score (0-1, higher is better)
 */
export function getElevationSuitability(elevation, district) {
  const prefs = ELEVATION_PREFERENCES[district.toUpperCase()] || ELEVATION_PREFERENCES.RESIDENTIAL;

  // Out of range
  if (elevation < prefs.min || elevation > prefs.max) {
    return 0;
  }

  // Within range - score based on distance from ideal
  const distanceFromIdeal = Math.abs(elevation - prefs.ideal);
  const range = prefs.max - prefs.min;
  const normalizedDistance = distanceFromIdeal / range;

  // Sigmoid-like falloff
  return Math.max(0, 1 - normalizedDistance * 2);
}

/**
 * Analyze a tile for building suitability
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @param {string} district
 * @param {string} buildingType
 * @returns {Object} Analysis results
 */
export function analyzeTile(terrainSampler, x, z, district, buildingType) {
  const slope = getAverageSlope(terrainSampler, x, z, 8, 9);
  const elevation = getElevation(terrainSampler, x, z);
  
  const slopeValid = isSlopeValidForBuilding(slope, buildingType);
  const elevationScore = getElevationSuitability(elevation, district);
  
  // Overall suitability (0-1)
  const suitability = slopeValid ? elevationScore * (1 - Math.min(slope / SLOPE_THRESHOLDS.MODERATE, 1) * 0.3) : 0;

  return {
    slope,
    elevation,
    slopeValid,
    elevationScore,
    suitability,
    buildable: slopeValid && suitability > 0.3,
  };
}

/**
 * Find best locations for a district type within a search area
 * @param {Function} terrainSampler
 * @param {Object} searchArea - {centerX, centerZ, radius}
 * @param {string} district
 * @param {number} maxResults
 * @returns {Array} Sorted list of suitable locations
 */
export function findBestLocations(terrainSampler, searchArea, district, maxResults = 20) {
  const { centerX, centerZ, radius } = searchArea;
  const step = 12; // Sample every 12 units
  const candidates = [];

  for (let x = centerX - radius; x <= centerX + radius; x += step) {
    for (let z = centerZ - radius; z <= centerZ + radius; z += step) {
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2));
      if (distance > radius) continue;

      const buildingType = district === 'sacred' ? 'temple' : 
                          district === 'civic' ? 'civic' :
                          district === 'commercial' ? 'shop' : 'residential';

      const analysis = analyzeTile(terrainSampler, x, z, district, buildingType);
      
      if (analysis.buildable) {
        candidates.push({
          x,
          z,
          elevation: analysis.elevation,
          slope: analysis.slope,
          suitability: analysis.suitability,
          distance,
        });
      }
    }
  }

  // Sort by suitability (higher is better)
  candidates.sort((a, b) => b.suitability - a.suitability);

  return candidates.slice(0, maxResults);
}

/**
 * Get terrain characteristics summary for debugging
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @returns {string}
 */
export function getTerrainDescription(terrainSampler, x, z) {
  const slope = getSlope(terrainSampler, x, z);
  const elevation = getElevation(terrainSampler, x, z);

  let slopeDesc = 'flat';
  if (slope > SLOPE_THRESHOLDS.MODERATE) slopeDesc = 'too steep';
  else if (slope > SLOPE_THRESHOLDS.GENTLE) slopeDesc = 'moderate';
  else if (slope > SLOPE_THRESHOLDS.FLAT) slopeDesc = 'gentle';

  return `Elevation: ${elevation.toFixed(1)}m, Slope: ${slope.toFixed(2)} (${slopeDesc})`;
}

/**
 * Calculate terrain flatness variance (lower = flatter)
 * @param {Function} terrainSampler
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @returns {number} Variance in elevation
 */
export function getTerrainFlatness(terrainSampler, x, z, radius = 10) {
  const samples = [];
  const step = radius / 3;

  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dz = -radius; dz <= radius; dz += step) {
      const h = terrainSampler(x + dx, z + dz);
      if (Number.isFinite(h)) {
        samples.push(h);
      }
    }
  }

  if (samples.length < 2) return 0;

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / samples.length;

  return variance;
}
