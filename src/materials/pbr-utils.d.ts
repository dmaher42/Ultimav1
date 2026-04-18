import type { Material, MeshStandardMaterial, Object3D, Texture } from "three";

export interface PbrTextureSet {
  map: Texture;
  normalMap?: Texture;
  roughnessMap?: Texture;
  aoMap?: Texture;
}

export function urlExists(url: string): Promise<boolean>;

export function makeMarblePBR(basePath: string): Promise<MeshStandardMaterial | null>;

export function makeTiledPBR(
  basePath: string,
  repeat?: readonly [number, number]
): Promise<MeshStandardMaterial | null>;

export function applyMaterialToTree(
  root: Object3D | null | undefined,
  material: Material | null | undefined
): void;
