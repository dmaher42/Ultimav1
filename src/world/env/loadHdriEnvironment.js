import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export async function loadHdriEnvironment({ renderer, scene, path, onFallback }) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  return new Promise((resolve) => {
    const loader = new EXRLoader();

    loader
      .setCrossOrigin('anonymous')
      // Use full float precision to avoid clamping bright HDR values to half-float range
      // which triggers THREE.DataUtils.toHalfFloat(): Value out of range warnings.
      .setDataType(THREE.FloatType)
      .load(
        path,
        (exrTexture) => {
          if (!exrTexture || !exrTexture.image) {
            pmremGenerator.dispose();
            onFallback?.();
            resolve(null);
            return;
          }

          if (!exrTexture.image.data) {
            pmremGenerator.dispose();
            exrTexture.dispose();
            onFallback?.();
            resolve(null);
            return;
          }

          if (exrTexture.type !== THREE.HalfFloatType && exrTexture.type !== THREE.FloatType) {
            pmremGenerator.dispose();
            exrTexture.dispose();
            onFallback?.();
            resolve(null);
            return;
          }

          try {
            const envMap = pmremGenerator.fromEquirectangular(exrTexture).texture;
            scene.environment = envMap;
            exrTexture.dispose();
            pmremGenerator.dispose();
            resolve(envMap);
          } catch (err) {
            exrTexture.dispose();
            pmremGenerator.dispose();
            onFallback?.();
            resolve(null);
            return;
          }
        },
        undefined,
        (error) => {
          const message = error?.message || '';
          if (message.toLowerCase().includes('unsupported type')) {
            pmremGenerator.dispose();
            onFallback?.();
            resolve(null);
            return;
          }

          pmremGenerator.dispose();
          onFallback?.();
          resolve(null);
        }
      );
  });
}
