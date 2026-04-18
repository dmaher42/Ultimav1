import * as THREE from "three";
import { applyTextureBudgetToObject } from "../utils/textureBudget.js";
import {
  makeMarbleMaterialSet,
  makePlasterMaterial,
  makeTerracottaMaterial,
  makeColumn,
  makeStylobateSteps,
  makePediment,
  makeRoof,
  makeColonnadeInstanced,
  ensureUv2Attribute,
} from "./buildingKit.js";

function cloneTexture(texture) {
  if (!texture) return null;
  if (typeof texture.clone === "function") {
    const cloned = texture.clone();
    cloned.needsUpdate = texture.needsUpdate;
    cloned.repeat.copy?.(texture.repeat ?? new THREE.Vector2(1, 1));
    cloned.offset.copy?.(texture.offset ?? new THREE.Vector2());
    cloned.center?.copy?.(texture.center ?? new THREE.Vector2());
    cloned.rotation = texture.rotation;
    cloned.wrapS = texture.wrapS;
    cloned.wrapT = texture.wrapT;
    cloned.colorSpace = texture.colorSpace;
    return cloned;
  }
  return texture;
}

async function createMarbleMaterial(overrides = {}, materialOptions = {}) {
  // Phase 4: Defer marble texture loading to requestAnimationFrame (2-3M deferral)
  return new Promise((resolve) => {
    requestAnimationFrame(async () => {
      const marbleSet = await makeMarbleMaterialSet(materialOptions);
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.45,
        metalness: 0.08,
        clearcoat: 0.24,
        clearcoatRoughness: 0.48,
        envMapIntensity: 0.9,
        ...overrides,
      });

      if (!overrides.map) material.map = cloneTexture(marbleSet.map);
      if (!overrides.normalMap) material.normalMap = cloneTexture(marbleSet.normalMap);
      if (!overrides.roughnessMap) material.roughnessMap = cloneTexture(marbleSet.roughnessMap);
      if (!overrides.aoMap) material.aoMap = cloneTexture(marbleSet.aoMap);

      console.info("[temples] Marble material loaded in background");
      resolve(material);
    });
  });
}

function setCollisionTag(object, shouldCollide = true) {
  object.traverse?.((child) => {
    if (!child?.isMesh) return;
    child.userData = child.userData || {};
    child.userData.noCollision = !shouldCollide;
  });
}

