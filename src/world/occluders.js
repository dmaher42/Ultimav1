import * as THREE from 'three';

/**
 * Adds a thin, invisible "depth ribbon" draped over terrain so water behind it
 * won’t render. It writes depth but not color.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D} terrain - must provide userData.getHeightAt(x,z)
 * @param {THREE.Vector2} p1XZ - start (x,z)
 * @param {THREE.Vector2} p2XZ - end   (x,z)
 * @param {number} width - world units (default 6)
 * @param {number} segments - samples along the line (default 120)
 */
export function addDepthOccluderRibbon(scene, terrain, p1XZ, p2XZ, width = 6, segments = 120) {
  const getH = terrain?.userData?.getHeightAt?.bind(terrain?.userData);
  if (!getH) {
    console.warn('[occluder] terrain.getHeightAt missing');
    return null;
  }

  const p1 = new THREE.Vector3(p1XZ.x, 0, p1XZ.y);
  const p2 = new THREE.Vector3(p2XZ.x, 0, p2XZ.y);
  const dir = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z);
  if (dir.lengthSq() === 0) {
    dir.set(1, 0);
  } else {
    dir.normalize();
  }

  // perpendicular (to spread width)
  const n = new THREE.Vector2(-dir.y, dir.x); // rotate 90°
  const half = width * 0.5;

  // Build a ribbon (two rows of vertices along the path)
  const verts = new Float32Array((segments + 1) * 2 * 3);
  const pos = new THREE.BufferAttribute(verts, 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', pos);

  // indices (two triangles per segment)
  const idx = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2,  a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);

  const EPS = 0.05; // lift above ground a hair
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = THREE.MathUtils.lerp(p1.x, p2.x, t);
    const z = THREE.MathUtils.lerp(p1.z, p2.z, t);
    const y = (getH(x, z) ?? 0) + EPS;

    // left/right edges
    const lx = x - n.x * half;
    const lz = z - n.y * half;
    const rx = x + n.x * half;
    const rz = z + n.y * half;

    const iL = (i * 2) * 3;
    const iR = (i * 2 + 1) * 3;
    verts[iL + 0] = lx; verts[iL + 1] = y; verts[iL + 2] = lz;
    verts[iR + 0] = rx; verts[iR + 1] = y; verts[iR + 2] = rz;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Invisible material that ONLY writes depth
  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    colorWrite: false, // Only write depth, not color
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'WaterDepthOccluderRibbon';
  // Ensure it renders BEFORE water (so water respects its depth)
  mesh.renderOrder = -2;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.userData.noCollision = true;

  scene.add(mesh);
  return mesh;
}
