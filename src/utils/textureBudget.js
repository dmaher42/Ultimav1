import * as THREE from "three";

const DEFAULT_HARDWARE_LIMIT = 8;
const LOW_TIER_LIMIT = 10;
const SAFE_MODE_FRAME_LIMIT = 24;
let processedMaterials = new WeakMap();

const CORE_TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap"];

const OPTIONAL_TEXTURE_PRIORITY = [
  "aoMap",
  "emissiveMap",
  "lightMap",
  "specularIntensityMap",
  "specularColorMap",
  "clearcoatMap",
  "clearcoatRoughnessMap",
  "clearcoatNormalMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
  "metalnessMap",
  "bumpMap",
  "displacementMap",
  "alphaMap",
  "envMap",
];

const MAP_RESETTERS = {
  aoMap: (material) => {
    if ("aoMapIntensity" in material) {
      material.aoMapIntensity = 0;
    }
  },
  emissiveMap: (material) => {
    if ("emissiveIntensity" in material) {
      material.emissiveIntensity = 0;
    }
  },
  lightMap: (material) => {
    if ("lightMapIntensity" in material) {
      material.lightMapIntensity = 0;
    }
  },
  clearcoatMap: (material) => {
    if ("clearcoat" in material) {
      material.clearcoat = 0;
    }
  },
  clearcoatNormalMap: (material) => {
    if ("clearcoat" in material) {
      material.clearcoat = 0;
    }
  },
  clearcoatRoughnessMap: (material) => {
    if ("clearcoat" in material) {
      material.clearcoat = 0;
    }
    if ("clearcoatRoughness" in material) {
      material.clearcoatRoughness = 0;
    }
  },
  sheenColorMap: (material) => {
    if ("sheen" in material) {
      material.sheen = 0;
    }
    if (material.sheenColor?.isColor) {
      material.sheenColor.setRGB(0, 0, 0);
    }
  },
  sheenRoughnessMap: (material) => {
    if ("sheen" in material) {
      material.sheen = 0;
    }
  },
  transmissionMap: (material) => {
    if ("transmission" in material) {
      material.transmission = 0;
    }
  },
  thicknessMap: (material) => {
    if ("thickness" in material) {
      material.thickness = 0;
    }
  },
  specularIntensityMap: (material) => {
    if ("specularIntensity" in material) {
      material.specularIntensity = 1;
    }
  },
  specularColorMap: (material) => {
    if (material.specularColor?.isColor) {
      material.specularColor.setRGB(1, 1, 1);
    }
  },
  iridescenceMap: (material) => {
    if ("iridescence" in material) {
      material.iridescence = 0;
    }
  },
  iridescenceThicknessMap: (material) => {
    if ("iridescence" in material) {
      material.iridescence = 0;
    }
  },
  anisotropyMap: (material) => {
    if ("anisotropy" in material) {
      material.anisotropy = 0;
    }
  },
};

const SAFE_MODE_DISTANCE_THRESHOLD = 160;
const SAFE_MODE_SMALL_SCALE_THRESHOLD = 0.45;
const SAFE_MODE_SMALL_WORLD_RADIUS = 0.8;
const _safeModeTempPosition = new THREE.Vector3();
const _safeModeTempScale = new THREE.Vector3();

function isNodeMarkedDistant(node) {
  const tag = node?.userData?.textureBudget;
  if (typeof tag === "string") {
    const lower = tag.toLowerCase();
    return lower === "distant" || lower === "far";
  }
  return Boolean(node?.userData?.textureBudgetDistant);
}

function isNodeMarkedSmall(node) {
  return Boolean(node?.userData?.textureBudgetSmall || node?.userData?.smallObject);
}

