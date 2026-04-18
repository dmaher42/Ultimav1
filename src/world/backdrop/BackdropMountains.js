import * as THREE from "three";
import { AGORA_CENTER_3D, HARBOR_CENTER_3D } from "../locations.js";

// Deterministic RNG for consistent mountain placement
function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export class BackdropMountains {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.seaLevel = options.seaLevel || 0;
    this.seed = options.seed || 12345;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  create() {
    // Use a clean horizon band instead of mountains to keep the border subtle.
    this.createHorizonBorder();
    // Enable mainland extension ring to ensure the world is not an island.
    this.createMainlandExtension();
  }

  createHorizonBorder() {
    const radius = 3200;
    const height = 360;
    const segments = 72;

    const wallGeometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x97a4ad,
      emissive: new THREE.Color(0x97a4ad).multiplyScalar(0.18),
      emissiveIntensity: 1,
      roughness: 0.98,
      metalness: 0,
      fog: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.28,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(AGORA_CENTER_3D.x, this.seaLevel + height * 0.5 - 35, AGORA_CENTER_3D.z);
    wall.receiveShadow = false;
    wall.castShadow = false;
    this.group.add(wall);

    const upperGeometry = new THREE.CylinderGeometry(radius + 20, radius + 20, height * 0.65, segments, 1, true);
    const upperMaterial = new THREE.MeshStandardMaterial({
      color: 0xa7b2ba,
      emissive: new THREE.Color(0xa7b2ba).multiplyScalar(0.16),
      emissiveIntensity: 1,
      roughness: 0.99,
      metalness: 0,
      fog: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.18,
    });
    const upper = new THREE.Mesh(upperGeometry, upperMaterial);
    upper.position.set(AGORA_CENTER_3D.x, this.seaLevel + height * 0.85, AGORA_CENTER_3D.z);
    upper.receiveShadow = false;
    upper.castShadow = false;
    this.group.add(upper);

    const hazeGeometry = new THREE.RingGeometry(radius - 680, radius - 220, 84, 1);
    hazeGeometry.rotateX(-Math.PI / 2);
    const hazeMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa5ad,
      emissive: new THREE.Color(0x9aa5ad).multiplyScalar(0.16),
      emissiveIntensity: 1,
      roughness: 1,
      metalness: 0,
      fog: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    });
    const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
    haze.position.set(AGORA_CENTER_3D.x, this.seaLevel + 12, AGORA_CENTER_3D.z);
    haze.receiveShadow = false;
    haze.castShadow = false;
    this.group.add(haze);
  }

  createBackdropMaterial(color, { emissiveStrength = 0.22, roughness = 0.95 } = {}) {
    const base = new THREE.Color(color);
    const emissive = base.clone().multiplyScalar(emissiveStrength);
    return new THREE.MeshStandardMaterial({
      color: base,
      emissive,
      emissiveIntensity: 1,
      roughness,
      metalness: 0,
      fog: true,
      side: THREE.DoubleSide,
    });
  }

  createJaggedRidgeLines() {
    const ridgeCount = 4;
    const minRadius = 1350;
    const maxRadius = 2100;
    const coverage = Math.PI * 0.86;
    const startAngle = Math.PI - coverage * 0.5;
    const materialPalette = [
      0x8d99a3,
      0x7f8b94,
      0x99a8b2,
      0xa6b2ba,
    ];

    for (let r = 0; r < ridgeCount; r++) {
      const points = [];
      const pointCount = 18 + r * 4;
      const radius = THREE.MathUtils.lerp(minRadius, maxRadius, r / (ridgeCount - 1));
      const heightBase = 90 + r * 45;
      const heightVariation = 120 + r * 40;

      for (let i = 0; i < pointCount; i++) {
        const t = i / (pointCount - 1);
        const angle = startAngle + t * coverage;
        const jitter = (seededRandom(this.seed + r * 97 + i * 13) - 0.5) * 0.18;
        const radiusJitter = (seededRandom(this.seed + r * 53 + i * 11) - 0.5) * 160;
        const heightNoise = (seededRandom(this.seed + r * 71 + i * 19) - 0.5) * 2;
        const localRadius = radius + radiusJitter;
        const x = Math.cos(angle + jitter) * localRadius;
        const z = Math.sin(angle + jitter) * localRadius;
        const y = heightBase + heightVariation * Math.max(0, heightNoise);
        points.push(new THREE.Vector3(x, this.seaLevel + y, z));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const segments = pointCount * 6;
      const tubeRadius = 16 + r * 4;
      const geometry = new THREE.TubeGeometry(curve, segments, tubeRadius, 6, false);
      const material = this.createBackdropMaterial(
        materialPalette[r % materialPalette.length],
        { emissiveStrength: 0.24 }
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(AGORA_CENTER_3D.x, 0, AGORA_CENTER_3D.z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
    }
  }

  createRidgeBands() {
    const innerRadius = 1500;
    const outerRadius = 2350;
    const coverage = Math.PI * 0.9;
    const startAngle = Math.PI - coverage * 0.5;
    const thetaSegments = 72;
    const radialSegments = 4;

    const makeRidge = (minH, maxH, color, heightBias) => {
      const geometry = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        thetaSegments,
        radialSegments,
        startAngle,
        coverage
      );

      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.hypot(x, y);
        const t = seededRandom(this.seed + i * 17);
        const ridgeNoise = (t - 0.5) * 2;
        const radialFactor = THREE.MathUtils.clamp((r - innerRadius) / (outerRadius - innerRadius), 0, 1);
        const height = THREE.MathUtils.lerp(minH, maxH, radialFactor * 0.8 + heightBias)
          + ridgeNoise * (maxH - minH) * 0.3;
        pos.setZ(i, height);
      }

      geometry.rotateX(-Math.PI / 2);

      const material = this.createBackdropMaterial(color, { emissiveStrength: 0.26 });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(AGORA_CENTER_3D.x, this.seaLevel - 6, AGORA_CENTER_3D.z);
      mesh.receiveShadow = false;
      mesh.castShadow = false;
      this.group.add(mesh);
    };

    makeRidge(60, 190, 0x9aa8b2, 0.25);
    makeRidge(90, 250, 0x87939c, 0.4);
    makeRidge(150, 330, 0x9fb2bf, 0.55);
    makeRidge(210, 380, 0xd6dee2, 0.7);
  }

  createMountains() {
    const count = 26; // Keep the mainland readable without boxing in the sea view.
    const minRadius = 2100;
    const maxRadius = 3000;

    // Use broader low-poly masses so the skyline reads like layered hills instead of sharp black pyramids.
    const geoms = [
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
    ];

    // Align base to 0.
    geoms.forEach(g => {
        g.computeBoundingBox();
        const minY = g.boundingBox?.min.y ?? 0;
        g.translate(0, -minY, 0);
        g.computeVertexNormals();
    });

    const ridgeMaterials = [
      this.createBackdropMaterial(0x8a97a0, { emissiveStrength: 0.2 }),
      this.createBackdropMaterial(0x94a2aa, { emissiveStrength: 0.22 }),
      this.createBackdropMaterial(0x7a857b, { emissiveStrength: 0.18 }),
    ];

    const mountainGeoms = [];

    // Direction logic: Concentrate in West (-X). Remove from East (+X).
    for (let i = 0; i < count; i++) {
      const t = seededRandom(this.seed + i);
      const t2 = seededRandom(this.seed + i + 1000);

      // Keep mountains mostly on the mainland side so the harbor has a much
      // wider eastern opening to the sea.
      const coverage = Math.PI * 0.92;
      const startAngle = Math.PI - coverage * 0.5;
      const angle = startAngle + t * coverage;

      const radius = minRadius + t2 * (maxRadius - minRadius);

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const scaleW = 240 + seededRandom(this.seed + i * 2) * 360;
      const scaleD = 220 + seededRandom(this.seed + i * 6) * 320;
      const scaleH = 60 + seededRandom(this.seed + i * 3) * 120;

      const geomIdx = Math.floor(seededRandom(this.seed + i * 4) * geoms.length);
      const geom = geoms[geomIdx].clone();

      geom.scale(scaleW, scaleH, scaleD);
      geom.rotateY(seededRandom(this.seed + i * 5) * Math.PI * 2);
      geom.translate(x, this.seaLevel - 16, z);

      mountainGeoms.push({
        geom,
        material: ridgeMaterials[i % ridgeMaterials.length],
      });
    }

    if (mountainGeoms.length > 0) {
        mountainGeoms.forEach(({ geom, material }) => {
             const m = new THREE.Mesh(geom, material);
             m.castShadow = false;
             m.receiveShadow = false;
             m.matrixAutoUpdate = false;
             m.updateMatrix();
             this.group.add(m);
        });
    }
  }

  createMidgroundHills() {
    const count = 42;
    const minRadius = 700;
    const maxRadius = 1350;

    const geoms = [
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
    ];

    geoms.forEach(g => {
      g.computeBoundingBox();
      const minY = g.boundingBox?.min.y ?? 0;
      g.translate(0, -minY, 0);
      g.computeVertexNormals();
    });

    const hillMaterials = [
      this.createBackdropMaterial(0x9aa5aa, { emissiveStrength: 0.2 }),
      this.createBackdropMaterial(0xa3adb3, { emissiveStrength: 0.22 }),
      this.createBackdropMaterial(0x879184, { emissiveStrength: 0.18 }),
    ];

    for (let i = 0; i < count; i++) {
      const t = seededRandom(this.seed + i * 11);
      const t2 = seededRandom(this.seed + i * 17);
      const coverage = Math.PI * 0.78;
      const startAngle = Math.PI - coverage * 0.5;
      const angle = startAngle + t * coverage;
      const radius = minRadius + t2 * (maxRadius - minRadius);

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const scaleW = 180 + seededRandom(this.seed + i * 3) * 300;
      const scaleD = 160 + seededRandom(this.seed + i * 5) * 260;
      const scaleH = 45 + seededRandom(this.seed + i * 7) * 100;

      const geomIdx = Math.floor(seededRandom(this.seed + i * 13) * geoms.length);
      const geom = geoms[geomIdx].clone();

      geom.scale(scaleW, scaleH, scaleD);
      geom.rotateY(seededRandom(this.seed + i * 9) * Math.PI * 2);
      geom.translate(x, this.seaLevel + 4, z);

      const material = hillMaterials[i % hillMaterials.length];
      const mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
    }
  }

  createMainlandExtension() {
      // Create a full ring to act as skirt, but modulate height based on sector.
      // Inner radius matches roughly half the terrain size (1200) with overlap.
      const innerRadius = 1100;
      const outerRadius = 4500;
      // Full circle to ensure no gaps at sector boundaries
      const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64, 8);

      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.hypot(x, y);

        // RingGeometry is XY plane.
        // angle 0 is East (+X).
        const angle = Math.atan2(y, x);

        // Determine sector
        // We want West (PI) to be land (Positive Height / Rise)
        // We want East (0) to be seabed (Negative Height / Sink)

        // Normalize Eastness: 1 at East, -1 at West
        const eastness = Math.cos(angle);

        // Base rise calculation for land
        // At West: (r - innerRadius) * 0.04 -> rises to ~80m

        let height = 0;

        // Smooth transition from Land (West) to Seabed (East)
        // Let's use smoothstep.
        // If cos(angle) < -0.2 (West-ish), it's Land.
        // If cos(angle) > 0.2 (East-ish), it's Sea.

        const landFactor = 1.0 - smoothstep(-0.2, 0.4, eastness);
        // 1.0 at West, 0.0 at East.

        // Land Profile: Rise
        const landHeight = (r - innerRadius) * 0.04;

        // Sea Profile: Drop (Seabed Skirt)
        // Drop quickly near inner radius, then flatten?
        // Or just linear drop.
        const seaHeight = -25.0 - (r - innerRadius) * 0.02;

        // Blend
        height = THREE.MathUtils.lerp(seaHeight, landHeight, landFactor);

        pos.setZ(i, height);
      }

      geometry.rotateX(-Math.PI / 2);

      const material = this.createBackdropMaterial(0x7a735f, { emissiveStrength: 0.15 });
      material.side = THREE.FrontSide;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(AGORA_CENTER_3D.x, this.seaLevel - 0.5, AGORA_CENTER_3D.z);
      mesh.receiveShadow = true;

      this.group.add(mesh);

      const scrubInnerRadius = 900;
      const scrubOuterRadius = 1650;
      const scrubGeometry = new THREE.RingGeometry(scrubInnerRadius, scrubOuterRadius, 84, 4);
      const scrubPos = scrubGeometry.attributes.position;

      for (let i = 0; i < scrubPos.count; i++) {
        const x = scrubPos.getX(i);
        const y = scrubPos.getY(i);
        const r = Math.hypot(x, y);
        const angle = Math.atan2(y, x);
        const eastness = Math.cos(angle);
        const landFactor = 1.0 - smoothstep(-0.1, 0.45, eastness);
        const baseHeight = (r - scrubInnerRadius) * 0.03;
        const noise = (seededRandom(this.seed + i * 13) - 0.5) * 16;
        const height = THREE.MathUtils.lerp(-14, baseHeight + noise, landFactor);
        scrubPos.setZ(i, height);
      }

      scrubGeometry.rotateX(-Math.PI / 2);
      const scrubMaterial = this.createBackdropMaterial(0x8d846f, { emissiveStrength: 0.16 });
      scrubMaterial.side = THREE.FrontSide;
      const scrubMesh = new THREE.Mesh(scrubGeometry, scrubMaterial);
      scrubMesh.position.set(AGORA_CENTER_3D.x, this.seaLevel + 0.8, AGORA_CENTER_3D.z);
      scrubMesh.receiveShadow = false;
      this.group.add(scrubMesh);
  }
}

// Helper needed because smoothstep isn't in JS math
function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}
