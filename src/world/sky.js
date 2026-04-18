// src/world/sky.js
 
import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
 
const DEFAULT_SKY_SETTINGS = {
  zenith: "#6fa7ff",
  horizon: "#ffd9a3",
  sun: "#ffe2c4",
  fogNear: 300,
  fogFar: 1950,
};
 
const SKY_PRESETS = {
  blue_hour: {
    zenith: "#1f2f54",
    horizon: "#7397c8",
    sun: "#d8e5ff",
    fogNear: 260,
    fogFar: 1750,
  },
  golden_hour: {
    zenith: "#3d5f9f",
    horizon: "#f5b778",
    sun: "#ffb86c",
    fogNear: 275,
    fogFar: 1825,
  },
  high_noon: {
    zenith: "#6fa7ff",
    horizon: "#ffd9a3",
    sun: "#fff2dd",
    fogNear: 900,
    fogFar: 4200,
  },
  night_sky: {
    zenith: "#0b1d51",
    horizon: "#1b2a4f",
    sun: "#9fc4ff",
    fogNear: 320,
    fogFar: 2050,
  },
};
 
const scratchSunDirection = new Vector3(0.3, 0.9, 0.2).normalize();
const scratchColor = new Color();
 
function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
 
function applySkySettings(sky, settings = {}) {
  if (!sky || !sky.material || !sky.material.uniforms) return;
  const { scene } = sky;
  const zenith = new Color(settings.zenith ?? DEFAULT_SKY_SETTINGS.zenith);
  const horizon = new Color(settings.horizon ?? DEFAULT_SKY_SETTINGS.horizon);
  const sun = new Color(settings.sun ?? DEFAULT_SKY_SETTINGS.sun);
  const fogNear = Number.isFinite(settings.fogNear)
    ? Math.max(0, settings.fogNear)
    : DEFAULT_SKY_SETTINGS.fogNear;
  const fogFar = Number.isFinite(settings.fogFar)
    ? Math.max(fogNear + 50, settings.fogFar)
    : DEFAULT_SKY_SETTINGS.fogFar;
 
  const { uniforms } = sky.material;
  uniforms.zenithColor.value.copy(zenith);
  uniforms.horizonColor.value.copy(horizon);
  uniforms.sunColor.value.copy(sun);
 
  if (scene) {
    const setFogOptions = scene.userData?.setFogOptions;
    if (typeof setFogOptions === "function") {
      setFogOptions({ color: horizon, near: fogNear, far: fogFar });
    } else if (scene.fog) {
      scene.fog.color.copy(horizon);
      if (scene.fog.isFog) {
        scene.fog.near = fogNear;
        scene.fog.far = fogFar;
      }
    }
  }
 
  sky.settings = {
    ...sky.settings,
    ...settings,
    zenith: zenith.getStyle(),
    horizon: horizon.getStyle(),
    sun: sun.getStyle(),
    fogNear,
    fogFar,
  };
}
 
