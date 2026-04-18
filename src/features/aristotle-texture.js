// src/features/aristotle-texture.js
// Attaches marble PBR to Aristotle's Tomb if textures exist.
// Safe: silently no-ops if textures or target object are missing.

import * as THREE from "three";
import { makeMarblePBR, applyMaterialToTree } from "../materials/pbr-utils.js";
import { resolveBaseUrl, joinPath } from "../utils/baseUrl.js";

function sanitizeRelativePath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^public\//i, "")
    .replace(/^docs\//i, "")
    .replace(/^\/+/, "")
    .replace(/^athens-game-starter\//i, "")
    .replace(/^\.\//,"")
    .replace(/^\/+/, "");
}

/**
 * Idempotent hook. Call after Aristotle tomb is loaded if you have its root object.
 * If obj is null/undefined, falls back to searching the scene near the known peak.
 */
export async function attachAristotleMarblePBR(options) {
  const {
    obj = null,             // the GLB root if you have it
    scene,                  // THREE.Scene (required for fallback)
    renderer,               // THREE.WebGLRenderer (optional: for colour mgmt)
    BASE_URL = "",          // legacy support for callers passing BASE_URL
    baseUrl = BASE_URL,
    textureSubdir = "textures/aristotle_tomb",
    approxPosition = new THREE.Vector3(-40, 14, 10) // Acropolis peak default
  } = options || {};

  // Ensure correct output colour/tone mapping IF not already set
  if (renderer) {
    if (!renderer.outputColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Only set tone mapping if it's the default NoToneMapping
    if (renderer.toneMapping === undefined || renderer.toneMapping === THREE.NoToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = renderer.toneMappingExposure ?? 1.0;
    }
  }

  const resolvedBase = typeof baseUrl === "string" && baseUrl.length > 0 ? baseUrl : resolveBaseUrl();
  const basePath = joinPath(resolvedBase, sanitizeRelativePath(textureSubdir));

  const material = await makeMarblePBR(basePath);
  if (!material) return; // textures not uploaded yet

  let target = obj;

  // Fallback: find nearest sizable object to approxPosition
  if (!target && scene) {
    let best = null, bestScore = Infinity;
    const tmp = new THREE.Vector3();
    scene.traverse((node) => {
      if (!node?.isObject3D) return;
      // Prefer groups/meshes with geometry and some size
      if (node.isMesh || node.isGroup) {
        node.getWorldPosition(tmp);
        const d2 = tmp.distanceToSquared(approxPosition);
        if (d2 < bestScore) { bestScore = d2; best = node; }
      }
    });
    target = best || null;
  }

  if (!target) return;

  applyMaterialToTree(target, material);
}
