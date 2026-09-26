import CoreRenderEngine from './renderCore.js';
import { pipelineMethods } from './throneRoom/pipeline.js';
import { surfaceTilesMethods } from './throneRoom/surfaceTiles.js';
import { architectureMethods } from './throneRoom/architecture.js';
import { floorEffectsMethods } from './throneRoom/floorEffects.js';
import { objectStructureMethods } from './throneRoom/objectStructure.js';
import { objectLightingMethods } from './throneRoom/objectLighting.js';
import { reflectionsActorsMethods } from './throneRoom/reflectionsActors.js';
import { ornamentsMethods } from './throneRoom/ornaments.js';

/**
 * Castle Britannia visual overhaul.
 *
 * The original renderer remains in renderCore.js. This subclass replaces only
 * the Castle Britannia scene, preserving gameplay coordinates, collision,
 * combat, dialogue, quest logic, and every other map's proven rendering path.
 */
class ThroneRoomRenderEngine extends CoreRenderEngine {}

Object.assign(
  ThroneRoomRenderEngine.prototype,
  pipelineMethods,
  surfaceTilesMethods,
  architectureMethods,
  floorEffectsMethods,
  objectStructureMethods,
  objectLightingMethods,
  reflectionsActorsMethods,
  ornamentsMethods
);

export default ThroneRoomRenderEngine;
