import type { BufferGeometry, DataTexture, Group, Scene, Texture, Vector3 } from "three";
import type {
  Water,
  WaterMaterial,
  WaterUniforms,
} from "three/examples/jsm/objects/Water.js";

export type WaterNormalSource =
  | string
  | string[]
  | {
      url?: string | null;
      urls?: string[] | null;
      candidates?: string[] | null;
    };

export interface OceanPositionOptions {
  x?: number;
  z?: number;
}

export interface OceanSizeOptions {
  x?: number;
  y?: number;
}

export interface OceanBoundsOptions {
  west: number;
  east: number;
  north: number;
  south: number;
}

export interface OceanClipPaddingOptions {
  front?: number | null;
  back?: number | null;
  north?: number | null;
  south?: number | null;
}

export interface OceanTerrainSampler {
  userData?: {
    getHeightAt?: ((x: number, z: number) => number | null | undefined) | null;
  };
}

export interface OceanOptions {
  baseTextureSize?: number;
  maxTextureSize?: number;
  devicePixelRatio?: number;
  seaLevel?: number | null;
  radius?: number | null;
  horizonOffset?: number | null;
  waterColor?: number | string | null;
  waterNormals?: WaterNormalSource | Texture | DataTexture | null;
  waterNormalsUrl?: string | null;
  waterNormalsCandidates?: string[] | null;
  position?: OceanPositionOptions | null;
  size?: OceanSizeOptions | null;
  bounds?: OceanBoundsOptions | null;
  shoreBlendWidth?: number | null;
  clipPadding?: number | OceanClipPaddingOptions | null;
  heightSampler?: ((x: number, z: number) => number | null | undefined) | null;
  terrain?: OceanTerrainSampler | null;
}

export interface OceanHandle {
  mesh: Water & { material: WaterMaterial };
  uniforms: WaterUniforms;
}

export function getDefaultWaterNormalCandidates(base?: string): string[];

export function createOcean(scene: Scene, options?: OceanOptions): Promise<OceanHandle>;

export function updateOcean(
  ocean: OceanHandle | null | undefined,
  deltaSeconds?: number,
  sunDir?: Vector3 | null,
  mood?: number
): void;