export function createSky(scene) {
  const geometry = new SphereGeometry(4000, 32, 18);
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      zenithColor: { value: new Color(DEFAULT_SKY_SETTINGS.zenith) },
      horizonColor: { value: new Color(DEFAULT_SKY_SETTINGS.horizon) },
      sunColor: { value: new Color(DEFAULT_SKY_SETTINGS.sun) },
      sunDirection: { value: scratchSunDirection.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPosition;
      uniform vec3 zenithColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
 
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 base = mix(horizonColor, zenithColor, pow(t, 1.2));
 
        float sunAmount = max(dot(dir, normalize(sunDirection)), 0.0);
        float sunGlow = pow(sunAmount, 6.0);
        vec3 finalColor = base + sunColor * sunGlow * 0.20;
 
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
 
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
 
  const sky = { mesh, material, scene, settings: { ...DEFAULT_SKY_SETTINGS } };
  scene.userData = scene.userData || {};
  scene.userData.sky = sky;
 
  applySkySettings(sky, SKY_PRESETS.high_noon);
 
  if (typeof window !== "undefined") {
    window.setSky = (options = {}) => {
      applySkySettings(sky, options);
      return sky.settings;
    };
  }
 
  return sky;
}
 
export function updateSky(scene, presetName) {
  const sky = scene?.userData?.sky;
  const preset = SKY_PRESETS[presetName] || SKY_PRESETS.high_noon;
  applySkySettings(sky, preset);
}
 
export function setTimeOfDayPhase(state, phase01) {
  if (!state || typeof state !== "object") return 0;
  const clamped = clamp01(phase01);
  state.timeOfDayPhase = clamped;
  return clamped;
}
 
export function getSunDirectionFromPhase(phase01, target = scratchSunDirection) {
  const phase = clamp01(phase01);
  const theta = (phase - 0.25) * Math.PI * 2;
  target.set(Math.cos(theta), Math.sin(theta), 0);
  return target.normalize();
}
 
/**
 * Calculates sun direction from state.
 */
export function getSunDirection(state) {
  const phase = state?.timeOfDayPhase ?? 0;
  return getSunDirectionFromPhase(phase, scratchSunDirection);
}
 
/**
 * Updates sky sun direction uniform based on time-of-day phase.
 */
export function updateSkySunPosition(scene, phase01) {
  const sky = scene?.userData?.sky;
  if (!sky || !sky.material || !sky.material.uniforms) return;
  
  const sunDir = getSunDirectionFromPhase(phase01);
  sky.material.uniforms.sunDirection.value.copy(sunDir);
}
 
/**
 * Interpolates between two presets for smooth time transitions.
 */
function interpolatePresets(p1, p2, t) {
  const zenith = scratchColor.set(p1.zenith).lerp(new Color(p2.zenith), t);
  const horizon = scratchColor.set(p1.horizon).lerp(new Color(p2.horizon), t);
  const sun = scratchColor.set(p1.sun).lerp(new Color(p2.sun), t);
  
  return {
    zenith: zenith.getStyle(),
    horizon: horizon.getStyle(),
    sun: sun.getStyle(),
    fogNear: p1.fogNear * (1 - t) + p2.fogNear * t,
    fogFar: p1.fogFar * (1 - t) + p2.fogFar * t,
  };
}
 
/**
 * Updates sky preset and sun position based on time-of-day phase.
 * Automatically interpolates between presets for smooth transitions.
 */
export function updateSkyForTimeOfDay(scene, phase01) {
  const sky = scene?.userData?.sky;
  if (!sky) return;
  
  const phase = clamp01(phase01);
  let preset, t;
  
  // Night to blue hour (0.0 - 0.20)
  if (phase < 0.20) {
    t = phase / 0.20;
    preset = interpolatePresets(SKY_PRESETS.night_sky, SKY_PRESETS.blue_hour, t);
  }
  // Blue hour to golden hour (0.20 - 0.30)
  else if (phase < 0.30) {
    t = (phase - 0.20) / 0.10;
    preset = interpolatePresets(SKY_PRESETS.blue_hour, SKY_PRESETS.golden_hour, t);
  }
  // Golden hour to high noon (0.30 - 0.45)
  else if (phase < 0.45) {
    t = (phase - 0.30) / 0.15;
    preset = interpolatePresets(SKY_PRESETS.golden_hour, SKY_PRESETS.high_noon, t);
  }
  // High noon peak (0.45 - 0.55) - pure high noon
  else if (phase < 0.55) {
    preset = SKY_PRESETS.high_noon;
  }
  // High noon to golden hour (0.55 - 0.70)
  else if (phase < 0.70) {
    t = (phase - 0.55) / 0.15;
    preset = interpolatePresets(SKY_PRESETS.high_noon, SKY_PRESETS.golden_hour, t);
  }
  // Golden hour to blue hour (0.70 - 0.80)
  else if (phase < 0.80) {
    t = (phase - 0.70) / 0.10;
    preset = interpolatePresets(SKY_PRESETS.golden_hour, SKY_PRESETS.blue_hour, t);
  }
  // Blue hour to night (0.80 - 1.0)
  else {
    t = (phase - 0.80) / 0.20;
    preset = interpolatePresets(SKY_PRESETS.blue_hour, SKY_PRESETS.night_sky, t);
  }
  
  applySkySettings(sky, preset);
  updateSkySunPosition(scene, phase);
}
