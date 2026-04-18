import * as THREE from "three";
import { ACROPOLIS_PEAK_3D, AGORA_CENTER_3D, HARBOR_CENTER_3D, getSeaLevelY } from "./locations.js";
import { applyForegroundFogPolicy } from "../utils/materialUtils.js";

const ROCK_GEOMETRY = new THREE.DodecahedronGeometry(0.28, 1); // Slightly smoother rocks
const GRASS_GEOMETRY = new THREE.ConeGeometry(0.12, 0.72, 8);
const BUSH_GEOMETRY = new THREE.IcosahedronGeometry(0.42, 1); // Smoother bushes

const POT_GEOMETRY = new THREE.CylinderGeometry(0.22, 0.16, 0.28, 12);
const PLANT_LEAF_GEOMETRY = new THREE.IcosahedronGeometry(0.32, 0);

const propMaterials = {
  rock: new THREE.MeshStandardMaterial({ color: "#7a756b", roughness: 0.9, metalness: 0.05 }),
  grass: new THREE.MeshStandardMaterial({ color: "#5a8c42", roughness: 0.85 }),
  bush: new THREE.MeshStandardMaterial({ color: "#3d632b", roughness: 0.88 }),
  pot: new THREE.MeshStandardMaterial({ color: "#b36241", roughness: 0.82, metalness: 0.02 }), // Terracotta
  plant: new THREE.MeshStandardMaterial({ color: "#2d5a1e", roughness: 0.9 }),
};

const OPENING_VISTA_WEST = AGORA_CENTER_3D.x - 62;
const OPENING_VISTA_EAST = AGORA_CENTER_3D.x + 18;
const OPENING_VISTA_SOUTH = AGORA_CENTER_3D.z - 24;
const OPENING_VISTA_NORTH = AGORA_CENTER_3D.z + 34;

export const GROUND_PROP_TYPES = ["rock", "grass-tuft", "bush"];

function pickPropType() {
  const r = Math.random();
  if (r < 0.12) return "potted-plant"; // Urban life
  if (r < 0.72) return "grass-tuft";
  return "bush";
}

function createPropMesh(type) {
  switch (type) {
    case "rock": {
      const mesh = new THREE.Mesh(ROCK_GEOMETRY, propMaterials.rock);
      mesh.scale.setScalar(THREE.MathUtils.randFloat(0.4, 0.82));
      mesh.rotation.set(
        THREE.MathUtils.randFloatSpread(0.2),
        Math.random() * Math.PI * 2,
        THREE.MathUtils.randFloatSpread(0.2),
      );
      return mesh;
    }
    case "grass-tuft": {
      const mesh = new THREE.Mesh(GRASS_GEOMETRY, propMaterials.grass);
      mesh.scale.setScalar(THREE.MathUtils.randFloat(0.7, 1.4));
      mesh.rotation.y = Math.random() * Math.PI * 2;
      return mesh;
    }
    case "potted-plant": {
      const group = new THREE.Group();
      const pot = new THREE.Mesh(POT_GEOMETRY, propMaterials.pot);
      pot.position.y = 0.14;
      group.add(pot);

      const plant = new THREE.Mesh(PLANT_LEAF_GEOMETRY, propMaterials.plant);
      plant.position.y = 0.48;
      plant.scale.set(0.8, 1.2, 0.8);
      group.add(plant);

      group.scale.setScalar(THREE.MathUtils.randFloat(0.9, 1.3));
      group.rotation.y = Math.random() * Math.PI * 2;
      return group;
    }
    case "bush":
    default: {
      const mesh = new THREE.Mesh(BUSH_GEOMETRY, propMaterials.bush);
      mesh.scale.setScalar(THREE.MathUtils.randFloat(1.0, 1.6));
      mesh.rotation.y = Math.random() * Math.PI * 2;
      return mesh;
    }
  }
}

function distanceToCurve(curve, x, z, samples = 120) {
  if (!curve?.getPoint) return Infinity;
  let best = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPoint(t);
    const dx = p.x - x;
    const dz = p.z - z;
    const d = Math.hypot(dx, dz);
    if (d < best) best = d;
  }
  return best;
}

