// ---- src/features/roads-gravel.js ----
import * as THREE from "three";
import { MATERIALS } from "../materials/materialRegistry.js";
import {
  GRASS_MIN_ELEV,
  SAND_MAX_ELEV,
  SLOPE_ROCK_MIN,
} from "../config/terrainMaterials.js";
import { getSeaLevelY } from "../world/locations.js";
import { getSlope } from "../world/terrainUtils.js";

/**
 * Applies gravel material to road meshes only.
 * Phase 3: Defer texture loading to requestAnimationFrame (5-8M deferral)
 * - Safe if textures missing (no-op).
 * - Idempotent: re-running won't double-apply.
 */
export async function applyGravelToRoads({ scene } = {}) {
  return new Promise((resolve) => {
    requestAnimationFrame(async () => {
      if (!scene) {
        resolve();
        return;
      }

      const tl = new THREE.TextureLoader();
      const seaLevel = getSeaLevelY();
      const terrainSampler =
        scene?.userData?.getHeightAt ||
        scene?.userData?.terrainHeightSampler ||
        null;
      let sandMap = null;
      let grassMap = null;
      let stoneMap = null;
      try {
        sandMap = await tl.loadAsync(MATERIALS.sand.albedo);
        sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping;
        sandMap.repeat.set(6, 6);
        sandMap.colorSpace = THREE.SRGBColorSpace;

        grassMap = await tl.loadAsync(MATERIALS.grass.albedo);
        grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping;
        grassMap.repeat.set(6, 6);
        grassMap.colorSpace = THREE.SRGBColorSpace;

        stoneMap = await tl.loadAsync(MATERIALS.stoneFallback.albedo);
        stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
        stoneMap.repeat.set(8, 8);
        stoneMap.colorSpace = THREE.SRGBColorSpace;
      } catch (err) {
        console.warn("Texture loading failed in applyGravelToRoads", err);
      }

      const sandMaterial = new THREE.MeshStandardMaterial({
        map: sandMap || null,
        color: sandMap ? 0xffffff : 0xcdb89c,
        roughness: 0.85,
      });
      const grassMaterial = new THREE.MeshStandardMaterial({
        map: grassMap || null,
        color: grassMap ? 0xffffff : 0x7a8b62,
        roughness: 0.9,
      });
      const stoneMaterial = new THREE.MeshStandardMaterial({
        map: stoneMap || null,
        color: stoneMap ? 0xffffff : 0xd6d1c8,
        roughness: 0.75,
      });

      if (!sandMaterial || !grassMaterial || !stoneMaterial) {
        resolve();
        return;
      }

      const pickRoad = (o) => {
        const name = (o.name || "").toLowerCase();
        const u = o.userData || {};
        return (
          name.includes("road") ||
          name.includes("street") ||
          name.includes("path") ||
          u.type === "road" ||
          u.kind === "road" ||
          u.category === "road"
        );
      };

      const isMainRoad = (o) => {
        const name = (o.name || "").toLowerCase();
        const u = o.userData || {};
        return (
          name.includes("main") ||
          name.includes("plaza") ||
          u.kind === "plaza" ||
          u.category === "plaza"
        );
      };

      const chooseMaterial = (o) => {
        if (isMainRoad(o)) return stoneMaterial;

        const pos = o.getWorldPosition(new THREE.Vector3());
        const elevation = Number.isFinite(pos.y) ? pos.y : 0;
        const slope = terrainSampler ? getSlope(terrainSampler, pos.x, pos.z) : 0;

        if (slope >= SLOPE_ROCK_MIN) {
          return stoneMaterial;
        }

        if (elevation <= seaLevel + SAND_MAX_ELEV) {
          return sandMaterial;
        }

        if (elevation >= seaLevel + GRASS_MIN_ELEV) {
          return grassMaterial;
        }

        return stoneMaterial;
      };

      let count = 0;
      scene.traverse((o) => {
        if (!o?.isMesh) return;
        if (!pickRoad(o)) return;
        if (o.material && o.material.userData?.__isGravel) return;
        o.material = chooseMaterial(o);
        o.material.userData = { ...(o.material.userData || {}), __isGravel: true };
        o.receiveShadow = true;
        count++;
      });

      console.info("[roads] Gravel textures applied in background");
      resolve();
    });
  });
}
