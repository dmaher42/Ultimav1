import * as THREE from "three";
import { createProceduralMarbleTextures } from "../core/AssetLoader.js";
import { resolveBaseUrl, joinPath } from "../utils/baseUrl.js";

const textureLoader = new THREE.TextureLoader();
const baseUrl = resolveBaseUrl();

/**
 * Helper to load and configure a texture with tiling
 */
function loadTexture(path, tilingX = 1, tilingY = 1) {
  const url = joinPath(baseUrl, path);
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(tilingX, tilingY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeMarbleMaterial() {
  const { map, normalMap, roughnessMap, aoMap } =
    createProceduralMarbleTextures();

  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    roughnessMap,
    aoMap,
    metalness: 0.05,
    roughness: 0.6,
    clearcoat: 0.3,
    clearcoatRoughness: 0.5,
    sheen: 0.0,
    envMapIntensity: 0.9,
  });
}

export function makeBronzeMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x8d6e63,
    metalness: 0.85,
    roughness: 0.35,
    envMapIntensity: 1.0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.6,
  });
}

export function makeMediterraneanPlasterMaterial() {
  const texture = loadTexture("textures/plaster_rough.jpg", 4, 4);
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.8,
    metalness: 0.05,
    envMapIntensity: 0.8,
  });
}

export function makeMonumentalStoneMaterial() {
  const texture = loadTexture("textures/stone_rough.jpg", 2, 2);
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: 0.7,
  });
}

export function makeAncientWoodMaterial() {
  const texture = loadTexture("textures/wood_weathered.jpg", 3, 3);
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.6,
  });
}

export function makeTerracottaRoofMaterial() {
  const texture = loadTexture("textures/roof_tiles_terracotta.jpg", 5, 5);
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.8,
    metalness: 0.0,
    envMapIntensity: 0.7,
  });
}

export function makeTreeMaterials() {
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f7f3b,
    roughness: 0.7,
    metalness: 0.08,
  });
  leafMaterial.name = "TreeLeaves";

  const barkMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b5e42,
    roughness: 0.82,
    metalness: 0.12,
  });
  barkMaterial.name = "TreeBark";

  return {
    leaf: leafMaterial,
    bark: barkMaterial,
  };
}
