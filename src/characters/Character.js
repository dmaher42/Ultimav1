import * as THREE from 'three';
import { createGLTFLoader, loadGLBWithFallbacks } from '../utils/glbSafeLoader.js';
import { applyForegroundFogPolicy } from '../utils/materialUtils.js';

const ENABLE_GLB_MODE = true;

export class Character extends THREE.Object3D {
  constructor() {
    super();
    this.model = undefined;
    this.mixer = undefined;
    this.actions = new Map();
    this.current = undefined;
  }

  /**
   * @param {string | string[]} url
   * @param {THREE.WebGLRenderer} [renderer]
   */
  async load(url, renderer, { targetHeight = 1.8 } = {}) {
    if (!ENABLE_GLB_MODE) return null;
    const urls = Array.isArray(url) ? url : [url];
    const loader = await createGLTFLoader(renderer);
    const loaded = await loadGLBWithFallbacks(loader, urls, {
      renderer,
      targetHeight,
    });

    if (!loaded || !loaded.root) {
      throw new Error('Character.load failed: no reachable GLB candidates');
    }

    const { gltf, root } = loaded;

    this.initializeFromGLTF(root, gltf.animations);
  }

  initializeFromGLTF(root, animations = []) {
    if (!root) {
      throw new Error('Character.initializeFromGLTF requires a root object');
    }

    if (this.model) {
      this.remove(this.model);
    }

    this.model = root;
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });

    applyForegroundFogPolicy(this.model);

    this.model.rotation.y = 0;
    this.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    const clips = Array.isArray(animations) ? animations : [];
    const byName = new Map();
    for (const clip of clips) {
      if (clip?.name) {
        byName.set(clip.name, clip);
      }
    }

    const mapName = (n) => {
      const L = n.toLowerCase();
      if (L.includes('idle')) return 'Idle';
      if (L.includes('walk') && !L.includes('swagger')) return 'Walk';
      if (L.includes('run')) return 'Run';
      if (L.includes('swagger')) return 'Swagger';
      if (L.includes('swag')) return 'Swagger';
      if (L.includes('jump')) return 'Jump';
      return null;
    };

    this.actions = new Map();

    for (const [name, clip] of byName) {
      const mapped = mapName(name);
      if (!mapped) continue;
      const action = this.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.enable = true;
      this.actions.set(mapped, action);
    }

    if (this.actions.size === 0 && clips.length > 0) {
      const fallbackClip = clips[0];
      const fallbackAction = this.mixer.clipAction(fallbackClip);
      fallbackAction.setLoop(THREE.LoopRepeat, Infinity);
      fallbackAction.clampWhenFinished = false;
      fallbackAction.enable = true;

      for (const key of ['Idle', 'Walk', 'Run', 'Swagger', 'Jump']) {
        this.actions.set(key, fallbackAction);
      }
      console.warn(
        '[Character] No named animations matched; falling back to first clip:',
        fallbackClip.name || '(unnamed)'
      );
    }

    if (!this.actions.get('Swagger') && this.actions.get('Walk')) {
      this.actions.set('Swagger', this.actions.get('Walk'));
    }
    if (!this.actions.get('Run') && this.actions.get('Walk')) {
      this.actions.set('Run', this.actions.get('Walk'));
    }
    if (!this.actions.get('Idle') && this.actions.get('Walk')) {
      this.actions.set('Idle', this.actions.get('Walk'));
    }

    this.play('Idle', 0);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.mixer?.update(dt);
  }

  /**
   * @param {string} name
   * @param {number} [fade=0.2]
   */
  play(name, fade = 0.2) {
    const next = this.actions.get(name);
    if (!next || this.current === next) return;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }
}

export default Character;
