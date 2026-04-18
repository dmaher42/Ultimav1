// src/utils/buildingCulling.js

import * as THREE from 'three';

const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();
const cameraWorldPosition = new THREE.Vector3();
const buildingWorldPosition = new THREE.Vector3();
const buildingMeshCache = new WeakMap();

function isBuildingMesh(object) {
  if (!object?.isMesh) return false;
  const name = (object.name || "").toLowerCase();
  return (
    name.includes("building") ||
    name.includes("house") ||
    name.includes("structure")
  );
}

function getBuildingMeshes(scene, { refresh = false } = {}) {
  if (!scene) return [];
  if (!refresh) {
    const cached = buildingMeshCache.get(scene);
    if (Array.isArray(cached)) {
      return cached;
    }
  }

  const meshes = [];
  scene.traverse((child) => {
    if (isBuildingMesh(child)) {
      meshes.push(child);
    }
  });
  buildingMeshCache.set(scene, meshes);
  return meshes;
}

/**
 * Main culling function
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {number} maxDistance
 */
export function cullDistantBuildings(scene, camera, maxDistance = 300) {
  const buildingMeshes = getBuildingMeshes(scene);
  if (buildingMeshes.length === 0) return;

  projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);
  camera.getWorldPosition(cameraWorldPosition);

  for (const child of buildingMeshes) {
    if (!child?.parent) continue;

    child.getWorldPosition(buildingWorldPosition);
    const dist = buildingWorldPosition.distanceTo(cameraWorldPosition);
    if (dist > maxDistance) {
      child.visible = false;
    } else {
      // Only show if in frustum
      child.visible = frustum.intersectsObject(child);
    }
  }
}