function isNodeDistant(node) {
  if (!node) return false;
  if (isNodeMarkedDistant(node)) {
    return true;
  }
  const hintedDistance = node?.userData?.distanceToCamera;
  if (Number.isFinite(hintedDistance)) {
    return hintedDistance > SAFE_MODE_DISTANCE_THRESHOLD;
  }
  try {
    if (typeof node.getWorldPosition === "function") {
      node.getWorldPosition(_safeModeTempPosition);
      return _safeModeTempPosition.length() > SAFE_MODE_DISTANCE_THRESHOLD;
    }
    if (node.matrixWorld) {
      _safeModeTempPosition.setFromMatrixPosition(node.matrixWorld);
      return _safeModeTempPosition.length() > SAFE_MODE_DISTANCE_THRESHOLD;
    }
  } catch {}
  return false;
}

function isNodeVerySmall(node) {
  if (!node) return false;
  if (isNodeMarkedSmall(node)) {
    return true;
  }
  try {
    if (typeof node.getWorldScale === "function") {
      node.getWorldScale(_safeModeTempScale);
    } else if (node.scale) {
      _safeModeTempScale.copy(node.scale);
    } else {
      _safeModeTempScale.set(1, 1, 1);
    }
    const avgScale =
      (Math.abs(_safeModeTempScale.x) +
        Math.abs(_safeModeTempScale.y) +
        Math.abs(_safeModeTempScale.z)) /
      3;
    if (avgScale < SAFE_MODE_SMALL_SCALE_THRESHOLD) {
      return true;
    }
    if (node.isMesh && node.geometry) {
      const geometry = node.geometry;
      let radius = geometry.boundingSphere?.radius;
      if (!Number.isFinite(radius) && typeof geometry.computeBoundingSphere === "function") {
        geometry.computeBoundingSphere();
        radius = geometry.boundingSphere?.radius;
      }
      if (Number.isFinite(radius)) {
        const worldRadius = radius * avgScale;
        if (worldRadius < SAFE_MODE_SMALL_WORLD_RADIUS) {
          return true;
        }
      }
    }
  } catch {}
  return false;
}

function computeSafeModePriority(node, slot) {
  const distant = isNodeDistant(node);
  const tiny = isNodeVerySmall(node);

  if (slot === "map") {
    return Number.POSITIVE_INFINITY;
  }
  if (slot === "roughnessMap" || slot === "aoMap") {
    return distant ? 1 : 6;
  }
  if (slot === "normalMap") {
    return tiny ? 2 : 8;
  }
  if (slot === "metalnessMap" || slot === "specularIntensityMap") {
    return 10;
  }
  if (slot === "displacementMap" || slot === "bumpMap" || slot === "lightMap") {
    return 12;
  }
  if (slot === "emissiveMap") {
    return 14;
  }
  return 20;
}

function isTexture(value) {
  return Boolean(value && typeof value === "object" && value.isTexture);
}

function resolveRenderer(options) {
  if (!options) return null;
  if (options.renderer) {
    return options.renderer;
  }
  if (options.scene?.userData?.renderer) {
    return options.scene.userData.renderer;
  }
  return null;
}

function resolveTextureLimit(options) {
  const renderer = resolveRenderer(options);
  if (Number.isFinite(options?.maxTextures)) {
    return Math.max(1, Math.floor(options.maxTextures));
  }
  const capabilities = renderer?.capabilities;
  if (capabilities) {
    const maxTextures =
      capabilities.maxTextures ??
      capabilities.maxTextureUnits ??
      capabilities.maxFragmentTextures ??
      capabilities.maxFragmentUniforms;
    if (Number.isFinite(maxTextures)) {
      return Math.max(1, Math.floor(maxTextures));
    }
  }
  return DEFAULT_HARDWARE_LIMIT;
}

function gatherTextureSlots(material) {
  const slots = new Set(CORE_TEXTURE_SLOTS.concat(OPTIONAL_TEXTURE_PRIORITY));
  for (const key in material) {
    if (key && key.endsWith("Map")) {
      slots.add(key);
    }
  }
  return Array.from(slots);
}

