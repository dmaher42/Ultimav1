import * as THREE from 'three';
import { createGLTFLoader } from '../utils/glbSafeLoader.js';

const ENABLE_GLB_MODE = true;

const BUILDINGS_ROOT_NAME = 'BuildingsRoot';

/**
 * Attempt to validate an asset URL with a HEAD request.
 *
 * Some hosting setups (e.g. GitHub Pages, static file servers behind CDNs, or
 * local `file://` previews) either reject HEAD requests or omit CORS headers,
 * which previously caused the guard to incorrectly flag the asset as missing
 * and skip loading altogether. We therefore treat network errors and
 * unsupported methods as "inconclusive" rather than failures.
 */
async function headOk(url) {
  if (!url) return { ok: false, reason: 'missing-url' };
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        return { ok: false, reason: 'html-response' };
      }
      return { ok: true };
    }

    // Some servers do not support HEAD but still serve the asset via GET.
    if (res.status === 405 || res.status === 501) {
      return { ok: true, skipped: true };
    }

    return { ok: false, reason: `status-${res.status}` };
  } catch (error) {
    console.warn('[BuildingManager] HEAD request failed; falling back to GET', url, error);
    return { ok: true, skipped: true };
  }
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const mat of material) disposeMaterial(mat);
    return;
  }
  if (typeof material.dispose === 'function') {
    material.dispose();
  }
}

function disposeObject(object) {
  if (!object) return;
  object.traverse?.((child) => {
    if (child.isMesh) {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    }
  });
}

export class BuildingManager {
  /**
   * @param {import('../env/EnvironmentCollider.js').EnvironmentCollider} envCollider
   */
  constructor(envCollider) {
    this.envCollider = envCollider;
    this.loader = null;
    this.rootGroup = null;
  }

  /**
   * @param {string} url
   * @param {Object} [options]
   * @param {THREE.Vector3} [options.position]
   * @param {number} [options.scale]
   * @param {number} [options.rotateY]
   * @param {boolean} [options.collision]
   * @param {THREE.Object3D} [options.parent]
   * @param {function(number, number)} [options.heightSampler]
   * @param {function(number, number)} [options.terrainSampler]
   * @param {THREE.Object3D} [options.terrain]
   */
  async loadBuilding(url, options) {
    if (!ENABLE_GLB_MODE) return null;
    if (typeof url === 'string' && url.endsWith('.glb')) {
      console.warn(`[GLB Disabled] Skipping model load: ${url}`);
      return null;
    }
    // Lazily initialize the GLTF loader on first use
    if (!this.loader) {
      this.loader = await createGLTFLoader(null);
    }
    // Check if the file exists before attempting to load it
    // This prevents trying to parse HTML 404 pages as GLB files
    const headResult = await headOk(url);
    if (!headResult.ok) {
      throw new Error(
        `Building file not found or not accessible: ${url} (${headResult.reason ?? 'unknown'})`
      );
    }
    
    const gltf = await this.loader.loadAsync(url);
    const obj = gltf.scene;
    const opts = options ?? {};
    if (opts.scale !== undefined) obj.scale.setScalar(opts.scale);
    if (opts.rotateY !== undefined) obj.rotation.y = opts.rotateY;
    if (opts.position) obj.position.copy(opts.position);

    const sampler = this.#resolveHeightSampler(opts);
    if (opts.position) {
      const { x, z } = obj.position;
      let desiredY = obj.position.y;
      if (typeof sampler === 'function') {
        const sampled = sampler(x, z);
        if (Number.isFinite(sampled)) {
          desiredY = Number.isFinite(opts.position.y)
            ? Math.max(opts.position.y, sampled + 0.05)
            : sampled + 0.05;
        } else if (Number.isFinite(opts.position.y)) {
          desiredY = opts.position.y;
        } else if (!Number.isFinite(desiredY)) {
          desiredY = 0.05;
        }
      } else if (Number.isFinite(opts.position.y)) {
        desiredY = opts.position.y;
      } else if (!Number.isFinite(desiredY)) {
        desiredY = 0.05;
      }
      obj.position.set(x, desiredY ?? 0.05, z);
    }

    const parent = this.#resolveParent(opts);
    if (parent) {
      parent.add(obj);
    } else {
      const fallbackParent = this.envCollider?.mesh?.parent;
      if (fallbackParent) {
        fallbackParent.add(obj);
      } else {
        console.warn(
          "EnvironmentCollider mesh has no parent; building was loaded without being attached to the scene graph."
        );
      }
    }

    if (opts?.collision) {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.userData.noCollision = false;
        }
      });
      this.envCollider.refresh();
    } else {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.userData.noCollision = true;
        }
      });
    }

    return obj;
  }

  clearBuildings() {
    const scene = this.#getScene();
    const target = this.rootGroup ?? scene?.getObjectByName(BUILDINGS_ROOT_NAME);
    if (!target) return;

    disposeObject(target);
    target.parent?.remove(target);
    this.rootGroup = null;

    if (typeof this.envCollider?.refresh === 'function') {
      this.envCollider.refresh();
    }
  }

  #getScene() {
    return this.envCollider?.mesh?.parent ?? null;
  }

  #resolveParent(options) {
    if (options?.parent) {
      this.rootGroup = options.parent;
      if (!this.rootGroup.name) {
        this.rootGroup.name = BUILDINGS_ROOT_NAME;
      }
      return options.parent;
    }

    if (this.rootGroup && this.rootGroup.parent) {
      return this.rootGroup;
    }

    const scene = this.#getScene();
    if (!scene) return null;

    let root = scene.getObjectByName(BUILDINGS_ROOT_NAME);
    if (!root) {
      root = new THREE.Group();
      root.name = BUILDINGS_ROOT_NAME;
      scene.add(root);
    }
    this.rootGroup = root;
    return root;
  }

  #resolveHeightSampler(options) {
    const candidates = [
      options?.heightSampler,
      options?.terrainSampler,
      options?.terrain?.userData?.getHeightAt,
    ];

    const scene = this.#getScene();
    if (scene?.userData) {
      const { userData } = scene;
      candidates.push(
        userData.heightSampler,
        userData.terrainSampler,
        userData.terrainHeightSampler,
        userData.getHeightAt
      );

      const terrain = userData.terrain;
      if (terrain?.userData?.getHeightAt) {
        candidates.push(terrain.userData.getHeightAt);
      }
    }

    for (const candidate of candidates) {
      if (typeof candidate === 'function') {
        return candidate;
      }
    }

    return null;
  }
}

export default BuildingManager;
