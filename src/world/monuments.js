import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function applyVertexColor(geometry, color) {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const geom = geometry.toNonIndexed();
  const count = geom.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geom;
}

export function generateTholosGeometry(radius, height) {
  const geometries = [];
  const foundationHeight = Math.max(0.3, height * 0.12);
  const columnHeight = Math.max(1.5, height * 0.6);
  const roofHeight = Math.max(1.0, height * 0.35);

  const foundationGeo = new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, foundationHeight, 32);
  foundationGeo.translate(0, foundationHeight * 0.5, 0);
  geometries.push(applyVertexColor(foundationGeo, 0xcccccc));

  const columnCount = Math.max(12, Math.min(16, 12 + Math.floor(radius)));
  const columnRadius = Math.max(0.2, radius * 0.07);
  const columnGeo = new THREE.CylinderGeometry(columnRadius, columnRadius * 0.95, columnHeight, 16);
  columnGeo.translate(0, foundationHeight + columnHeight * 0.5, 0);
  const columnRingRadius = radius * 0.95;
  for (let i = 0; i < columnCount; i++) {
    const angle = (i / columnCount) * Math.PI * 2;
    const x = Math.cos(angle) * columnRingRadius;
    const z = Math.sin(angle) * columnRingRadius;
    const col = columnGeo.clone();
    col.translate(x, 0, z);
    geometries.push(applyVertexColor(col, 0xeeeeee));
  }

  const cellaRadius = radius * 0.55;
  const cellaHeight = columnHeight * 0.75;
  const cellaGeo = new THREE.CylinderGeometry(cellaRadius, cellaRadius, cellaHeight, 24);
  cellaGeo.translate(0, foundationHeight + cellaHeight * 0.5, 0);
  geometries.push(applyVertexColor(cellaGeo, 0xededed));

  const roofGeo = new THREE.ConeGeometry(radius * 1.05, roofHeight, 24);
  roofGeo.translate(0, foundationHeight + columnHeight + roofHeight * 0.5, 0);
  geometries.push(applyVertexColor(roofGeo, 0xb04c28));

  return mergeGeometries(geometries, false);
}

export function generateStoaGeometry(length, width, height) {
  const geometries = [];
  const foundationHeight = Math.max(0.3, height * 0.08);
  const wallThickness = Math.max(0.3, width * 0.1);
  const wallHeight = height;

  const baseGeo = new THREE.BoxGeometry(length + wallThickness * 2, foundationHeight, width + wallThickness);
  baseGeo.translate(0, foundationHeight * 0.5, 0);
  geometries.push(applyVertexColor(baseGeo, 0xbeb7a7));

  const backWallGeo = new THREE.BoxGeometry(length, wallHeight, wallThickness);
  backWallGeo.translate(0, foundationHeight + wallHeight * 0.5, -width * 0.5 + wallThickness * 0.5);
  geometries.push(applyVertexColor(backWallGeo, 0xf4d6a0));

  const sideWallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, width);
  sideWallGeo.translate(length * 0.5 - wallThickness * 0.5, foundationHeight + wallHeight * 0.5, 0);
  geometries.push(applyVertexColor(sideWallGeo, 0xf4d6a0));
  const oppositeWall = sideWallGeo.clone();
  oppositeWall.translate(-length + wallThickness, 0, 0);
  geometries.push(applyVertexColor(oppositeWall, 0xf4d6a0));

  const columnCount = Math.max(3, Math.ceil(length / 3));
  const columnRadius = Math.max(0.18, width * 0.06);
  const spacing = length / (columnCount + 1);
  const columnGeo = new THREE.CylinderGeometry(columnRadius, columnRadius * 0.95, wallHeight, 12);
  columnGeo.translate(0, foundationHeight + wallHeight * 0.5, width * 0.5 - wallThickness * 0.5);
  for (let i = 0; i < columnCount; i++) {
    const x = -length * 0.5 + spacing * (i + 1);
    const col = columnGeo.clone();
    col.translate(x, 0, 0);
    geometries.push(applyVertexColor(col, 0xeeeeee));
  }

  const roofRadius = Math.max(width * 0.55, 1.5);
  const roofGeo = new THREE.CylinderGeometry(roofRadius, roofRadius, length + wallThickness * 2, 3, 1, true);
  roofGeo.rotateZ(Math.PI / 2);
  roofGeo.translate(0, foundationHeight + wallHeight + roofRadius * 0.2, 0);
  geometries.push(applyVertexColor(roofGeo, 0xb04c28));

  return mergeGeometries(geometries, false);
}
