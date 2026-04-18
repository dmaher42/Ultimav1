import * as THREE from "three";

export async function loadEquirectangularSkybox(renderer, scene, url) {
  if (!scene || !url) return null;

  const loader = new THREE.TextureLoader();
  const texture = await loader.loadAsync(url);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  let pmremTarget = null;
  if (renderer) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    pmremTarget = pmremGenerator.fromEquirectangular(texture);
    pmremGenerator.dispose();
  }

  scene.background = texture;
  if (pmremTarget?.texture) {
    const envTexture = pmremTarget.texture;
    envTexture.userData = envTexture.userData || {};
    envTexture.userData._pmremTarget = pmremTarget;
    scene.environment = envTexture;
  } else {
    scene.environment = texture;
  }

  return texture;
}

export function disposeSkybox(scene) {
  if (!scene) return;
  const { background, environment } = scene;

  const disposeTexture = (tex) => {
    if (!tex) return;
    const pmremTarget = tex.userData?._pmremTarget;
    if (pmremTarget && typeof pmremTarget.dispose === "function") {
      pmremTarget.dispose();
    }
    if (typeof tex.dispose === "function") {
      tex.dispose();
    }
  };

  disposeTexture(background);
  if (environment && environment !== background) {
    disposeTexture(environment);
  }

  if (scene.background === background) {
    scene.background = null;
  }
  if (scene.environment === environment) {
    scene.environment = null;
  }
}

