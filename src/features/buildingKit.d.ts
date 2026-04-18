import type {
  BufferGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from "three";
import type { TypedMesh } from "@app/types/global";

export interface MarbleTextureSet {
  map: Texture | DataTexture;
  normalMap: Texture | DataTexture;
  roughnessMap: Texture | DataTexture;
  aoMap: Texture | DataTexture;
}

export interface MarbleMaterialOptions {
  baseUrl?: string;
  map?: string;
  normal?: string;
  rough?: string;
  ao?: string;
}

export interface ColumnOptions {
  height?: number;
  radiusTop?: number;
  radiusBottom?: number;
  radialSegments?: number;
  heightSegments?: number;
  material?: MeshPhysicalMaterial | null;
  materialOptions?: MarbleMaterialOptions;
}

export interface StylobateStepOptions {
  width?: number;
  depth?: number;
  stepCount?: number;
  stepHeight?: number;
  stepInset?: number;
  material?: MeshPhysicalMaterial | null;
  materialOptions?: MarbleMaterialOptions;
}

export interface PedimentOptions {
  width?: number;
  depth?: number;
  height?: number;
  material?: MeshPhysicalMaterial | null;
  materialOptions?: MarbleMaterialOptions;
}

export interface RoofOptions {
  width?: number;
  depth?: number;
  height?: number;
  overhang?: number;
  material?: MeshStandardMaterial | null;
}

export interface ColonnadeOptions {
  countX?: number;
  countZ?: number;
  spacingX?: number;
  spacingZ?: number;
  columnGeom?: BufferGeometry | null;
  columnMat?: Material | null;
  materialOptions?: MarbleMaterialOptions;
}

export function makeMarbleMaterialSet(
  options?: MarbleMaterialOptions
): Promise<MarbleTextureSet>;

export function makePlasterMaterial(options?: {
  color?: number;
  roughness?: number;
}): MeshStandardMaterial;

export function makeTerracottaMaterial(options?: { color?: number }): MeshStandardMaterial;

export function makeColumn(
  options?: ColumnOptions
): Promise<TypedMesh<CylinderGeometry, MeshPhysicalMaterial>>;

export function makeStylobateSteps(
  options?: StylobateStepOptions
): Promise<Group>;

export function makePediment(options?: PedimentOptions): Promise<Group>;

export function makeRoof(options?: RoofOptions): Group;

export function makeColonnadeInstanced(
  options?: ColonnadeOptions
): Promise<InstancedMesh<BufferGeometry, Material>>;

export function ensureUv2Attribute<TGeometry extends BufferGeometry>(
  geometry: TGeometry | null
): TGeometry | null;
