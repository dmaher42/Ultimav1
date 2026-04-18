import * as THREE from "three";

let cached = null;

function withRepeat(tex, repeat = new THREE.Vector2(4, 3)) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.copy(repeat);
  return tex;
}

export function getGravellySandMaterial() {
  if (cached) return cached;
  const loader = new THREE.TextureLoader();

  const diffuse = withRepeat(
    loader.load("textures/sand/albedo.jpg"),
  );
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const normal = withRepeat(
    loader.load("textures/sand/normal_gl.jpg"),
  );
  normal.colorSpace = THREE.NoColorSpace;

  const arm = withRepeat(
    loader.load("textures/sand/arm.jpg"),
  );
  arm.colorSpace = THREE.NoColorSpace;

  cached = new THREE.MeshStandardMaterial({
    name: "gravellySandMaterial",
    map: diffuse,
    normalMap: normal,
    aoMap: arm,
    roughnessMap: arm,
    metalnessMap: arm,
    roughness: 0.86,
    metalness: 0.05,
    envMapIntensity: 0.6,
    displacementScale: 0.015,
  });

  return cached;
}

export default getGravellySandMaterial;