function getActiveTextureSlots(material) {
  const slots = gatherTextureSlots(material);
  const active = [];
  for (const slot of slots) {
    if (isTexture(material[slot])) {
      active.push(slot);
    }
  }
  return active;
}

function registerMaterialForSafeMode(material, node, state) {
  if (!state || !material) {
    return;
  }
  const activeSlots = getActiveTextureSlots(material);
  const firstEncounter = !state.countedMaterials.has(material);
  if (firstEncounter) {
    state.countedMaterials.add(material);
    state.active += activeSlots.length;
  }

  for (const slot of activeSlots) {
    if (slot === "map") {
      continue;
    }
    const priority = computeSafeModePriority(node, slot);
    if (!Number.isFinite(priority)) {
      continue;
    }
    const key = `${material.uuid}:${slot}`;
    const existing = state.candidates.get(key);
    if (!existing || priority < existing.priority) {
      state.candidates.set(key, {
        material,
        slot,
        priority,
        key,
      });
    }
  }
}

function enforceSafeModeLimit(state) {
  if (!state || state.active <= state.limit) {
    return;
  }

  const candidates = Array.from(state.candidates.values());
  candidates.sort((a, b) => {
    if (a.priority === b.priority) {
      return a.slot.localeCompare(b.slot);
    }
    return a.priority - b.priority;
  });

  for (const candidate of candidates) {
    if (state.active <= state.limit) {
      break;
    }
    const { material, slot, key } = candidate;
    if (!material || !isTexture(material[slot])) {
      state.candidates.delete(key);
      continue;
    }
    if (removeTexture(material, slot)) {
      state.candidates.delete(key);
      state.active = Math.max(0, state.active - 1);
    }
  }
}

function removeTexture(material, slot) {
  if (!slot || !isTexture(material[slot])) {
    return false;
  }
  material[slot] = null;
  const reset = MAP_RESETTERS[slot];
  if (reset) {
    reset(material);
  }
  if (material.needsUpdate !== true) {
    material.needsUpdate = true;
  }
  return true;
}

function usesPhysicalExtensions(material) {
  if (!material?.isMeshPhysicalMaterial) {
    return false;
  }
  const clearcoatActive =
    (material.clearcoat ?? 0) > 0.001 ||
    isTexture(material.clearcoatMap) ||
    isTexture(material.clearcoatNormalMap) ||
    isTexture(material.clearcoatRoughnessMap);
  const sheenActive =
    (material.sheen ?? 0) > 0.001 ||
    (material.sheenColor?.isColor && material.sheenColor.getHex() !== 0) ||
    isTexture(material.sheenColorMap) ||
    isTexture(material.sheenRoughnessMap);
  const transmissionActive =
    (material.transmission ?? 0) > 0.001 ||
    isTexture(material.transmissionMap) ||
    (material.thickness ?? 0) > 0.001 ||
    isTexture(material.thicknessMap);
  const iridescenceActive =
    (material.iridescence ?? 0) > 0.001 ||
    isTexture(material.iridescenceMap) ||
    isTexture(material.iridescenceThicknessMap);

  return clearcoatActive || sheenActive || transmissionActive || iridescenceActive;
}

function maybeDowngradePhysicalMaterial(material, options, trimmed) {
  if (!material?.isMeshPhysicalMaterial) {
    return null;
  }

  const limit = resolveTextureLimit(options);
  const lowTierDevice = limit <= LOW_TIER_LIMIT;
  if (!trimmed && !lowTierDevice) {
    return null;
  }

  if (usesPhysicalExtensions(material)) {
    return null;
  }

  const downgraded = new THREE.MeshStandardMaterial();
  downgraded.copy(material);
  downgraded.name = material.name;
  downgraded.userData = { ...(material.userData || {}) };
  downgraded.onBeforeCompile = material.onBeforeCompile;
  if (typeof material.customProgramCacheKey === "function") {
    downgraded.customProgramCacheKey = () =>
      material.customProgramCacheKey.call(downgraded);
  }
  downgraded.needsUpdate = true;
  return downgraded;
}

