// src/core/EnvironmentManager.js
import * as THREE from 'three';
import { LIGHTING_PRESETS } from '../config/LookProfiles.js';
import { updateLighting } from '../world/lighting.js';

/**
 * EnvironmentManager
 * Centralizes management of lighting, fog, skybox, and environment intensity.
 * Migrated from legacy logic in Application.ts to provide a cleaner API for look-and-feel transitions.
 */
export class EnvironmentManager {
  constructor({ scene, renderer, lights, skybox }) {
    this.scene = scene;
    this.renderer = renderer;
    this.lights = lights; // { sunLight, ambientLight, hemisphereLight }
    this.skybox = skybox; // Reference to the skybox/sky system
    this.currentPresetName = null;
    this.sunAlignment = { azimuthDeg: 0, elevationDeg: 35 };
  }

  /**
   * Applies a lighting look profile immediately or transitions to it.
   */
  applyLookProfile(name, options = {}) {
    const profile = LIGHTING_PRESETS[name];
    if (!profile) {
      console.warn(`[EnvironmentManager] Lighting preset "${name}" not found.`);
      return;
    }

    this.currentPresetName = name;

    // 1. Renderer Exposure
    if (this.renderer && profile.renderer) {
      this.renderer.toneMappingExposure = profile.renderer.toneMappingExposure;
    }

    // 2. Fog
    if (this.scene && profile.fog) {
      if (profile.fog.enabled) {
        if (!this.scene.fog || !(this.scene.fog instanceof THREE.Fog)) {
          this.scene.fog = new THREE.Fog(profile.fog.color, profile.fog.near || 10, profile.fog.far || 5000);
        } else {
          this.scene.fog.color.set(profile.fog.color);
          this.scene.fog.near = profile.fog.near || 10;
          this.scene.fog.far = profile.fog.far || 5000;
        }
      } else {
        this.scene.fog = null;
      }
    }

    // 3. Sun/Light Updates via lighting.js bridge
    if (this.lights) {
      const sunDir = new THREE.Vector3();
      const az = THREE.MathUtils.degToRad(profile.sun.azimuth);
      const el = THREE.MathUtils.degToRad(profile.sun.elevation);
      
      sunDir.set(
        Math.cos(el) * Math.cos(az),
        Math.sin(el),
        Math.cos(el) * Math.sin(az)
      ).normalize();

      updateLighting(this.lights, sunDir, {
        overrideSunColor: new THREE.Color(profile.sun.color),
        overrideSunIntensity: profile.sun.intensity,
        overrideAmbientColor: new THREE.Color(profile.ambient.color),
        overrideGroundColor: new THREE.Color(profile.ambient.groundColor),
        overrideAmbientIntensity: profile.ambient.intensity,
        sunDistance: options.sunDistance || 150
      });
    }

    // 4. skybox/Post-processing
    if (this.skybox && profile.skybox) {
      // Integration with skybox system if present
      if (typeof this.skybox.setExposure === 'function') {
        this.skybox.setExposure(profile.skybox.exposureMultiplier);
      }
    }

    // 5. Env Map Intensity (Material Updates)
    if (profile.env) {
      this.setEnvironmentMapIntensity(profile.env.envMapIntensity);
    }
    
    console.log(`[EnvironmentManager] Applied "${name}" look profile.`);
  }

  /**
   * Cycles through available lighting presets.
   */
  cyclePreset() {
    const presets = Object.keys(LIGHTING_PRESETS);
    const currentIndex = presets.indexOf(this.currentPresetName);
    const nextIndex = (currentIndex + 1) % presets.length;
    this.applyLookProfile(presets[nextIndex], { source: 'user' });
  }

  /**
   * Toggles fog on/off and synchronizes with the ocean material.
   */
  toggleFog() {
    this.setFogEnabled(!this.fogEnabled);
    return this.fogEnabled;
  }

  setFogEnabled(enabled) {
    this.fogEnabled = enabled;
    if (this.scene) {
      if (enabled && this.currentPresetName) {
        // Re-apply current preset fog
        this.applyLookProfile(this.currentPresetName);
      } else {
        this.scene.fog = null;
      }
    }

    // Sync with ocean material if it exists
    this.scene.traverse((obj) => {
      if (obj.name === 'AegeanOcean' || obj.name?.toLowerCase().includes('water')) {
        const mat = obj.material;
        if (mat) {
          mat.fog = enabled;
          mat.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Adjusts the environment map intensity across all materials in the scene.
   */
  setEnvironmentMapIntensity(intensity) {
    this.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((m) => {
          if ('envMapIntensity' in m) {
            m.envMapIntensity = intensity;
          }
        });
      }
    });
  }

  /**
   * Manual sun alignment adjustment (often used by dev HUD).
   */
  setSunAlignment({ azimuthDeg, elevationDeg }) {
    if (azimuthDeg !== undefined) this.sunAlignment.azimuthDeg = azimuthDeg;
    if (elevationDeg !== undefined) this.sunAlignment.elevationDeg = elevationDeg;

    const az = THREE.MathUtils.degToRad(this.sunAlignment.azimuthDeg);
    const el = THREE.MathUtils.degToRad(this.sunAlignment.elevationDeg);
    
    const sunDir = new THREE.Vector3(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az)
    ).normalize();

    if (this.lights) {
      updateLighting(this.lights, sunDir, { applyPosition: true });
    }
  }

  get activePreset() {
    return this.currentPresetName;
  }
}
