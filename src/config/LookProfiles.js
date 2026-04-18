
export const LIGHTING_PRESETS = {
  "Bright Noon": {
    renderer: {
      toneMappingExposure: 0.88,
    },
    starsVisible: 0.0,
    moonElevation: -10,
    moonLightIntensity: 0.0,
    soundscapeMode: "day",
    sun: {
      color: "#ffffff",
      intensity: 2.8,
      azimuth: 215,
      elevation: 52,
    },
    ambient: {
      color: "#f5faff",
      groundColor: "#e5d5c0",
      intensity: 0.32,
    },
    fog: {
      enabled: true,
      color: "#f2f8ff",
      near: 2200,
      far: 14000,
      density: 0.00001,
    },
    skybox: {
      exposureMultiplier: 0.9,
      saturationMultiplier: 1.0,
      skyKey: "high_noon"
    },
    grade: {
      contrast: 0.12,
      saturation: 0.08,
      shadowTint: "#f0f2f5",
      midTint: "#ffffff",
      highlightTint: "#ffffff",
    },
    env: {
      envMapIntensity: 1.4
    },
    moon: {
      visible: false,
      intensity: 0,
      elevation: -25,
    }
  },
  "Golden Hour": {
    renderer: {
      toneMappingExposure: 0.78,
    },
    starsVisible: 0.02,
    moonElevation: -5,
    moonLightIntensity: 0.05,
    soundscapeMode: "day",
    sun: {
      color: "#ffe2c4",
      intensity: 1.45,
      azimuth: 238,
      elevation: 38,
    },
    ambient: {
      color: "#efe4d3",
      groundColor: "#cfb089",
      intensity: 0.26,
    },
    fog: {
      enabled: true,
      color: "#edd3ad",
      near: 950,
      far: 4300,
    },
    skybox: {
      exposureMultiplier: 0.82,
      saturationMultiplier: 0.96,
      skyKey: "golden_hour"
    },
    grade: {
      contrast: 0.08,
      saturation: 0.03,
      shadowTint: "#d8d3ca",
      midTint: "#f5e7d6",
      highlightTint: "#fff1df",
    },
    env: {
      envMapIntensity: 1.45
    },
    moon: {
      visible: false,
      intensity: 0,
      elevation: -20,
    }
  },
  "Blue Hour": {
    renderer: {
      toneMappingExposure: 1.05,
    },
    starsVisible: 0.55,
    moonElevation: 8,
    moonLightIntensity: 0.32,
    soundscapeMode: "night",
    sun: {
      color: "#6f7fa5",
      intensity: 0.2,
      azimuth: 195,
      elevation: -2,
    },
    ambient: {
      color: "#4a628a",
      groundColor: "#2d3c54",
      intensity: 0.65,
    },
    fog: {
      enabled: true,
      color: "#2f3f5d",
      near: 250,
      far: 2600,
    },
    skybox: {
      exposureMultiplier: 0.8,
      skyKey: "blue_hour"
    },
    grade: {
      contrast: 0.1,
      saturation: -0.06,
      shadowTint: "#223344",
      midTint: "#3b5278",
      highlightTint: "#9bb5e1",
    },
    env: {
      envMapIntensity: 1.1 // Boosted reflections for twilight
    },
    moon: {
      visible: true,
      intensity: 0.42,
      elevation: 18,
    }
  },
  "Night": {
    renderer: {
      toneMappingExposure: 1.15,
    },
    starsVisible: 1.0,
    moonElevation: 20,
    moonLightIntensity: 0.18,
    soundscapeMode: "night",
    sun: {
      color: "#6f86a5",
      intensity: 0.05,
      azimuth: 120,
      elevation: -45,
    },
    ambient: {
      color: "#162b4d",
      groundColor: "#12233b",
      intensity: 0.42,
    },
    fog: {
      enabled: true,
      color: "#08162c",
      near: 400,
      far: 3200,
    },
    skybox: {
      exposureMultiplier: 0.6,
      skyKey: "night_sky"
    },
    grade: {
      contrast: 0.1,
      saturation: -0.08,
      shadowTint: "#0b1629",
      midTint: "#10233d",
      highlightTint: "#c6d7ff",
    },
    env: {
      envMapIntensity: 0.65
    },
    moon: {
      visible: true,
      intensity: 0.2,
      elevation: 40,
    }
  }
};
