/**
 * Terrain Shape Contract (Mainland Coastal City)
 *
 * This world is NOT an island. The macro-shape must always read as:
 * - Open sea on exactly ONE side (SEA_SIDE).
 * - Continuous mainland on the other sides, rising inland into hills/mountains.
 *
 * Invariants:
 * - Only SEA_SIDE may slope down to sea level across the coast band.
 * - Non-sea borders must remain above waterline via a small HEIGHT buffer
 *   (do NOT use slope thresholds as height).
 * - Avoid symmetric edge water masks and any radial falloff (center bowls/rims).
 *
 * If terrain shaping changes, update validation rules in
 * src/world/terrainValidation.ts to match (validation is authoritative).
 */
export type SeaSide = "north" | "south" | "east" | "west";

export const SEA_SIDE: SeaSide = "east";
export const COAST_WIDTH = 120;
export const INLAND_RISE = 220;
export const RIDGE_START = 0.6;
export const RIDGE_HEIGHT = 70;
export const CITY_SLOPE_MAX = 1.5;
