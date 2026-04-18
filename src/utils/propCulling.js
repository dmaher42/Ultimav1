import * as THREE from "three";

/**
 * Simple prop culling system for improving performance in cluttered areas
 * Handles overlap detection, redundancy removal, and distance-based culling
 */

const _box = new THREE.Box3();
const _vec3 = new THREE.Vector3();
const _cameraWorldPosition = new THREE.Vector3();
const _propWorldPosition = new THREE.Vector3();
const SMALL_PROP_THRESHOLD = 1.0; // Props with bounding box < 1x1x1
const OVERLAP_THRESHOLD = 0.5; // Distance threshold for overlap detection
const DISTANCE_CULLING_ENABLED = true;
const CULL_DISTANCE_NEAR = 100; // Distance at which to start culling small props
const CULL_DISTANCE_FAR = 200; // Distance at which all small props are culled
const smallPropCache = new WeakMap();

function isRigAttachment(mesh) {
  let current = mesh;
  while (current) {
    if (current.isBone || current.isSkinnedMesh) {
      return true;
    }
    current = current.parent ?? null;
  }
  return false;
}

/**
 * Check if a mesh is a small prop based on bounding box size
 */
function isSmallProp(mesh) {
  if (!mesh.isMesh) return false;
  if (!mesh.geometry) return false;
  if (mesh.userData?.noCull) return false;
  if (isRigAttachment(mesh)) return false;
  
  // Skip instanced meshes (handled separately)
  if (mesh.isInstancedMesh) return false;
  
  // Compute bounding box
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }
  
  const bbox = mesh.geometry.boundingBox;
  if (!bbox) return false;
  
  const size = new THREE.Vector3();
  bbox.getSize(size);
  
  // Apply mesh scale
  size.multiply(mesh.scale);
  
  // Check if all dimensions are below threshold
  return size.x < SMALL_PROP_THRESHOLD && 
         size.y < SMALL_PROP_THRESHOLD && 
         size.z < SMALL_PROP_THRESHOLD;
}

/**
 * Get world position of a mesh
 */
function getWorldPosition(mesh, target) {
  mesh.getWorldPosition(target);
  return target;
}

/**
 * Check if two props overlap or are too close
 */
function arePropsOverlapping(meshA, meshB) {
  const posA = getWorldPosition(meshA, new THREE.Vector3());
  const posB = getWorldPosition(meshB, new THREE.Vector3());
  
  const distance = posA.distanceTo(posB);
  return distance < OVERLAP_THRESHOLD;
}

/**
 * Calculate visibility score for a prop (lower = less visible, more likely to cull)
 */
function calculateVisibilityScore(mesh, cameraPos) {
  const worldPos = getWorldPosition(mesh, new THREE.Vector3());
  
  // Distance from camera (closer = higher score)
  const distance = worldPos.distanceTo(cameraPos);
  const distanceScore = 1000 / (distance + 1);
  
  // Y height (higher = more visible = higher score)
  const heightScore = worldPos.y * 10;
  
  // Scale (larger = more visible = higher score)
  const scaleScore = (mesh.scale.x + mesh.scale.y + mesh.scale.z) * 10;
  
  // Visibility flag
  const visibilityPenalty = mesh.visible ? 0 : -1000;
  
  return distanceScore + heightScore + scaleScore + visibilityPenalty;
}

function collectSmallProps(scene) {
  const smallProps = [];
  scene.traverse((obj) => {
    if (isSmallProp(obj)) {
      smallProps.push(obj);
    }
  });
  smallPropCache.set(scene, smallProps);
  return smallProps;
}

function getSmallProps(scene, { refresh = false } = {}) {
  if (!scene) return [];
  if (!refresh) {
    const cached = smallPropCache.get(scene);
    if (Array.isArray(cached)) {
      return cached;
    }
  }
  return collectSmallProps(scene);
}

/**
 * Remove overlapping props, keeping the most visible one in each cluster
 */
