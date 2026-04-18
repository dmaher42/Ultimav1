import type {
  Camera,
  ColorRepresentation,
  Material,
  Object3D,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
export type { UniformMap, TypedMesh, TypedShaderMaterial } from '@app/types/global';

/** Callback signature for querying the terrain height at a world coordinate. */
export type HeightSampler = (x: number, z: number) => number;

/** Minimal shape used by building and world utilities for terrain references. */
export interface TerrainLike extends Object3D {
  userData: Object3D['userData'] & {
    getHeightAt?: HeightSampler;
  };
}

/** Result payload emitted when a GLTF asset finishes loading. */
export interface GltfAssetLoadResult {
  url: string;
  gltf: GLTF;
  root: Object3D;
}

/** Configuration accepted by the shared GLTF loading helpers. */
export interface GltfAssetRequest {
  urls: string[];
  renderer?: WebGLRenderer | null;
  targetHeight?: number | null;
  onLoaded?: (result: GltfAssetLoadResult) => void;
  forceProcedural?: boolean;
}

/** Optional arguments supported by {@link Character.load}. */
export interface CharacterLoadOptions {
  targetHeight?: number;
}

/** Options available when instantiating building GLBs through {@link BuildingManager}. */
export interface BuildingLoadOptions {
  position?: Vector3;
  scale?: number;
  rotateY?: number;
  collision?: boolean;
  parent?: Object3D | null;
  heightSampler?: HeightSampler | null;
  terrainSampler?: HeightSampler | null;
  terrain?: TerrainLike | null;
}

/** Descriptor used by quick asset probes to validate CDN deployments. */
export interface AssetQuickCheck {
  label: string;
  path?: string;
  candidateKey?: string;
}

/** Mapping from logical asset keys to ordered fallback URLs. */
export type AssetCandidateMap = Record<string, string[]>;

/** Frozen manifest describing which remote resources should exist for the build. */
export interface AssetManifestConfig {
  manifestProbes: string[];
  probeGlbCandidates: string[];
  quickChecks: AssetQuickCheck[];
  candidates: AssetCandidateMap;
}

/** Lighting preset definition sourced from {@link lightingConfig}. */
export interface LightingPreset {
  label: string;
  phase: number;
  exposure: number;
  hotkey?: string;
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
}

/** Runtime lighting configuration including authored presets. */
export interface LightingConfig {
  cycle: {
    minutesPerDay: number;
  };
  bloom: {
    threshold: number;
    strength: number;
    radius: number;
  };
  exposure: {
    min: number;
    max: number;
    step: number;
  };
  presets: Record<string, LightingPreset>;
}

/** Persisted camera settings controlled through the HUD and settings store. */
export interface CameraSettingsSnapshot {
  enableArrowOrbit: boolean;
  yawSpeed: number;
  pitchSpeed: number;
  zoomSpeed: number;
  minPitch: number;
  maxPitch: number;
  minDist: number;
  maxDist: number;
  invertPitch: boolean;
}

/** Options that can be supplied to the {@link ThirdPersonCamera} constructor. */
export interface KeyOrbitOptions {
  enabled?: boolean;
  yawSpeed?: number;
  pitchSpeed?: number;
  minPitch?: number;
  maxPitch?: number;
  minDist?: number;
  maxDist?: number;
  zoomSpeed?: number;
  invertPitch?: boolean;
}

export interface ThirdPersonCameraOptions {
  offset?: Vector3;
  targetOffset?: Vector3;
  minPitch?: number;
  maxPitch?: number;
  collisionOffset?: number;
  followLerp?: number;
  rotationLerp?: number;
  yawSensitivity?: number;
  pitchSensitivity?: number;
  solids?: Object3D[];
  enabled?: boolean;
  keyOrbit?: KeyOrbitOptions;
}

/** Snapshot emitted by gameplay systems describing player motion. */
export interface ControllerSnapshot {
  camera?: Camera | null;
  velocity: Vector3;
  desiredVelocity: Vector3;
  grounded: boolean;
  flying: boolean;
  yaw: number;
  pitch: number;
  speed: number;
}

/**
 * Discriminated union capturing the locomotion state chosen by {@link PlayerController}.
 * The {@link state} field doubles as the animation key requested on {@link Character}.
 */
export type ControllerState =
  | (ControllerSnapshot & { state: 'idle'; animation: 'Idle' })
  | (ControllerSnapshot & { state: 'walk'; animation: 'Walk' })
  | (ControllerSnapshot & { state: 'swagger'; animation: 'Swagger' })
  | (ControllerSnapshot & { state: 'run'; animation: 'Run' })
  | (ControllerSnapshot & { state: 'airborne'; grounded: false; animation: 'Jump' })
  | (ControllerSnapshot & { state: 'flying'; flying: true; animation: 'Jump' });

/** Options accepted when showing the animated loading overlay. */
export interface LoadingScreenOptions {
  facts?: readonly string[];
  initialStatus?: string;
}

/** Entry describing a control shortcut in the hotkey overlay. */
export interface HotkeyDescriptor {
  keys: readonly string[];
  description: string;
}

/** Props forwarded to {@link mountHotkeyOverlay}. */
export interface HotkeyOverlayOptions {
  hotkeys?: readonly HotkeyDescriptor[];
  toggleKey?: string;
  showButton?: boolean;
}

/** Handle returned by HUD widgets that support explicit disposal. */
export interface HudWidgetHandle {
  dispose(): void;
}

/** Public contract returned by {@link mountHotkeyOverlay}. */
export interface HotkeyOverlayHandle extends HudWidgetHandle {
  element: HTMLElement;
  toggle(forceOpen?: boolean): void;
}

/** Configuration accepted by {@link mountAudioMixer}. */
export interface AudioMixerOptions {
  key?: string;
}

/** Configuration accepted by {@link mountExposureSlider}. */
export interface ExposureSliderOptions {
  min?: number;
  max?: number;
  step?: number;
  key?: string;
  storageKey?: string;
}

/** Civic district layout parameters used by {@link createCivicDistrict}. */
export interface CivicDistrictOptions {
  plazaLength?: number;
  promenadeWidth?: number;
  center?: Vector3 | { x?: number; y?: number; z?: number };
  terrain?: TerrainLike | null;
  heightSampler?: HeightSampler | null;
  terrainSampler?: HeightSampler | null;
  surfaceOffset?: number;
}

/** Blueprint overlay configuration mirroring {@link createCityPlanImplementation}. */
export interface CityPlanOverlayOptions {
  center?: Vector3 | { x?: number; y?: number; z?: number };
  terrain?: TerrainLike | null;
  heightSampler?: HeightSampler | null;
  terrainSampler?: HeightSampler | null;
  surfaceOffset?: number;
  civicCoreRadius?: number;
  transitLength?: number;
  transitWidth?: number;
  innovationLength?: number;
  innovationWidth?: number;
  innovationOffsetX?: number;
  innovationRotation?: number;
  neighborhoodInnerRadius?: number;
  neighborhoodOuterRadius?: number;
  greenBeltInnerRadius?: number;
  greenBeltOuterRadius?: number;
}

/** Core district data derived from config/districts.json. */
export interface DistrictRoadConfig {
  width: number;
  color: ColorRepresentation;
}

export interface DistrictRule {
  id: string;
  heightRange: [number, number];
  buildingDensity: string;
  minSeparation: number;
  allowedTypes: string[];
  road: DistrictRoadConfig;
}

export interface DistrictRuleSet {
  seed?: number;
  districts: DistrictRule[];
  densitySpacingMeters: Record<string, number>;
  maxSlopeDeltaPerLot: number;
  roadSetbackMeters: number;
  typeOverrides?: Record<string, unknown>;
}

/** Procedural city generation options consumed by {@link createCity}. */
export interface CityGenerationOptions {
  seed?: number;
  origin?: Vector3;
  gridSize?: Vector3 | Vector2;
  districtRules?: DistrictRuleSet;
  showFoundationPads?: boolean;
  useProceduralBlocks?: boolean;
  roadsVisible?: boolean;
  followPromenade?: boolean;
  forceProcedural?: boolean;
  spacingX?: number;
  spacingZ?: number;
  jitter?: number;
  maxSlope?: number;
  rotationStepMin?: number;
  rotationStepMax?: number;
  rotationSteps?: number | { min?: number; max?: number };
  rotationStepsRange?: [number, number];
  rotationOffsetRange?: [number, number];
  padRotationOffsetRange?: [number, number];
  promenadeRotationOffsetRange?: [number, number];
  padRotationJitterDeg?: number;
  gridWarpAmplitude?: number;
  gridWarpFrequency?: number;
  gridWarpNoise?: number;
}

/**
 * Declarative world presets exposed to the application bootstrap. The discriminant
 * makes it trivial for tooling (or future editors) to surface the supported presets.
 */
export type WorldPreset =
  | { type: 'harbor-city'; options?: CityGenerationOptions }
  | { type: 'civic-district'; options?: CivicDistrictOptions }
  | { type: 'city-plan-overlay'; options?: CityPlanOverlayOptions };
