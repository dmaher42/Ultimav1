// src/materials/pbr-utils.js
// Minimal, dependency-free helpers for PBR textures (safe if assets are missing).
// Uses explicit registry URLs to avoid HEAD/extension probing and reduce 404 spam.

import {
  TextureLoader,
  SRGBColorSpace,
  MeshStandardMaterial,
  RepeatWrapping,
} from "three";
import { MATERIALS } from "./materialRegistry.js";
import { applyNormalMapConvention } from "./normalMapUtils.js";

const warnedKeys = new Set();

function warnOnce(key, message) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

async function loadTexture(loader, url, { isSRGB = false, warnKey } = {}) {
  if (typeof url !== "string" || url.length === 0) return null;
  try {
    const tex = await loader.loadAsync(url);
    applyNormalMapConvention(tex, url);
    if (tex && isSRGB) {
      tex.colorSpace = SRGBColorSpace;
    }
    return tex;
  } catch (error) {
    if (warnKey) {
      warnOnce(warnKey, `[pbr-utils] Texture load failed for ${warnKey}: ${url}`);
    }
    return null;
  }
}

/** Build a MeshStandardMaterial from available maps (base color required) */
export async function makeMarblePBR() {
  const tl = new TextureLoader();
  const baseColor = await loadTexture(tl, MATERIALS.stoneFallback?.albedo, {
    isSRGB: true,
    warnKey: "stoneFallback.albedo",
  });
  if (!baseColor) return null; // nothing to do

  const normal = await loadTexture(tl, MATERIALS.stoneFallback?.normal, {
    warnKey: "stoneFallback.normal",
  });
  const roughness = await loadTexture(tl, MATERIALS.stoneFallback?.roughness, {
    warnKey: "stoneFallback.roughness",
  });
  const ao = await loadTexture(tl, MATERIALS.stoneFallback?.ao, {
    warnKey: "stoneFallback.ao",
  });

  const materialOptions = {
    map: baseColor,
    metalness: 0.0,
    roughness: 1.0,
  };
  if (normal) materialOptions.normalMap = normal;
  if (roughness) materialOptions.roughnessMap = roughness;
  if (ao) materialOptions.aoMap = ao;

  return new MeshStandardMaterial(materialOptions);
}

/** Tiled PBR builder with repeat + polygonOffset-friendly params */
export async function makeTiledPBR(_basePath, repeat = [6, 6]) {
  const tl = new TextureLoader();

  const base = await loadTexture(tl, MATERIALS.stoneFallback?.albedo, {
    isSRGB: true,
    warnKey: "stoneFallback.albedo",
  });
  if (!base) return null;

  const normal = await loadTexture(tl, MATERIALS.stoneFallback?.normal, {
    warnKey: "stoneFallback.normal",
  });
  const roughness = await loadTexture(tl, MATERIALS.stoneFallback?.roughness, {
    warnKey: "stoneFallback.roughness",
  });
  const ao = await loadTexture(tl, MATERIALS.stoneFallback?.ao, {
    warnKey: "stoneFallback.ao",
  });

  // Set tiling on any map we loaded
  const maps = [base, normal, roughness, ao].filter(Boolean);
  for (const m of maps) {
    m.wrapS = m.wrapT = RepeatWrapping;
    m.repeat.set(repeat[0], repeat[1]);
  }

  // Slight polygon offset helps avoid path/road z-fighting on terrain
  const materialOptions = {
    map: base,
    metalness: 0.0,
    roughness: 1.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  };
  if (normal) materialOptions.normalMap = normal;
  if (roughness) materialOptions.roughnessMap = roughness;
  if (ao) materialOptions.aoMap = ao;

  const mat = new MeshStandardMaterial(materialOptions);

  return mat;
}

/** Apply a material to all meshes in a subtree */
export function applyMaterialToTree(root, material) {
  if (!root || !material) return;
  root.traverse((child) => {
    if (child && child.isMesh) {
      child.material = material;
      // Enable vertex colors if geometry provides them; harmless otherwise
      if (child.geometry?.attributes?.color) {
        child.material.vertexColors = true;
      }
    }
  });
}
