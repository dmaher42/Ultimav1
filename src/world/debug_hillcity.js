import * as THREE from "three";

export function mountHillCityDebug(scene, curve) {
  const group = new THREE.Group();
  group.name = "HillCityDebug";
  if (curve) {
    const pts = curve.getPoints(200);
    const geo = new THREE.BufferGeometry().setFromPoints(
      pts.map((p) => new THREE.Vector3(p.x, p.y + 0.05, p.z))
    );
    const mat = new THREE.LineBasicMaterial({ color: 0x00aaff });
    const line = new THREE.Line(geo, mat);
    group.add(line);
  }
  scene.add(group);
  return group;
}