function isInsideBuilding(x, z, placements, padding = 1.2) {
  if (!Array.isArray(placements)) return false;
  for (const placement of placements) {
    const radius = Math.max(
      padding,
      Math.hypot(placement?.width ?? 1, placement?.depth ?? 1) * 0.6,
    );
    const dx = (placement?.x ?? 0) - x;
    const dz = (placement?.z ?? 0) - z;
    if (dx * dx + dz * dz <= radius * radius) {
      return true;
    }
  }
  return false;
}

function isInsideKeyDistrict(x, z) {
  const civicDistance = Math.hypot(x - AGORA_CENTER_3D.x, z - AGORA_CENTER_3D.z);
  if (civicDistance < 78) return true;

  const acropolisDistance = Math.hypot(x - ACROPOLIS_PEAK_3D.x, z - ACROPOLIS_PEAK_3D.z);
  if (acropolisDistance < 28) return true;

  const harborDistance = Math.hypot(x - HARBOR_CENTER_3D.x, z - HARBOR_CENTER_3D.z);
  if (harborDistance < 26) return true;

  return false;
}

function isInsideOpeningVista(x, z) {
  if (
    x >= OPENING_VISTA_WEST &&
    x <= OPENING_VISTA_EAST &&
    z >= OPENING_VISTA_SOUTH &&
    z <= OPENING_VISTA_NORTH
  ) {
    return true;
  }

  const vistaStart = new THREE.Vector2(AGORA_CENTER_3D.x - 44, AGORA_CENTER_3D.z + 18);
  const vistaEnd = new THREE.Vector2(AGORA_CENTER_3D.x + 12, AGORA_CENTER_3D.z + 2);
  const vistaLine = new THREE.Line3(
    new THREE.Vector3(vistaStart.x, 0, vistaStart.y),
    new THREE.Vector3(vistaEnd.x, 0, vistaEnd.y),
  );
  const nearest = new THREE.Vector3();
  vistaLine.closestPointToPoint(new THREE.Vector3(x, 0, z), true, nearest);
  return Math.hypot(nearest.x - x, nearest.z - z) < 12;
}

export function scatterGroundProps(scene, terrain, options = {}) {
  if (!scene || !terrain) return null;

  const count = options.count ?? 10;
  const seaLevel = Number.isFinite(options?.seaLevel)
    ? options.seaLevel
    : getSeaLevelY();
  const placements = options.buildingPlacements || [];
  const roadCurves = Array.isArray(options.roadCurves) ? options.roadCurves : [];
  const mainRoadCurve = options.mainRoadCurve ?? null;
  const roadPadding = options.roadPadding ?? 2.8;
  const terrainSize = terrain.geometry?.userData?.size ?? 500;
  const half = terrainSize * 0.5;

  const group = new THREE.Group();
  group.name = "GroundProps";
  scene.add(group);

  const sampleHeight = terrain?.userData?.getHeightAt?.bind(terrain?.userData);

  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 5;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const x = THREE.MathUtils.randFloatSpread(terrainSize * 0.92);
    const z = THREE.MathUtils.randFloatSpread(terrainSize * 0.92);
    if (Math.abs(x) > half || Math.abs(z) > half) continue;

    const height = sampleHeight ? sampleHeight(x, z) : null;
    if (!Number.isFinite(height) || height <= seaLevel) continue;

    if (isInsideBuilding(x, z, placements)) continue;

    const inDistrict = isInsideKeyDistrict(x, z);
    const propType = pickPropType();

    // Only allow potted plants inside key civic districts; exclude rocks/bushes there.
    if (inDistrict && propType !== "potted-plant") continue;
    
    if (isInsideOpeningVista(x, z)) continue;

    const nearMainRoad = mainRoadCurve
      ? distanceToCurve(mainRoadCurve, x, z, 120) <= roadPadding
      : false;
    if (nearMainRoad) continue;

    let nearSecondaryRoad = false;
    for (const curve of roadCurves) {
      const d = distanceToCurve(curve, x, z, 60);
      if (d <= roadPadding) {
        nearSecondaryRoad = true;
        break;
      }
    }
    if (nearSecondaryRoad) continue;
    const mesh = createPropMesh(propType);
    mesh.position.set(x, height + 0.02, z);
    group.add(mesh);
    placed++;
  }

  if (group.children.length === 0) {
    scene.remove(group);
    return null;
  }

  applyForegroundFogPolicy(group);
  return group;
}