export async function buildTemple(options = {}) {
  const {
    width = 22,
    depth = 42,
    colX = 6,
    colZ = 13,
    scale = 1,
    order = "doric",
    materialPreset = "marble",
    columnHeight: columnHeightOverride,
    entablatureHeight: entablatureHeightOverride,
    pedimentHeight: pedimentHeightOverride,
    roofHeight: roofHeightOverride,
    materialOptions = {},
  } = options;

  const group = new THREE.Group();
  group.name = `ProceduralTemple_${order}`;
  group.userData = {
    ...(group.userData || {}),
    proceduralType: "temple",
    materialPreset,
  };
  group.userData.noCollision = false;

  const stylobateStepHeight = 0.38;
  const stylobateSteps = Math.max(3, Math.floor(options.stepCount ?? 3));
  const stylobateWidth = width + Math.max(2, (colX - 1) * 0.2);
  const stylobateDepth = depth + Math.max(2, (colZ - 1) * 0.2);
  const stylobate = await makeStylobateSteps({
    width: stylobateWidth,
    depth: stylobateDepth,
    stepCount: stylobateSteps,
    stepHeight: stylobateStepHeight,
    materialOptions,
  });
  group.add(stylobate);

  const stylobateHeight = stylobateSteps * stylobateStepHeight;
  const columnHeight = columnHeightOverride ?? Math.max(6, width * 0.7);
  const entablatureHeight = entablatureHeightOverride ?? columnHeight * 0.16;
  const pedimentHeight = pedimentHeightOverride ?? columnHeight * 0.22;
  const roofHeight = roofHeightOverride ?? columnHeight * 0.3;

  const columnSample = await makeColumn({
    height: columnHeight,
    materialOptions,
  });
  const spacingX = colX > 1 ? width / (colX - 1) : width;
  const spacingZ = colZ > 1 ? depth / (colZ - 1) : depth;
  const colonnade = await makeColonnadeInstanced({
    countX: colX,
    countZ: colZ,
    spacingX,
    spacingZ,
    columnGeom: columnSample.geometry,
    columnMat: columnSample.material,
    materialOptions,
  });
  colonnade.position.y = stylobateHeight;
  group.add(colonnade);

  const entablatureWidth = width + spacingX * 0.6;
  const entablatureDepth = depth + spacingZ * 0.6;
  const entablatureGeometry = new THREE.BoxGeometry(
    entablatureWidth,
    entablatureHeight,
    entablatureDepth
  );
  ensureUv2Attribute(entablatureGeometry);
  const entablatureMaterial = await createMarbleMaterial({}, materialOptions);
  const entablature = new THREE.Mesh(entablatureGeometry, entablatureMaterial);
  entablature.castShadow = true;
  entablature.receiveShadow = true;
  entablature.position.y = stylobateHeight + columnHeight + entablatureHeight / 2;
  entablature.userData = entablature.userData || {};
  entablature.userData.noCollision = false;
  group.add(entablature);

  const pedimentMaterial = await createMarbleMaterial({
    roughness: 0.42,
    clearcoat: 0.25,
  }, materialOptions);
  const pedimentDepth = Math.max(1.2, spacingZ * 0.4);
  const frontPediment = await makePediment({
    width: entablatureWidth,
    depth: pedimentDepth,
    height: pedimentHeight,
    material: pedimentMaterial.clone(),
    materialOptions,
  });
  frontPediment.position.y = stylobateHeight + columnHeight + entablatureHeight;
  frontPediment.position.z = depth / 2 + pedimentDepth * 0.5;
  group.add(frontPediment);

  const rearPediment = await makePediment({
    width: entablatureWidth,
    depth: pedimentDepth,
    height: pedimentHeight,
    material: pedimentMaterial.clone(),
    materialOptions,
  });
  rearPediment.rotation.y = Math.PI;
  rearPediment.position.y = stylobateHeight + columnHeight + entablatureHeight;
  rearPediment.position.z = -depth / 2 - pedimentDepth * 0.5;
  group.add(rearPediment);

  const roofMaterial = makeTerracottaMaterial({
    color: 0xcc7750,
  });
  const roof = makeRoof({
    width: entablatureWidth,
    depth: entablatureDepth,
    height: roofHeight,
    overhang: spacingX * 0.35,
    material: roofMaterial,
  });
  roof.position.y = stylobateHeight + columnHeight + entablatureHeight;
  group.add(roof);

  const cellaInsetX = Math.max(spacingX * 0.8, 3);
  const cellaInsetZ = Math.max(spacingZ * 0.8, 3);
  const cellaWidth = Math.max(4, width - cellaInsetX);
  const cellaDepth = Math.max(6, depth - cellaInsetZ);
  const cellaHeight = columnHeight * 0.72;
  const cellaGeometry = new THREE.BoxGeometry(cellaWidth, cellaHeight, cellaDepth);
  ensureUv2Attribute(cellaGeometry);
  const cellaMaterial = makePlasterMaterial();
  const cella = new THREE.Mesh(cellaGeometry, cellaMaterial);
  cella.position.y = stylobateHeight + cellaHeight / 2;
  cella.castShadow = true;
  cella.receiveShadow = true;
  cella.userData = cella.userData || {};
  cella.userData.noCollision = false;
  group.add(cella);

  setCollisionTag(group, true);

  if (Number.isFinite(scale)) {
    group.scale.setScalar(scale);
  } else if (scale?.isVector3) {
    group.scale.copy(scale);
  } else if (Array.isArray(scale) && scale.length >= 3) {
    group.scale.set(scale[0], scale[1], scale[2]);
  }

  // Safe mode intentionally disabled so normal gameplay always uses full textures.
  // applyTextureBudgetToObject(group, { safeMode: true });

  return group;
}

export function alignToGround(object, terrain, x, z, surfaceOffset = 0) {
  if (!object) return;
  const sampler =
    terrain?.userData?.getHeightAt?.bind(terrain.userData) || terrain?.getHeightAt || null;
  if (typeof sampler !== "function") return;
  const px = Number.isFinite(x) ? x : object.position?.x;
  const pz = Number.isFinite(z) ? z : object.position?.z;
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
  const height = sampler(px, pz);
  if (!Number.isFinite(height)) return;
  const offset = Number.isFinite(surfaceOffset) ? surfaceOffset : 0;
  object.position.y = height + offset;
}
