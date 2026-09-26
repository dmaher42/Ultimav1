import CoreRenderEngine from './renderCore.js?v=2';
import { pipelineMethods } from './throneRoom/pipeline.js?v=2';
import { surfaceTilesMethods } from './throneRoom/surfaceTiles.js?v=2';
import { architectureMethods } from './throneRoom/architecture.js?v=2';
import { floorEffectsMethods } from './throneRoom/floorEffects.js?v=2';
import { objectStructureMethods } from './throneRoom/objectStructure.js?v=2';
import { objectLightingMethods } from './throneRoom/objectLighting.js?v=2';
import { reflectionsActorsMethods } from './throneRoom/reflectionsActors.js?v=2';
import { ornamentsMethods } from './throneRoom/ornaments.js?v=2';
import { characterVisualsMethods } from './throneRoom/characterVisuals.js?v=2';
import { hostileVisualsMethods } from './throneRoom/hostileVisuals.js?v=1';

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
  ornamentsMethods,
  characterVisualsMethods,
  hostileVisualsMethods
);

export default ThroneRoomRenderEngine;
