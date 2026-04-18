import type { Vector3 } from "three";

export const ACROPOLIS_PEAK_3D: Vector3;
export const AGORA_CENTER_3D: Vector3;
export const CITY_AREA_RADIUS: number;
export const CITY_CHUNK_CENTER: Vector3;
export const HARBOR_CENTER_3D: Vector3;
export const MAIN_ROAD_WIDTH: number;

export interface HarborWaterBounds {
  west: number;
  east: number;
  north: number;
  south: number;
}

export const HARBOR_WATER_BOUNDS: HarborWaterBounds;
export const AEGEAN_OCEAN_BOUNDS: HarborWaterBounds;
export const HARBOR_WATER_CENTER: { x: number; y: number; z: number };
export const HARBOR_WATER_NORMAL_CANDIDATES: string[];

export function getSeaLevelY(): number;
export function setSeaLevelY(
  value: number,
  options?: { reason?: string; samples?: number },
): boolean;
export function getHarborSeaLevel(): number;
