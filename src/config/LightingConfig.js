import { deepFreeze, getRuntimeEnvironment, mergeDeep, assert } from "./utils.js";

export const DEFAULT_LIGHTING_CONFIG = {
  cycle: {
    minutesPerDay: 60,
  },
  bloom: {
    threshold: 0.8,
    strength: 0.6,
    radius: 0.85,
  },
  exposure: {
    min: 0.2,
    max: 2.0,
    step: 0.01,
  },
  presets: {
    blue_hour: {
      phase: 0.06,
      exposure: 0.82,
      label: "Blue Hour",
      haze: {
        start: 300,
        end: 2000,
        color: "#3b5278",
      },
    },
    golden_hour: {
      phase: 0.2,
      exposure: 0.9,
      label: "Golden Hour",
      haze: {
        start: 420,
        end: 2100,
        color: "#ffddaa",
      },
    },
    high_noon: {
      phase: 0.5,
      exposure: 0.92,
      label: "Bright Noon",
      environmentIntensity: 0.48,
      skyboxExposure: 1.05,
      colorGrade: {
        shadowTint: "#d6e8ff",
        midTint: "#eaf4ff",
        highlightTint: "#f2f8ff",
        saturationBoost: 0.08,
        contrastStrength: 0.1,
      },
      haze: {
        start: 900,
        end: 3200,
        color: "#c4e4ff",
      },
    },
    night_sky: {
      phase: 0.97,
      exposure: 0.55,
      label: "Deep Night",
      haze: {
        start: 200,
        end: 1500,
        color: "#0b1d51",
      },
    },
  },
};

const ENVIRONMENT_OVERRIDES = {
  development: {
    bloom: {
      strength: 0.5,
    },
  },
};

function validatePreset(name, preset) {
  assert(preset && typeof preset === "object", `lighting preset ${name} must be an object`);
  assert(Number.isFinite(preset.phase), `lighting preset ${name} requires numeric phase`);
  assert(Number.isFinite(preset.exposure), `lighting preset ${name} requires numeric exposure`);
  assert(typeof preset.label === "string" && preset.label.trim() !== "", `lighting preset ${name} requires label`);
  if (preset.hotkey != null) {
    assert(typeof preset.hotkey === "string", `lighting preset ${name} hotkey must be string`);
  }
  if (preset.skyboxExposure != null) {
    assert(Number.isFinite(preset.skyboxExposure), `lighting preset ${name} skyboxExposure must be numeric`);
  }
}

function validateLightingConfig(config) {
  assert(config && typeof config === "object", "lighting config must be an object");
  const presets = config.presets || {};
  for (const [name, preset] of Object.entries(presets)) {
    validatePreset(name, preset);
  }
  return config;
}

export function createLightingConfig(environment = getRuntimeEnvironment(), overrides = {}) {
  const merged = mergeDeep({}, DEFAULT_LIGHTING_CONFIG, ENVIRONMENT_OVERRIDES[environment] || {}, overrides);
  return deepFreeze(validateLightingConfig(merged));
}

export let lightingConfig = createLightingConfig();

export function getLightingPreset(name) {
  return lightingConfig.presets?.[name] || null;
}

export function listLightingPresets() {
  return Object.entries(lightingConfig.presets || {}).map(([key, value]) => ({ key, ...value }));
}

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    lightingConfig = mod?.createLightingConfig
      ? mod.createLightingConfig(getRuntimeEnvironment())
      : createLightingConfig(getRuntimeEnvironment());
  });
}
