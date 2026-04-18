import * as THREE from "three";
import { SPACING_RULES, WALKABILITY_CONFIG } from "../world/cityPlan.js";

/**
 * Debug utilities for city layout analysis
 * Reports building counts per district and terrain height variance
 */

/**
 * Analyze walkability grid and path connectivity
 */
export function analyzeWalkability(scene) {
  const civicDistrict = scene.getObjectByName('CivicDistrict');
  
  if (!civicDistrict || !civicDistrict.userData.plan) {
    console.warn('[Debug] CivicDistrict or plan not found');
    return null;
  }

  const { grid, pathTiles, reachability } = civicDistrict.userData.plan;

  const stats = {
    totalGridCells: grid?.length || 0,
    totalPathTiles: pathTiles?.length || 0,
    pathTypes: {},
    reachability: reachability || {},
    footpathCount: 0,
    connectorCount: 0,
    roadCount: 0,
  };

  // Count path types
  if (pathTiles) {
    for (const path of pathTiles) {
      stats.pathTypes[path.type] = (stats.pathTypes[path.type] || 0) + 1;
      
      if (path.type === 'footpath') stats.footpathCount++;
      else if (path.type === 'connector') stats.connectorCount++;
      else if (path.type === 'road') stats.roadCount++;
    }
  }

  return stats;
}

/**
 * Analyze buildings by district
 */
export function analyzeBuildingsByDistrict(scene) {
  const stats = {
    districts: {},
    total: 0,
    byType: {},
    slopeData: [],
  };

  scene.traverse((obj) => {
    if (obj.userData && obj.userData.isBuilding) {
      stats.total++;

      const district = obj.userData.district || "unknown";
      if (!stats.districts[district]) {
        stats.districts[district] = {
          count: 0,
          types: {},
          avgHeight: 0,
          heights: [],
          slopes: [],
        };
      }

      stats.districts[district].count++;
      stats.districts[district].heights.push(obj.position.y);

      // Track slope if available
      if (obj.userData.slope !== undefined) {
        stats.districts[district].slopes.push(obj.userData.slope);
        stats.slopeData.push({
          district,
          slope: obj.userData.slope,
          elevation: obj.position.y,
        });
      }

      const buildingType = obj.userData.buildingType || "generic";
      stats.districts[district].types[buildingType] =
        (stats.districts[district].types[buildingType] || 0) + 1;

      stats.byType[buildingType] = (stats.byType[buildingType] || 0) + 1;
    }
  });

  // Calculate average heights and slopes
  Object.keys(stats.districts).forEach((district) => {
    const heights = stats.districts[district].heights;
    if (heights.length > 0) {
      stats.districts[district].avgHeight =
        heights.reduce((a, b) => a + b, 0) / heights.length;
    }

    const slopes = stats.districts[district].slopes;
    if (slopes.length > 0) {
      stats.districts[district].avgSlope =
        slopes.reduce((a, b) => a + b, 0) / slopes.length;
    }
  });

  return stats;
}

/**
 * Analyze terrain height variance
 */
export function analyzeTerrainHeights(terrain, samplePoints = 100) {
  if (!terrain || !terrain.userData.getHeightAt) {
    console.warn("[Debug] Terrain sampler not available");
    return null;
  }

  const sampler = terrain.userData.getHeightAt;
  const size = terrain.geometry.userData.size || 2400;
  const halfSize = size / 2;

  const heights = [];
  const step = size / samplePoints;

  for (let x = -halfSize; x <= halfSize; x += step) {
    for (let z = -halfSize; z <= halfSize; z += step) {
      const h = sampler(x, z);
      if (h !== null && Number.isFinite(h)) {
        heights.push(h);
      }
    }
  }

  if (heights.length === 0) {
    return null;
  }

  heights.sort((a, b) => a - b);

  const min = heights[0];
  const max = heights[heights.length - 1];
  const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
  const median = heights[Math.floor(heights.length / 2)];

  // Calculate variance and standard deviation
  const variance =
    heights.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) /
    heights.length;
  const stdDev = Math.sqrt(variance);

  // Categorize heights
  const underwater = heights.filter((h) => h < 0).length;
  const shore = heights.filter((h) => h >= 0 && h < 3).length;
  const land = heights.filter((h) => h >= 3).length;

  return {
    min,
    max,
    mean,
    median,
    variance,
    stdDev,
    range: max - min,
    sampleCount: heights.length,
    distribution: {
      underwater,
      shore,
      land,
    },
  };
}

