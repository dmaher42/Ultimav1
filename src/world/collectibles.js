import * as THREE from "three";

export class CollectiblesManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.score = 0;
    this.total = 0;
    this.onScoreChange = null;

    // Shared geometry/material for performance
    this.geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12);
    this.geometry.rotateZ(Math.PI / 2); // Lay flat like a scroll

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Gold
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0xaa6c39,
      emissiveIntensity: 0.4,
    });

    // Paper part of the scroll (white ends)
    this.paperMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  }

  spawnAt(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y + 1.2, z); // Float 1.2m above ground

    // Gold cylinder
    const scroll = new THREE.Mesh(this.geometry, this.material);
    scroll.castShadow = true;
    group.add(scroll);

    // Add a simple point light to make it glow
    const light = new THREE.PointLight(0xffaa00, 1, 3);
    light.position.y = 0.2;
    group.add(light);

    // Animation state
    group.userData = {
      baseY: group.position.y,
      phase: Math.random() * Math.PI * 2,
      collected: false,
    };

    this.scene.add(group);
    this.items.push(group);
    this.total++;
  }

  spawnRandomly(terrain, count, center, radius) {
    const getHeight = terrain?.userData?.getHeightAt;
    if (!getHeight) return;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius; // Uniform distribution
      const x = center.x + Math.cos(angle) * dist;
      const z = center.z + Math.sin(angle) * dist;

      const y = getHeight(x, z);
      if (Number.isFinite(y) && y > 2.5) { // Don't spawn underwater
        this.spawnAt(x, y, z);
      }
    }
  }

  update(dt, playerPos) {
    const collectDistSq = 1.5 * 1.5; // 1.5 meter pickup radius

    for (const item of this.items) {
      if (item.userData.collected || !item.visible) continue;

      // Animate
      item.rotation.y += 2.0 * dt; // Spin
      item.userData.phase += 3.0 * dt;
      item.position.y = item.userData.baseY + Math.sin(item.userData.phase) * 0.15; // Bob

      // Collision Check
      if (playerPos) {
        const distSq = item.position.distanceToSquared(playerPos);
        if (distSq < collectDistSq) {
          this.collect(item);
        }
      }
    }
  }

  collect(item) {
    item.userData.collected = true;
    item.visible = false;
    this.score++;

    // Simple "poof" effect (scale up and vanish) - could be expanded
    // For now just hide it.

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.total);
    }
  }
}