export function cullOverlappingProps(scene, options = {}) {
  const cameraPos = options.cameraPos || new THREE.Vector3(0, 5, 0);
  const dryRun = options.dryRun || false;
  
  console.log("[PropCulling] Scanning for overlapping props...");
  
  const smallProps = Array.isArray(options.smallProps)
    ? options.smallProps
    : getSmallProps(scene);
  
  console.log(`[PropCulling] Found ${smallProps.length} small props`);
  
  if (smallProps.length === 0) return { culled: 0, kept: 0 };
  
  // Build spatial hash for efficient overlap detection
  const spatialGrid = new Map();
  const gridSize = 2.0; // Grid cell size for spatial hashing
  
  smallProps.forEach((prop) => {
    const worldPos = getWorldPosition(prop, new THREE.Vector3());
    const gridX = Math.floor(worldPos.x / gridSize);
    const gridZ = Math.floor(worldPos.z / gridSize);
    const key = `${gridX},${gridZ}`;
    
    if (!spatialGrid.has(key)) {
      spatialGrid.set(key, []);
    }
    spatialGrid.get(key).push(prop);
  });
  
  // Track which props to cull
  const toCull = new Set();
  let clusterCount = 0;
  
  // Check each grid cell for overlaps
  spatialGrid.forEach((props, key) => {
    if (props.length <= 1) return;
    
    // Check all pairs in this cell and adjacent cells
    for (let i = 0; i < props.length; i++) {
      if (toCull.has(props[i])) continue;
      
      const overlapping = [props[i]];
      
      for (let j = i + 1; j < props.length; j++) {
        if (toCull.has(props[j])) continue;
        
        if (arePropsOverlapping(props[i], props[j])) {
          overlapping.push(props[j]);
        }
      }
      
      // If we found a cluster, keep the most visible and cull the rest
      if (overlapping.length > 1) {
        clusterCount++;
        
        // Sort by visibility score (descending)
        overlapping.sort((a, b) => 
          calculateVisibilityScore(b, cameraPos) - 
          calculateVisibilityScore(a, cameraPos)
        );
        
        // Cull all but the most visible
        for (let k = 1; k < overlapping.length; k++) {
          toCull.add(overlapping[k]);
        }
      }
    }
  });
  
  // Apply culling
  let culledCount = 0;
  if (!dryRun && toCull.size > 0) {
    toCull.forEach((prop) => {
      prop.visible = false;
      prop.userData.culled = true;
      culledCount++;
    });
  }
  
  console.log(`[PropCulling] Found ${clusterCount} clusters, culled ${dryRun ? toCull.size + ' (dry run)' : culledCount} props`);
  
  return {
    culled: toCull.size,
    kept: smallProps.length - toCull.size,
    clusters: clusterCount
  };
}

/**
 * Distance-based culling for small props
 * Should be called every frame or periodically
 */
export function updateDistanceCulling(scene, camera, options = {}) {
  if (!DISTANCE_CULLING_ENABLED) return;
  
  const nearDistance = options.nearDistance || CULL_DISTANCE_NEAR;
  const farDistance = options.farDistance || CULL_DISTANCE_FAR;

  const cameraPos = camera.getWorldPosition(_cameraWorldPosition);
  const smallProps = getSmallProps(scene);

  for (const obj of smallProps) {
    if (!obj?.parent) continue;
    if (obj.userData?.culled) continue;
    const worldPos = getWorldPosition(obj, _propWorldPosition);
    const distance = worldPos.distanceTo(cameraPos);
    
    if (distance > farDistance) {
      // Far away - hide completely
      obj.visible = false;
    } else if (distance > nearDistance) {
      // Gradual fade zone - could use opacity or just hide
      // For now, just hide (simpler and more performant)
      obj.visible = false;
    } else {
      // Near - show if not permanently culled
      obj.visible = true;
    }
  }
}

/**
 * Mark important props that should never be culled
 */
export function markImportantProps(scene, predicate) {
  scene.traverse((obj) => {
    if (obj.isMesh && predicate(obj)) {
      obj.userData.noCull = true;
    }
  });
}

/**
 * Initialize prop culling system
 * Call this after scene is loaded
 */
export function initPropCulling(scene, camera, options = {}) {
  console.log("[PropCulling] Initializing prop culling system...");
  
  // Get camera position for visibility scoring
  const cameraPos = camera.getWorldPosition(new THREE.Vector3());
  
  // Mark important props (e.g., large props)
  markImportantProps(scene, (obj) => {
    // Don't cull anything with "important" in the name
    if (obj.name && obj.name.toLowerCase().includes("important")) return true;

    return false;
  });

  const smallProps = getSmallProps(scene, { refresh: true });
  
  // Run initial overlap culling
  const result = cullOverlappingProps(scene, { 
    cameraPos,
    smallProps,
    dryRun: options.dryRun || false 
  });
  
  console.log(`[PropCulling] Initial culling complete: ${result.culled} culled, ${result.kept} kept`);
  
  return result;
}
