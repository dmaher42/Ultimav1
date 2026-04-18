import * as THREE from "three";

export function azElToDirection(azimuthDeg, elevationDeg) {
  const azRad = THREE.MathUtils.degToRad(azimuthDeg ?? 0);
  const elRad = THREE.MathUtils.degToRad(elevationDeg ?? 0);

  const x = Math.cos(elRad) * Math.sin(azRad);
  const y = Math.sin(elRad);
  const z = Math.cos(elRad) * Math.cos(azRad);

  return new THREE.Vector3(x, y, z).normalize();
}

export function applySunAlignment(
  directionalLight,
  target,
  azimuthDeg,
  elevationDeg,
  distance = 1000,
) {
  if (!directionalLight) return null;

  const direction = azElToDirection(azimuthDeg, elevationDeg);
  const targetVector = target instanceof THREE.Vector3
    ? target
    : new THREE.Vector3(target?.x ?? 0, target?.y ?? 0, target?.z ?? 0);

  const scaledDirection = direction.clone().multiplyScalar(distance);
  directionalLight.position.copy(targetVector).add(scaledDirection);
  directionalLight.target.position.copy(targetVector);

  if (directionalLight.target.parent == null && directionalLight.parent) {
    directionalLight.parent.add(directionalLight.target);
  }

  directionalLight.target.updateMatrixWorld();
  return direction;
}

