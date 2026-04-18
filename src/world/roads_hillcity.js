import * as THREE from "three";
import {
  MAIN_ROAD_WIDTH,
  HARBOR_CENTER_3D,
  AGORA_CENTER_3D,
  ACROPOLIS_PEAK_3D,
} from "./locations.js";
import { roadNoise } from "../utils/noise.js";

const SURFACE_OFFSET = 0.025;

// scene + terrain required so we can drape to ground
export function createMainHillRoad(scene, terrain) {
  // Gentle S-curve from harbor → agora → acropolis
  const pts = [
    HARBOR_CENTER_3D.clone().add(new THREE.Vector3(6, 0, -3)),
    HARBOR_CENTER_3D.clone()
      .lerp(AGORA_CENTER_3D, 0.42)
      .add(new THREE.Vector3(-1, 0.8, 5)),
    AGORA_CENTER_3D.clone().add(new THREE.Vector3(2, 0, -1)),
    AGORA_CENTER_3D.clone()
      .lerp(ACROPOLIS_PEAK_3D, 0.58)
      .add(new THREE.Vector3(1, 1.1, -3)),
    ACROPOLIS_PEAK_3D.clone().add(new THREE.Vector3(-0.5, 0, -0.5)),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);

  // Road ribbon geometry in WORLD space (XZ follows curve; Y sampled from terrain)
  const segments = 180;
  const baseWidth = MAIN_ROAD_WIDTH;
  const geo = new THREE.PlaneGeometry(baseWidth, 1, 1, segments);
  const pos = geo.attributes.position;
  const tangent = new THREE.Vector3();
  const dir = new THREE.Vector3();

  // helper for height sampling
  const getH = terrain?.userData?.getHeightAt?.bind(terrain?.userData);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPoint(t);
    const next = curve.getPoint(Math.min(1, t + 1 / segments));
    tangent.subVectors(next, p).normalize();

    // Calculate perpendicular offset logic:
    // We want a vector perpendicular to tangent (x, z).
    // Perp is (-z, x).
    // angle = atan2(tangent.x, tangent.z) is the bearing.
    // cos(angle) ~ z, sin(angle) ~ x.
    // So tangent ~ (sin(angle), cos(angle)).
    // Perp ~ (cos(angle), -sin(angle)).
    // Check: dot product = sin*cos - cos*sin = 0. Correct.

    const angle = Math.atan2(tangent.x, tangent.z);

    // Apply lateral noise
    const lateralOffset = roadNoise(t * 12, 999) * 0.6; // +/- 0.6m
    // Move P perpendicular to tangent
    p.x += Math.cos(angle) * lateralOffset;
    p.z += -Math.sin(angle) * lateralOffset;

    // Apply width noise
    const widthNoise = roadNoise(t * 8 + 50, 888) * 0.15; // +/- 15%
    const currentWidth = baseWidth * (1 + widthNoise);

    for (let j = 0; j < 2; j++) {
      const vertexIndex = i * 2 + j;
      const side = j === 0 ? -0.5 : 0.5;

      // Calculate vertex position relative to center P
      // dir vector should be perpendicular to tangent
      dir.set(Math.cos(angle) * side * currentWidth, 0, -Math.sin(angle) * side * currentWidth);

      const x = p.x + dir.x;
      const z = p.z + dir.z;

      // Sample height at the specific vertex position
      let y = getH ? getH(x, z) : p.y;
      if (!Number.isFinite(y)) y = p.y;

      const shoulderBlend = THREE.MathUtils.smoothstep(Math.abs(side), 0, 0.5);
      const embed = THREE.MathUtils.lerp(0.012, -0.018, shoulderBlend);

      y += SURFACE_OFFSET + embed;
      pos.setXYZ(vertexIndex, x, y, z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a8a8a,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // DO NOT rotate the mesh; vertices are already in world-space
  mesh.renderOrder = 1; // win depth vs semi-transparent water
  mesh.receiveShadow = true;
  mesh.name = "MainHillRoad";

  const group = new THREE.Group();
  group.name = "Roads";
  group.add(mesh);
  scene.add(group);

  return { group, curve, mesh };
}

export function updateMainHillRoadLighting() {}
