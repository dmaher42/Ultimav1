import { createAssetConfig, assetConfig as currentAssetConfig } from "./AssetConfig.js";
import { createEngineConfig, engineConfig as currentEngineConfig } from "./EngineConfig.js";
import { createLightingConfig, lightingConfig as currentLightingConfig } from "./LightingConfig.js";
import { createAthensLayoutConfig, athensLayoutConfig as currentLayoutConfig } from "./athensLayoutConfig.js";
import { deepFreeze, getRuntimeEnvironment } from "./utils.js";

function buildConfig(environment = getRuntimeEnvironment()) {
  return deepFreeze({
    environment,
    assets: createAssetConfig(environment),
    engine: createEngineConfig(environment),
    lighting: createLightingConfig(environment),
    layout: createAthensLayoutConfig(environment),
  });
}

export let appConfig = buildConfig();

export function reloadConfig(environment = getRuntimeEnvironment()) {
  appConfig = buildConfig(environment);
  return appConfig;
}

export const assetConfig = currentAssetConfig;
export const engineConfig = currentEngineConfig;
export const lightingConfig = currentLightingConfig;
export const layoutConfig = currentLayoutConfig;

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      "./AssetConfig.js",
      "./EngineConfig.js",
      "./LightingConfig.js",
      "./athensLayoutConfig.js",
    ],
    () => {
      reloadConfig();
    },
  );
}
