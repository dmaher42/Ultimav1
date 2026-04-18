import { resolveBaseUrl } from "../utils/baseUrl.js";
import { buildDistrictRuleUrlCandidates } from "../world/districtRules.js";
import {
  FALSE_VALUES,
  TRUE_VALUES,
  assert,
  deepFreeze,
  getRuntimeEnvironment,
  mergeDeep,
  parseToggleValue,
} from "./utils.js";

function safeUrlSearchParams() {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return new URLSearchParams("");
  }
  try {
    return new URLSearchParams(window.location.search ?? "");
  } catch {
    return new URLSearchParams("");
  }
}

const DEFAULT_ENGINE_CONFIG = ({
  baseUrl = resolveBaseUrl(),
  queryParams = safeUrlSearchParams(),
} = {}) => {
  // Default to allowing GLB loading (opt-out via ?glb=0). If callers explicitly set
  // the `glb` query param to 0, we disable GLB loading and fall back to procedural.
  const forceGlb = queryParams.has("glb") ? queryParams.get("glb") !== "0" : true;
  const forceProcedural = !forceGlb;
  const safeMode = parseToggleValue(queryParams.get("safeMode"), false);

  return {
    environment: getRuntimeEnvironment(),
    baseUrl,
    queryParams,
    build: {
      time: typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "",
      sha: typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "",
    },
    districtRuleCandidates: buildDistrictRuleUrlCandidates(baseUrl),
    featureFlags: {
      forceGlb,
      forceProcedural,
      safeMode,
      useThirdPersonCamera: true,
    },
    debug: {
      overlays: {
        audioMixer: { queryKey: "audio", windowFlagKey: "SHOW_AUDIO_MIXER", defaultValue: false, devDefault: false },
        exposureSlider: { queryKey: "exposure", windowFlagKey: "SHOW_EXPOSURE", defaultValue: false, devDefault: false },
        hotkeyReference: { queryKey: "hotkeys", windowFlagKey: "SHOW_HOTKEYS", defaultValue: false, devDefault: false },
        devHud: { queryKey: "hud", windowFlagKey: "SHOW_HUD", defaultValue: false, devDefault: false },
        cameraSettings: { queryKey: "camerahud", windowFlagKey: "SHOW_CAMERA_HUD", defaultValue: false, devDefault: false },
      },
      logLevel: queryParams.get("log") || "info",
    },
    performance: {
      enableShadows: !queryParams.has("shadows") || parseToggleValue(queryParams.get("shadows"), true),
      enableGrass: parseToggleValue(queryParams.get("grass"), false),
      roadsVisible: !queryParams.has("roads") || parseToggleValue(queryParams.get("roads"), true),
    },
  };
};

const ENVIRONMENT_OVERRIDES = {
  development: ({ queryParams }) => ({
    debug: {
      overlays: {
        audioMixer: { queryKey: "audio", windowFlagKey: "SHOW_AUDIO_MIXER", defaultValue: false, devDefault: false },
        exposureSlider: { queryKey: "exposure", defaultValue: false, devDefault: false, windowFlagKey: "SHOW_EXPOSURE" },
        hotkeyReference: { queryKey: "hotkeys", defaultValue: false, devDefault: false, windowFlagKey: "SHOW_HOTKEYS" },
        devHud: { queryKey: "hud", defaultValue: false, devDefault: false, windowFlagKey: "SHOW_HUD" },
        cameraSettings: { queryKey: "camerahud", defaultValue: false, devDefault: false, windowFlagKey: "SHOW_CAMERA_HUD" },
      },
      logLevel: queryParams.get("log") || "debug",
    },
  }),
};

function normalizeConfig(config) {
  assert(config && typeof config === "object", "engine config must be an object");
  assert(typeof config.baseUrl === "string", "engine config missing baseUrl");
  assert(config.queryParams instanceof URLSearchParams, "queryParams must be URLSearchParams");
  if (!Array.isArray(config.districtRuleCandidates)) {
    config.districtRuleCandidates = [];
  }
  return config;
}

export function createEngineConfig(environment = getRuntimeEnvironment(), overrides = {}) {
  const base = DEFAULT_ENGINE_CONFIG();
  const envOverrideFactory = ENVIRONMENT_OVERRIDES[environment];
  const envOverrides = envOverrideFactory ? envOverrideFactory(base) : {};
  const merged = mergeDeep({}, base, envOverrides, overrides);
  const normalized = normalizeConfig(merged);
  return deepFreeze(normalized);
}

export let engineConfig = createEngineConfig();

export function resolveFeatureToggle(descriptor = {}) {
  const {
    queryKey,
    windowFlagKey,
    defaultValue = true,
    devDefault = true,
  } = descriptor;

  const { queryParams, environment } = engineConfig;
  const isDevEnv = environment === "development" || environment === "test" || environment === "local";

  if (queryKey && queryParams instanceof URLSearchParams) {
    if (queryParams.has(queryKey)) {
      return parseToggleValue(queryParams.get(queryKey), defaultValue);
    }
  }

  if (windowFlagKey && typeof window !== "undefined" && windowFlagKey in window) {
    const flagValue = window[windowFlagKey];
    if (typeof flagValue === "boolean") {
      return flagValue;
    }
    return parseToggleValue(flagValue, defaultValue);
  }

  if (devDefault && isDevEnv) {
    return true;
  }

  return defaultValue;
}

export function parseBooleanQuery(key, fallback = false) {
  if (!(engineConfig.queryParams instanceof URLSearchParams)) {
    return fallback;
  }
  if (!engineConfig.queryParams.has(key)) {
    return fallback;
  }
  const value = engineConfig.queryParams.get(key);
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    engineConfig = mod?.createEngineConfig
      ? mod.createEngineConfig(getRuntimeEnvironment())
      : createEngineConfig(getRuntimeEnvironment());
  });
}
