export interface EngineFeatureFlags {
  forceGlb?: boolean;
  forceProcedural?: boolean;
  useThirdPersonCamera?: boolean;
  [flag: string]: unknown;
}

export interface EngineBuildInfo {
  time?: string;
  sha?: string;
}

export interface EngineConfig {
  baseUrl?: string;
  districtRuleCandidates?: string[];
  queryParams?: URLSearchParams;
  featureFlags?: EngineFeatureFlags | null;
  build?: EngineBuildInfo;
  performance?: {
    enableGrass?: boolean;
    roadsVisible?: boolean;
  };
  debug?: {
    overlays?: {
      devHud?: any;
      cameraSettings?: any;
    };
  };
}

export const engineConfig: EngineConfig;

export function resolveFeatureToggle(descriptor?: any): boolean;
export function parseBooleanQuery(key: string, fallback?: boolean): boolean;
