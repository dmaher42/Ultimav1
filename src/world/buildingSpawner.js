import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { 
  makeMarbleMaterial, 
  makeMonumentalStoneMaterial, 
  makeAncientWoodMaterial, 
  makeMediterraneanPlasterMaterial,
  makeTerracottaRoofMaterial
} from './materials.js';

function createMaterial(type, rng, overrides = {}) {
  let mat;
  switch (type) {
    case "marble": mat = makeMarbleMaterial(); break;
    case "stone":  mat = makeMonumentalStoneMaterial(); break;
    case "wood":   mat = makeAncientWoodMaterial(); break;
    case "plaster":mat = makeMediterraneanPlasterMaterial(); break;
    case "roof":   mat = makeTerracottaRoofMaterial(); break;
    default:       mat = makeMonumentalStoneMaterial();
  }
  
  if (overrides.color) mat.color.set(overrides.color);
  if (overrides.roughness !== undefined) mat.roughness = overrides.roughness;
  if (overrides.metalness !== undefined) mat.metalness = overrides.metalness;
  
  return mat;
}

function makeBox(w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function makeGableRoof(w, d, h, rng, color = null) {
  const g = new THREE.Group();
  const roofColor = color || (rng() > 0.5 ? 0xffffff : 0xeeeeee);
  const mat = createMaterial("roof", rng, { color: roofColor });
  
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(w / 2, 0);
  shape.lineTo(-w / 2, 0);

  const extrudeSettings = { depth: d, bevelEnabled: false };
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrudeSettings), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = d / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/**
 * Procedural Prefabs
 * All buildings are generated at runtime to allow for infinite variety and lightweight builds.
 */
export const Prefabs = {
  house({ w = 4, d = 4, h = 3, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralHouse";
    const body = makeBox(w, h, d, createMaterial("plaster", rng));
    body.position.y = h / 2; g.add(body);
    const roof = makeGableRoof(w + 0.4, d + 0.2, 1.2, rng);
    roof.position.y = h; g.add(roof);
    return g;
  },
  rowhouse({ w = 3.5, d = 6, h = 5, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralRowhouse";
    const body = makeBox(w, h, d, createMaterial("plaster", rng, { color: 0xd7ccc8 }));
    body.position.y = h / 2; g.add(body);
    const roof = makeGableRoof(w + 0.2, d + 0.4, 1.5, rng, 0x5d4037);
    roof.position.y = h; g.add(roof);
    return g;
  },
  shop({ w = 5, d = 5, h = 4, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralShop";
    const body = makeBox(w, h, d, createMaterial("stone", rng));
    body.position.y = h / 2; g.add(body);
    const porch = makeBox(w, 0.2, 1.5, createMaterial("wood", rng));
    porch.position.set(0, 0.1, d / 2 + 0.75); g.add(porch);
    return g;
  },
  workshop({ w = 6, d = 8, h = 3.5, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralWorkshop";
    const body = makeBox(w, h, d, createMaterial("stone", rng, { color: 0x8d6e63 }));
    body.position.y = h / 2; g.add(body);
    const chimney = makeBox(0.8, 2.5, 0.8, createMaterial("stone", rng));
    chimney.position.set(w * 0.3, h + 1, d * 0.3); g.add(chimney);
    return g;
  },
  warehouse({ w = 10, d = 15, h = 6, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralWarehouse";
    const body = makeBox(w, h, d, createMaterial("stone", rng, { color: 0x757575 }));
    body.position.y = h / 2; g.add(body);
    return g;
  },
  stoa({ w = 15, d = 4, h = 5, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralStoa";
    const body = makeBox(w, h, d, createMaterial("marble", rng));
    body.position.y = h / 2; g.add(body);
    const colCount = 8;
    for (let i = 0; i < colCount; i++) {
      const x = (i / (colCount - 1) - 0.5) * w * 0.9;
      const col = makeDetailedColumn(h, 0.3, rng, "low");
      col.position.set(x, h/2, d/2 + 0.5); g.add(col);
    }
    return g;
  },
  fountain({ radius = 2, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralFountain";
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, 0.6, 16), createMaterial("marble", rng));
    basin.position.y = 0.3; g.add(basin);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1.5, 8), createMaterial("marble", rng));
    spout.position.y = 1.0; g.add(spout);
    return g;
  },
  plaza({ w = 10, d = 10, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralPlaza";
    const floor = makeBox(w, 0.1, d, createMaterial("stone", rng, { color: 0xaaaaaa }));
    floor.position.y = 0.05; g.add(floor);
    return g;
  },
  courtyard({ w = 8, d = 8, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralCourtyard";
    const wallHeight = 2.5;
    const walls = [
      makeBox(w, wallHeight, 0.4, createMaterial("plaster", rng)),
      makeBox(w, wallHeight, 0.4, createMaterial("plaster", rng)),
      makeBox(0.4, wallHeight, d, createMaterial("plaster", rng)),
      makeBox(0.4, wallHeight, d, createMaterial("plaster", rng))
    ];
    walls[0].position.set(0, wallHeight/2, d/2);
    walls[1].position.set(0, wallHeight/2, -d/2);
    walls[2].position.set(w/2, wallHeight/2, 0);
    walls[3].position.set(-w/2, wallHeight/2, 0);
    walls.forEach(w => g.add(w));
    return g;
  },
  pier({ w = 3, d = 12, rng = Math.random } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralPier";
    const deck = makeBox(w, 0.4, d, createMaterial("wood", rng));
    deck.position.y = 0.2; g.add(deck);
    const pilingGeom = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 10);
    const pilingMat = createMaterial("wood", rng, { color: 0x6d4c41 });
    const spacing = d / 4;
    for (let i = -1; i <= 1; i++) {
      for (let j = 0; j < 5; j++) {
        const pile = new THREE.Mesh(pilingGeom, pilingMat);
        pile.position.set(i * (w * 0.4), -0.6, -d * 0.5 + j * spacing);
        pile.castShadow = pile.receiveShadow = true;
        g.add(pile);
      }
    }
    return g;
  },
  market() { return Prefabs.shop({}); },
  monument() { return Prefabs.fountain(); },
  temple({ w = 12, d = 18, h = 6, rng = Math.random, roofColor = null, detailLevel = "full" } = {}) {
    const g = new THREE.Group();
    g.name = "ProceduralTemple";
    const stylobate = makeBox(w, 1.0, d, createMaterial("marble", rng));
    stylobate.position.y = 0.5; g.add(stylobate);
    
    // Add sub-base
    const subBase = makeBox(w * 1.1, 0.4, d * 1.1, createMaterial("stone", rng));
    subBase.position.y = 0.2; g.add(subBase);

    const cella = makeBox(w * 0.7, h, d * 0.6, createMaterial("stone", rng));
    cella.position.y = 1.0 + h * 0.5; g.add(cella);
    
    const roofHeight = 1.8;
    const roof = makeGableRoof(w * 0.9, d * 0.9, roofHeight, rng, roofColor);
    roof.position.y = 1.0 + h + roofHeight * 0.5; g.add(roof);

    // Add Architrave & Frieze Layer
    const architrave = makeBox(w * 0.92, 0.4, d * 0.98, createMaterial("marble", rng));
    architrave.position.y = 1.0 + h - 0.2; g.add(architrave);

    const frieze = makeBox(w * 0.88, 0.35, d * 0.96, createMaterial("marble", rng));
    frieze.position.y = 1.0 + h + 0.15; g.add(frieze);

    const perSide = 6;
    for (let i = 0; i < perSide; i++) {
      const t = i / (perSide - 1);
      const offsetX = THREE.MathUtils.lerp(-w * 0.45, w * 0.45, t);
      const col = makeDetailedColumn(h * 0.9, 0.45, rng, detailLevel);
      col.position.set(offsetX, 1.0 + (h * 0.45), d * 0.48);
      g.add(col);

      const colBack = col.clone();
      colBack.position.z = -d * 0.48;
      g.add(colBack);
    }

    return g;
  },
};

function makeDetailedColumn(height, radius, rng, detailLevel = "full") {
  const g = new THREE.Group();
  const colMat = createMaterial("marble", rng, { metalness: 0.04 });
  
  // Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height, 16), colMat);
  shaft.castShadow = shaft.receiveShadow = true;
  g.add(shaft);

  if (detailLevel !== "low") {
    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.2, radius * 1.3, height * 0.08, 16), colMat);
    base.position.y = -height * 0.5 + height * 0.04;
    g.add(base);

    // Capital
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.4, radius * 1.1, height * 0.1, 16), colMat);
    cap.position.y = height * 0.5 - height * 0.05;
    g.add(cap);
    
    const abacus = makeBox(radius * 3, height * 0.05, radius * 3, colMat);
    abacus.position.y = height * 0.5;
    g.add(abacus);
  }

  return g;
}


// Map allowedTypes → prefab id (GLB fallback removed)
const TYPE_MAP = {
  house:     { prefab: "house" },
  rowhouse:  { prefab: "rowhouse" },
  shop:      { prefab: "shop" },
  workshop:  { prefab: "workshop" },
  warehouse: { prefab: "warehouse" },
  stoa:      { prefab: "stoa" },
  fountain:  { prefab: "fountain" },
  plaza:     { prefab: "plaza" },
  temple:    { prefab: "temple" },
  pier:      { prefab: "pier" },
  market:    { prefab: "market" },
  monument:  { prefab: "monument" },
  garden:    { prefab: "courtyard" },
};

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function mulberry32(a) { return function() { let t=(a+=0x6D2B79F5); t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }

function hashCombine(a, b) {
  let h = Math.imul(a ^ b, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function getPadSeed(pad, baseSeed = 0) {
  const lotId = pad?.userData?.lotId ?? pad?.userData?.id ?? pad?.name ?? 0;
  const pos = pad?.position || new THREE.Vector3(0,0,0);
  let seed = hashCombine(baseSeed >>> 0, Math.floor(pos.x * 1000));
  seed = hashCombine(seed, Math.floor(pos.z * 1000));

  if (typeof lotId === "string") {
    for (let i = 0; i < lotId.length; i++) {
      seed = hashCombine(seed, lotId.charCodeAt(i));
    }
  } else if (Number.isFinite(lotId)) {
    seed = hashCombine(seed, Math.floor(lotId));
  }

  return seed >>> 0;
}

/**
 * Spawn a single building group.
 * Used by cityPlan.js for fine-grained procedural layout.
 */
export function spawnBuilding(options = {}) {
  const {
    district = "residential",
    rng = Math.random,
    districtRules = {},
    detailLevel = "full",
    preferRowhouseMass = false,
    w = 5,
    d = 7
  } = options;

  const allowed = (Array.isArray(districtRules.allowedTypes) && districtRules.allowedTypes.length > 0)
    ? districtRules.allowedTypes
    : ["house"];

  const typeKey = pick(allowed, rng);
  const mapping = TYPE_MAP[typeKey] || TYPE_MAP.house;
  let prefabKey = mapping.prefab;

  // Massing overrides
  if (preferRowhouseMass && (prefabKey === "house" || prefabKey === "shop")) {
    prefabKey = "rowhouse";
  }

  const prefabFn = Prefabs[prefabKey] || Prefabs.house;

  let h = 3.5;
  if (Array.isArray(districtRules.heightRange) && districtRules.heightRange.length === 2) {
    const [minH, maxH] = districtRules.heightRange;
    h = minH + rng() * (maxH - minH);
  } else {
    h = prefabKey === "temple" ? 6 : (2.5 + rng() * 2.5);
  }

  const built = prefabFn({
    w,
    d,
    h,
    rng,
    detailLevel
  });

  built.userData = { ...built.userData, district, type: typeKey, isBuilding: true };
  return built;
}

/**
 * Replace or augment LotPads with buildings.
 */
export function spawnBuildings(scene, pads, { seed = 1234 } = {}) {
  console.time("City: Spawning Buildings");
  let count = 0;

  pads.forEach((pad) => {
    const padSeed = getPadSeed(pad, seed);
    const rng = mulberry32(padSeed);

    const allowedTypes = pad.userData?.allowedTypes || ["house"];
    const typeKey = pick(allowedTypes, rng);
    const mapping = TYPE_MAP[typeKey] || TYPE_MAP.house;

    const prefabFn = Prefabs[mapping.prefab];
    if (typeof prefabFn === "function") {
      const b = prefabFn({
        w: pad.scale.x,
        d: pad.scale.z,
        h: mapping.prefab === "temple" ? 6 : (2 + rng() * 3),
        rng: rng
      });
      b.position.copy(pad.position);
      b.rotation.copy(pad.rotation);
      scene.add(b);
      count++;
      
      pad.visible = false;
    }
  });

  console.timeEnd("City: Spawning Buildings");
}

/**
 * Optimize: Batch identical materials and merge geometries
 */
export function poolMaterialsAndMerge(group) {
  const materialPool = new Map();
  const geomMap = new Map();

  function getPooledMaterial(mat) {
    const colorHex = mat.color ? mat.color.getHex() : 0;
    const r = Math.round((mat.roughness || 0) * 100) / 100;
    const m = Math.round((mat.metalness || 0) * 100) / 100;
    const t = mat.userData?.materialType || "none";
    const o = Math.round((mat.opacity || 1) * 100) / 100;
    const tp = Boolean(mat.transparent);

    const key = `${t}_${colorHex}_${r}_${m}_${o}_${tp}`;
    if (!materialPool.has(key)) {
      materialPool.set(key, mat);
    }
    return materialPool.get(key);
  }

  group.updateMatrixWorld(true);
  const toRemove = [];

  group.traverse((child) => {
    if (!child.isMesh || !child.geometry || !child.material) return;
    if (child.userData?.isWindowPane) return; 

    let clonedGeom = child.geometry.clone();
    clonedGeom.applyMatrix4(child.matrixWorld);

    // Ensure compatible attributes for merging
    if (!clonedGeom.attributes.uv) {
      const positionAttr = clonedGeom.attributes.position;
      const uvAttr = new Float32Array(positionAttr.count * 2);
      clonedGeom.setAttribute('uv', new THREE.BufferAttribute(uvAttr, 2));
    }

    // Force all to non-indexed to avoid "Compatible attributes" errors in mergeGeometries
    if (clonedGeom.index) {
      clonedGeom = clonedGeom.toNonIndexed();
    }

    const pooledMat = getPooledMaterial(child.material);
    const matId = pooledMat.uuid;

    if (!geomMap.has(matId)) {
      geomMap.set(matId, { material: pooledMat, geoms: [] });
    }

    geomMap.get(matId).geoms.push(clonedGeom);
    toRemove.push(child);
  });

  toRemove.forEach((child) => {
    if (child.parent) child.parent.remove(child);
  });

  for (const batch of geomMap.values()) {
    if (batch.geoms.length === 0) continue;
    try {
      const mergedGeom = BufferGeometryUtils.mergeGeometries(batch.geoms, false);
      if (mergedGeom) {
        const mergedMesh = new THREE.Mesh(mergedGeom, batch.material);
        mergedMesh.castShadow = true;
        mergedMesh.receiveShadow = true;
        mergedMesh.name = `MergedBatch_${batch.material.userData?.materialType || 'Generic'}`;
        group.add(mergedMesh);
      }
    } catch (e) {
      console.warn("[buildingSpawner] Failed to merge batch", e);
    }
  }
}

function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