function budgetSingleMaterial(material, options) {
  if (!material) {
    return material;
  }

  const cached = processedMaterials.get(material);
  if (cached) {
    return cached;
  }
  if (material.userData?.textureBudget === "skip" || material.userData?.textureBudgetSkip) {
    processedMaterials.set(material, material);
    return material;
  }

  const activeSlots = getActiveTextureSlots(material);
  const limit = Math.max(3, resolveTextureLimit(options));

  if (activeSlots.length <= limit) {
    processedMaterials.set(material, material);
    return material;
  }

  const active = new Set(activeSlots);
  let trimmed = false;

  for (const slot of OPTIONAL_TEXTURE_PRIORITY) {
    if (!active.has(slot)) continue;
    if (CORE_TEXTURE_SLOTS.includes(slot)) continue;
    if (removeTexture(material, slot)) {
      active.delete(slot);
      trimmed = true;
      if (active.size <= limit) {
        break;
      }
    }
  }

  if (active.size > limit) {
    for (const slot of activeSlots) {
      if (!active.has(slot)) continue;
      if (CORE_TEXTURE_SLOTS.includes(slot)) {
        continue;
      }
      if (removeTexture(material, slot)) {
        active.delete(slot);
        trimmed = true;
        if (active.size <= limit) {
          break;
        }
      }
    }
  }

  if (active.size > limit) {
    for (const slot of CORE_TEXTURE_SLOTS.filter((name) => name !== "map")) {
      if (!active.has(slot)) continue;
      if (removeTexture(material, slot)) {
        active.delete(slot);
        trimmed = true;
        if (active.size <= limit) {
          break;
        }
      }
    }
  }

  if (active.size > limit) {
    processedMaterials.set(material, material);
    return material;
  }

  const replacement = maybeDowngradePhysicalMaterial(material, options, trimmed);
  if (replacement && replacement !== material) {
    processedMaterials.set(material, replacement);
    processedMaterials.set(replacement, replacement);
    return replacement;
  }

  processedMaterials.set(material, material);
  return material;
}

export function applyTextureBudgetToMaterial(material, options = {}) {
  if (!material) return material;
  if (Array.isArray(material)) {
    return material.map((mat) => applyTextureBudgetToMaterial(mat, options));
  }
  return budgetSingleMaterial(material, options);
}

export function applyTextureBudgetToObject(object, options = {}) {
  if (!object || typeof object.traverse !== "function") {
    return;
  }

  const safeMode = options.safeMode === true;
  const safeState = safeMode
    ? {
        limit: Math.max(
          1,
          Math.floor(
            Number.isFinite(options.safeModeLimit)
              ? Math.min(options.safeModeLimit, SAFE_MODE_FRAME_LIMIT)
              : SAFE_MODE_FRAME_LIMIT
          )
        ),
        active: 0,
        countedMaterials: new WeakSet(),
        candidates: new Map(),
      }
    : null;

  object.traverse((node) => {
    const materials = node.material;
    if (!materials) return;

    if (Array.isArray(materials)) {
      let replaced = false;
      const updated = materials.map((material) => {
        const result = applyTextureBudgetToMaterial(material, options);
        if (result && result !== material) {
          replaced = true;
        }
        return result;
      });
      if (replaced) {
        node.material = updated;
      }
      const finalMaterials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of finalMaterials) {
        registerMaterialForSafeMode(material, node, safeState);
      }
    } else {
      const result = applyTextureBudgetToMaterial(materials, options);
      if (result && result !== materials) {
        node.material = result;
        registerMaterialForSafeMode(result, node, safeState);
      } else {
        registerMaterialForSafeMode(materials, node, safeState);
      }
    }
  });

  if (safeState) {
    enforceSafeModeLimit(safeState);
  }
}

export function resetTextureBudgetCache() {
  processedMaterials = new WeakMap();
}
