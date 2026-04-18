import "./materials/enhanceStandardMaterial.js";

import { Application } from "./core/Application.ts";
import { engineConfig } from "./config/EngineConfig.js";
import { runTextureAssetCheck } from "./debug/assetChecks.js";
import { showLoadingError } from "./ui/loadingScreen.js";
import { IS_DEV } from "./utils/env.js";

// Globally silence the specific GLTFLoader warning about the legacy
// KHR_materials_pbrSpecularGlossiness extension which is benign for our
// runtime and causes noisy console output. This is intentionally narrow
// and only filters messages that match the exact extension warning.
const _consoleWarn = console.warn;
console.warn = (...args) => {
  try {
    const msg = String(args[0] ?? "");
    if (msg.includes("KHR_materials_pbrSpecularGlossiness") || msg.includes("Unknown extension")) {
      return;
    }
  } catch (_) {}
  return _consoleWarn.apply(console, args);
};

function toUrlSearchParams(value) {
  if (value instanceof URLSearchParams) {
    return value;
  }

  return new URLSearchParams();
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string");
  }

  return [];
}

function normalizeFeatureFlags(value) {
  const featureFlags =
    value && typeof value === "object"
      ? value
      : {};

  const forceGlb = featureFlags.forceGlb === true;
  const rawForceProcedural = featureFlags.forceProcedural;
  let forceProcedural;

  if (rawForceProcedural === true) {
    forceProcedural = true;
  } else if (rawForceProcedural === false) {
    forceProcedural = false;
  } else {
    forceProcedural = !forceGlb;
  }

  return {
    forceGlb,
    forceProcedural,
  };
}

function createApplicationBootConfig(source) {
  return {
    baseUrl: typeof source.baseUrl === "string" ? source.baseUrl : "",
    districtRuleCandidates: toStringArray(source.districtRuleCandidates),
    queryParams: toUrlSearchParams(source.queryParams),
    featureFlags: normalizeFeatureFlags(source.featureFlags),
  };
}

export const applicationBootConfig = createApplicationBootConfig(engineConfig);

if (typeof window !== "undefined") {
  window.__ENGINE_CONFIG__ = engineConfig;
}

const app = new Application({
  baseUrl: applicationBootConfig.baseUrl,
  districtRuleCandidates: [...applicationBootConfig.districtRuleCandidates],
  queryParams: applicationBootConfig.queryParams,
  forceGlb: applicationBootConfig.featureFlags.forceGlb,
  forceProc: applicationBootConfig.featureFlags.forceProcedural,
});

export const runApplication = () => app.run();

export const defaultBootHandlers = {
  onSuccess() {
    console.log("✅ Application loaded successfully");
  },
  onError(error) {
    showLoadingError(
      "We couldn't finish loading Athens. Please refresh to try again.",
    );

    if (error instanceof Error) {
      console.error("❌ Error in Application:", error);
    } else {
      console.error("❌ Error in Application:", { error });
    }
  },
};

export function bootApplication(handlers = defaultBootHandlers) {
  const onSuccess = handlers?.onSuccess ?? defaultBootHandlers.onSuccess;
  const onError = handlers?.onError ?? defaultBootHandlers.onError;

  const debugAssets =
    IS_DEV ||
    applicationBootConfig.queryParams?.get("debugAssets") === "1";
  void runTextureAssetCheck({ debugAssets });

  return runApplication()
    .then((result) => {
      onSuccess(result);
      return result;
    })
    .catch((error) => {
      onError(error);
      throw error;
    });
}
