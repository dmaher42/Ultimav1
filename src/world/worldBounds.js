import * as THREE from "three";
import { getSeaLevelY } from "./seaLevelState.js";

const DEFAULT_FLOOR_DEPTH = 140;
const DEFAULT_WORLD_RADIUS = 2000;

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function createWorldFloorCap(scene, options = {}) {
  const seaLevel = Number.isFinite(options.seaLevel)
    ? options.seaLevel
    : getSeaLevelY();
  const depth = Number.isFinite(options.depth)
    ? options.depth
    : DEFAULT_FLOOR_DEPTH;
  const radius = Math.max(options.radius ?? DEFAULT_WORLD_RADIUS, 400);

  const geometry = new THREE.CircleGeometry(radius, 64);
  const floorColor = (() => {
    if (options.color) return options.color instanceof THREE.Color ? options.color : new THREE.Color(options.color);
    const fogColor = scene?.fog?.color;
    if (fogColor && fogColor.isColor) return fogColor.clone();
    return new THREE.Color(0x96b9d8); // matches darker bluer horizon fallback
  })();
  const material = new THREE.MeshBasicMaterial({
    color: floorColor,
    side: THREE.DoubleSide,
    depthWrite: true,
    transparent: false,
    opacity: 1,
    fog: true,
  });
  material.colorWrite = true;
  material.depthTest = true;

  const cap = new THREE.Mesh(geometry, material);
  cap.name = "WorldFloorCap";
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = seaLevel - depth;
  cap.renderOrder = -10;
  cap.frustumCulled = false;
  cap.receiveShadow = false;
  cap.castShadow = false;

  scene?.add(cap);
  return cap;
}

export function applyKillPlane(renderer, height) {
  const seaLevel = getSeaLevelY();
  const killHeight = Number.isFinite(height) ? height : seaLevel - 60;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -killHeight);

  if (renderer) {
    const existing = ensureArray(renderer.clippingPlanes);
    const nextPlanes = [plane, ...existing.filter((p) => p !== plane)];
    renderer.clippingPlanes = nextPlanes;
    renderer.localClippingEnabled = true;
  }

  return plane;
}