/**
 * Analyze landmark spacing violations - DISABLED
 */
export function analyzeLandmarkSpacing(scene) {
  return {
    totalLandmarks: 0,
    landmarks: [],
    violations: [],
    spacingRule: SPACING_RULES.LANDMARK_MIN_SPACING,
  };
}

/**
 * Check for overlapping buildings
 */
export function detectBuildingOverlaps(scene, threshold = 2.0) {
  const buildings = [];
  scene.traverse((obj) => {
    if (obj.userData && obj.userData.isBuilding) {
      buildings.push({
        object: obj,
        pos: obj.getWorldPosition(new THREE.Vector3()),
        district: obj.userData.district || "unknown",
      });
    }
  });

  const overlaps = [];
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const distance = buildings[i].pos.distanceTo(buildings[j].pos);
      if (distance < threshold) {
        overlaps.push({
          building1: buildings[i].object.name || "unnamed",
          building2: buildings[j].object.name || "unnamed",
          distance,
          district1: buildings[i].district,
          district2: buildings[j].district,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Check for buildings floating on water
 */
export function detectFloatingBuildings(scene, seaLevel = 0) {
  const floating = [];

  scene.traverse((obj) => {
    if (obj.userData && obj.userData.isBuilding) {
      const worldPos = obj.getWorldPosition(new THREE.Vector3());
      if (worldPos.y < seaLevel + 0.5) {
        floating.push({
          name: obj.name || "unnamed",
          position: worldPos.clone(),
          height: worldPos.y,
          district: obj.userData.district || "unknown",
        });
      }
    }
  });

  return floating;
}

/**
 * Print comprehensive debug report
 */
export function printCityDebugReport(scene, terrain, options = {}) {
  console.log("\n=== CITY LAYOUT DEBUG REPORT ===\n");

  // Building analysis
  console.log("📊 BUILDING ANALYSIS:");
  const buildingStats = analyzeBuildingsByDistrict(scene);
  console.log(`  Total Buildings: ${buildingStats.total}`);
  console.log("\n  By District:");
  Object.entries(buildingStats.districts)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([district, data]) => {
      console.log(`    ${district}:`);
      console.log(`      Count: ${data.count}`);
      console.log(`      Avg Height: ${data.avgHeight.toFixed(2)}m`);
      if (data.avgSlope !== undefined) {
        console.log(`      Avg Slope: ${data.avgSlope.toFixed(3)}`);
      }
      console.log(`      Types:`, data.types);
    });

  console.log("\n  By Type:");
  Object.entries(buildingStats.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });

  // Terrain analysis
  if (terrain) {
    console.log("\n🗺️  TERRAIN ANALYSIS:");
    const terrainStats = analyzeTerrainHeights(terrain, options.samplePoints || 100);
    if (terrainStats) {
      console.log(`  Height Range: ${terrainStats.min.toFixed(2)}m to ${terrainStats.max.toFixed(2)}m`);
      console.log(`  Mean: ${terrainStats.mean.toFixed(2)}m`);
      console.log(`  Median: ${terrainStats.median.toFixed(2)}m`);
      console.log(`  Std Dev: ${terrainStats.stdDev.toFixed(2)}m`);
      console.log(`  Variance: ${terrainStats.variance.toFixed(2)}`);
      console.log("\n  Distribution:");
      console.log(`    Underwater (< 0m): ${terrainStats.distribution.underwater} samples`);
      console.log(`    Shore (0-3m): ${terrainStats.distribution.shore} samples`);
      console.log(`    Land (> 3m): ${terrainStats.distribution.land} samples`);
    }
  }

  // Walkability analysis
  console.log("\n🚶 WALKABILITY ANALYSIS:");
  const walkStats = analyzeWalkability(scene);
  if (walkStats) {
    console.log(`  Total Grid Cells: ${walkStats.totalGridCells}`);
    console.log(`  Total Path Tiles: ${walkStats.totalPathTiles}`);
    console.log(`  Path Coverage: ${((walkStats.totalPathTiles / walkStats.totalGridCells) * 100).toFixed(1)}%`);
    console.log("\n  Path Types:");
    console.log(`    Roads: ${walkStats.roadCount}`);
    console.log(`    Footpaths: ${walkStats.footpathCount} (${WALKABILITY_CONFIG.PATH_SPACING}-tile spacing)`);
    console.log(`    Connectors: ${walkStats.connectorCount} (to key buildings)`);
    
    if (walkStats.reachability) {
      console.log("\n  Reachability (max ${WALKABILITY_CONFIG.MAX_REACHABILITY_DISTANCE} tiles):");
      if (walkStats.reachability.allReachable) {
        console.log(`    ✅ All ${walkStats.reachability.totalLocations} key locations reachable`);
      } else {
        console.log(`    ⚠️  ${walkStats.reachability.unreachable.length} locations unreachable`);
      }
      
      console.log("\n  Distances to Key Buildings:");
      Object.entries(walkStats.reachability.distances).forEach(([name, dist]) => {
        const status = dist === Infinity ? '❌' : dist <= WALKABILITY_CONFIG.MAX_REACHABILITY_DISTANCE ? '✅' : '⚠️';
        const distStr = dist === Infinity ? 'unreachable' : `${dist} tiles`;
        console.log(`    ${status} ${name}: ${distStr}`);
      });
    }
  } else {
    console.log("  ⚠️  Walkability data not available");
  }

  // Overlap detection
  console.log("\n⚠️  COLLISION DETECTION:");
  const overlaps = detectBuildingOverlaps(scene, options.overlapThreshold || 2.0);
  if (overlaps.length > 0) {
    console.log(`  Found ${overlaps.length} potential overlaps:`);
    overlaps.slice(0, 10).forEach((overlap) => {
      console.log(
        `    ${overlap.building1} ↔ ${overlap.building2}: ${overlap.distance.toFixed(2)}m apart`
      );
    });
    if (overlaps.length > 10) {
      console.log(`    ... and ${overlaps.length - 10} more`);
    }
  } else {
    console.log("  ✅ No building overlaps detected");
  }

  // Floating building detection
  const seaLevel = options.seaLevel || 0;
  console.log("\n🌊 WATER LEVEL CHECK:");
  const floating = detectFloatingBuildings(scene, seaLevel);
  if (floating.length > 0) {
    console.log(`  ⚠️  Found ${floating.length} buildings near/below water level:`);
    floating.slice(0, 10).forEach((building) => {
      console.log(
        `    ${building.name} at Y=${building.height.toFixed(2)}m (${building.district})`
      );
    });
    if (floating.length > 10) {
      console.log(`    ... and ${floating.length - 10} more`);
    }
  } else {
    console.log("  ✅ No floating buildings detected");
  }

  console.log("\n=== END REPORT ===\n");

  return {
    buildings: buildingStats,
    terrain: terrain ? analyzeTerrainHeights(terrain) : null,
    walkability: walkStats,
    overlaps,
    floating,
  };
}

/**
 * Enable debug mode via query parameter
 */
export function initCityDebugMode(scene, terrain) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get("citydebug") === "1" || params.get("debug") === "city";

  if (debugMode) {
    console.log("[CityDebug] Debug mode enabled");

    // Print report after a short delay to ensure scene is loaded
    setTimeout(() => {
      printCityDebugReport(scene, terrain, {
        samplePoints: 150,
        overlapThreshold: 3.0,
        seaLevel: 0,
      });
    }, 2000);

    // Make debug functions globally available
    if (window) {
      window.cityDebug = {
        printReport: () => printCityDebugReport(scene, terrain),
        analyzeTerrain: () => analyzeTerrainHeights(terrain),
        analyzeBuildings: () => analyzeBuildingsByDistrict(scene),
        analyzeWalkability: () => analyzeWalkability(scene),
        detectOverlaps: () => detectBuildingOverlaps(scene),
        detectFloating: () => detectFloatingBuildings(scene),
      };
      console.log("[CityDebug] Available commands:");
      console.log("  window.cityDebug.printReport()");
      console.log("  window.cityDebug.analyzeTerrain()");
      console.log("  window.cityDebug.analyzeBuildings()");
      console.log("  window.cityDebug.analyzeWalkability()");
      console.log("  window.cityDebug.detectOverlaps()");
      console.log("  window.cityDebug.detectFloating()");
    }
  }
}
