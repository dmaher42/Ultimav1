import type { MeshStandardMaterial } from "three";

export interface AmbientOcclusionSettings {
  fallback: number;
  edgeInner: number;
  edgeOuter: number;
}

export interface AmbientOcclusionOverrides {
  fallback?: number;
  edgeInner?: number;
  edgeOuter?: number;
}

export function setMaterialAmbientOcclusion(
  material: MeshStandardMaterial,
  overrides?: AmbientOcclusionOverrides
): void;

export function getMaterialAmbientOcclusion(
  material: MeshStandardMaterial
): AmbientOcclusionSettings;
