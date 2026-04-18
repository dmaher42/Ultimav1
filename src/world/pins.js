import * as THREE from 'three';

export function createPin(scene, p, color = 0xff3366) {
  const group = new THREE.Group();
  group.name = 'Pin';
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
  );
  pole.position.y = 0.6;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.3),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 })
  );
  flag.position.set(0.3, 1.0, 0);
  flag.rotation.y = Math.PI / 2;
  group.add(pole, flag);
  group.position.copy(p);
  group.renderOrder = 2;
  group.userData.noCollision = true;
  scene.add(group);
  return group;
}
