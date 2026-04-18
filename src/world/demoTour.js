import * as THREE from "three";
import {
  ACROPOLIS_PEAK_3D,
  AGORA_CENTER_3D,
  HARBOR_GROUND_HEIGHT,
  HARBOR_CENTER_3D,
} from "./locations.js";

const DISTRICT_MARKERS = [
  {
    id: "agora",
    label: "Agora",
    theme: "agora",
    accent: 0xd9a441,
    glow: 0xf5d37f,
    anchor: new THREE.Vector3(AGORA_CENTER_3D.x + 12, AGORA_CENTER_3D.y, AGORA_CENTER_3D.z - 10),
  },
  {
    id: "harbor",
    label: "Harbor Quarter",
    theme: "harbor",
    accent: 0x2b86a8,
    glow: 0x82d7f4,
    labelScale: { x: 10.8, y: 3.25 },
    labelHeight: 6.4,
    focusLightHeight: 4.4,
    focusLightDistance: 22,
    anchor: new THREE.Vector3(
      HARBOR_CENTER_3D.x - 12,
      HARBOR_CENTER_3D.y + HARBOR_GROUND_HEIGHT,
      HARBOR_CENTER_3D.z + 20,
    ),
  },
  {
    id: "acropolis",
    label: "Acropolis",
    theme: "acropolis",
    accent: 0xd7cab4,
    glow: 0xffe7b0,
    labelScale: { x: 10.2, y: 3.15 },
    labelHeight: 6.3,
    focusLightHeight: 4.2,
    focusLightDistance: 18,
    anchor: new THREE.Vector3(ACROPOLIS_PEAK_3D.x + 10, ACROPOLIS_PEAK_3D.y, ACROPOLIS_PEAK_3D.z - 8),
  },
];

const TOUR_STAGES = [
  {
    markerId: "harbor",
    radius: 18,
    objective:
      "You begin in the Agora. Follow the blue harbor marker downhill to the docks.",
    completion:
      "The harbor opens to the sea. Now climb toward the ivory Acropolis beacon above the city.",
  },
  {
    markerId: "acropolis",
    radius: 16,
    objective:
      "Climb from the harbor to the Acropolis and reach the ivory beacon above the city.",
    completion:
      "You crossed Athens from market to sea to summit. The short walking tour is complete.",
  },
];
const ARRIVAL_PULSE_DURATION = 5.5;
const ROUTE_GUIDES = [
  {
    markerId: "harbor",
    accent: 0x2b86a8,
    glow: 0x82d7f4,
    positions: [
      AGORA_CENTER_3D.clone().add(new THREE.Vector3(18, 0, -2)),
      AGORA_CENTER_3D.clone().lerp(HARBOR_CENTER_3D, 0.22).add(new THREE.Vector3(8, 0, -6)),
      AGORA_CENTER_3D.clone().lerp(HARBOR_CENTER_3D, 0.42).add(new THREE.Vector3(12, 0, -8)),
      AGORA_CENTER_3D.clone().lerp(HARBOR_CENTER_3D, 0.62).add(new THREE.Vector3(12, 0, -2)),
      HARBOR_CENTER_3D.clone().add(new THREE.Vector3(-22, 0, 16)),
      HARBOR_CENTER_3D.clone().add(new THREE.Vector3(-10, 0, 20)),
    ],
  },
  {
    markerId: "acropolis",
    accent: 0xd7cab4,
    glow: 0xffe7b0,
    positions: [
      HARBOR_CENTER_3D.clone().add(new THREE.Vector3(-8, 0, 12)),
      HARBOR_CENTER_3D.clone().lerp(ACROPOLIS_PEAK_3D, 0.26).add(new THREE.Vector3(-10, 0, 4)),
      HARBOR_CENTER_3D.clone().lerp(ACROPOLIS_PEAK_3D, 0.48).add(new THREE.Vector3(-2, 0, 12)),
      HARBOR_CENTER_3D.clone().lerp(ACROPOLIS_PEAK_3D, 0.68).add(new THREE.Vector3(4, 0, 8)),
      HARBOR_CENTER_3D.clone().lerp(ACROPOLIS_PEAK_3D, 0.86).add(new THREE.Vector3(4, 0, -2)),
    ],
  },
];
const APPROACH_FRAMES = [
  {
    markerId: "harbor",
    accent: 0x2b86a8,
    glow: 0x82d7f4,
    anchor: AGORA_CENTER_3D.clone().lerp(HARBOR_CENTER_3D, 0.18).add(new THREE.Vector3(-6, 0, 4)),
    facingTarget: AGORA_CENTER_3D.clone().lerp(HARBOR_CENTER_3D, 0.58).add(new THREE.Vector3(10, 0, 4)),
    bannerColor: 0x2b86a8,
    title: "Across The Agora",
    labelScale: { x: 5.8, y: 1.8 },
    labelHeight: 5.45,
  },
  {
    markerId: "acropolis",
    accent: 0xd7cab4,
    glow: 0xffe7b0,
    anchor: HARBOR_CENTER_3D.clone().lerp(ACROPOLIS_PEAK_3D, 0.74).add(new THREE.Vector3(2, 0, -2)),
    facingTarget: ACROPOLIS_PEAK_3D.clone(),
    bannerColor: 0xc8b68c,
    title: "Climb To The Acropolis",
  },
];

function createBannerCloth(color, width = 1.2, height = 1.8) {
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.66,
      metalness: 0.04,
    }),
  );
  cloth.castShadow = true;
  cloth.userData = {
    ...(cloth.userData || {}),
    swaySpeed: THREE.MathUtils.randFloat(1.2, 1.8),
    swayAmount: THREE.MathUtils.randFloat(0.05, 0.12),
    baseRotationZ: 0,
  };
  return cloth;
}

function createSightlineColumn(color = 0xd4ccb9, height = 4.8) {
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, height, 16),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.52,
      metalness: 0.04,
    }),
  );
  column.position.y = height * 0.5;
  column.castShadow = true;
  column.receiveShadow = true;
  return column;
}

function createCrate(color = 0x8b6947, size = 0.9) {
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * 0.62, size),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  crate.castShadow = true;
  crate.receiveShadow = true;
  return crate;
}

function createAmphora(color = 0xbd8769) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.08,
  });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.13, 0.72, 12),
    material,
  );
  body.position.y = 0.36;
  body.castShadow = true;
  group.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.22, 12),
    material,
  );
  neck.position.y = 0.82;
  neck.castShadow = true;
  group.add(neck);

  return group;
}

function createBrazier(accent, glow) {
  const group = new THREE.Group();
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, 1.1, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a4339, roughness: 0.7, metalness: 0.28 }),
  );
  stand.position.y = 0.55;
  stand.castShadow = true;
  group.add(stand);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.25, 0.24, 12),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.16 }),
  );
  bowl.position.y = 1.16;
  bowl.castShadow = true;
  group.add(bowl);

  const flame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshStandardMaterial({
      color: glow,
      emissive: glow,
      emissiveIntensity: 0.85,
      roughness: 0.18,
      metalness: 0,
    }),
  );
  flame.position.y = 1.42;
  flame.userData = {
    ...(flame.userData || {}),
    pulseSpeed: THREE.MathUtils.randFloat(4.5, 6.2),
    pulseOffset: Math.random() * Math.PI * 2,
  };
  group.add(flame);

  return { group, flame };
}

function sampleGroundY(terrain, anchor) {
  const fallbackY = Number.isFinite(anchor?.y) ? anchor.y : 0;
  const sampler = terrain?.userData?.getHeightAt;
  if (typeof sampler === "function") {
    const sampled = sampler(anchor.x, anchor.z);
    if (Number.isFinite(sampled)) {
      return Math.max(sampled, fallbackY);
    }
  }
  return fallbackY;
}

function markNoCollision(object) {
  object.userData = object.userData || {};
  object.userData.noCollision = true;
  object.traverse?.((child) => {
    child.userData = child.userData || {};
    child.userData.noCollision = true;
  });
}

function createLabelSprite(text, accentColor, scale = { x: 9.5, y: 3 }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Sprite();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(22, 18, 12, 0.82)";
  ctx.fillRect(20, 24, canvas.width - 40, canvas.height - 48);
  ctx.strokeStyle = `#${accentColor.toString(16).padStart(6, "0")}`;
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 24, canvas.width - 40, canvas.height - 48);
  ctx.fillStyle = "#f7f1e4";
  ctx.font = "600 52px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale.x ?? 9.5, scale.y ?? 3, 1);
  sprite.renderOrder = 4;
  return sprite;
}

function createArrivalHalo(marker) {
  const light = new THREE.PointLight(marker.glow, 0, 28, 2);
  light.position.set(0, 2.8, 0);

  return { light };
}

function createRouteGuide(route, index, terrain) {
  const group = new THREE.Group();
  group.name = `DemoGuide_${route.markerId}_${index}`;

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 0.55, 14),
    new THREE.MeshStandardMaterial({
      color: 0xa4947b,
      roughness: 0.8,
      metalness: 0.03,
    }),
  );
  pedestal.position.y = 0.275;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x816950,
      roughness: 0.76,
      metalness: 0.04,
    }),
  );
  post.position.y = 1.55;
  post.castShadow = true;
  group.add(post);

  const banner = createBannerCloth(route.accent, 0.68, 1.45);
  banner.position.set(0.34, 2.15, 0);
  banner.rotation.y = Math.PI / 2;
  banner.userData.baseRotationZ = THREE.MathUtils.degToRad(6);
  group.add(banner);

  const ember = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshStandardMaterial({
      color: route.glow,
      emissive: route.glow,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0,
    }),
  );
  ember.position.set(0, 2.9, 0);
  group.add(ember);

  const light = new THREE.PointLight(route.glow, 0.7, 10, 2);
  light.position.set(0, 2.7, 0);
  group.add(light);

  const anchor = route.positions[index];
  group.position.copy(anchor);
  group.position.y = sampleGroundY(terrain, anchor) + 0.04;
  markNoCollision(group);
  group.userData.routeMarkerId = route.markerId;
  group.userData.guideLight = light;
  group.userData.guideFlame = ember;
  return group;
}

function createApproachFrame(frame, terrain) {
  const group = new THREE.Group();
  group.name = `DemoApproach_${frame.markerId}`;

  for (const z of [-1.6, 1.6]) {
    const column = createSightlineColumn(0xd8cfbe, 5.2);
    column.position.set(0, 0, z);
    group.add(column);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.34, 3.9),
    new THREE.MeshStandardMaterial({
      color: 0xcbbfa7,
      roughness: 0.62,
      metalness: 0.04,
    }),
  );
  lintel.position.set(0, 5.1, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const banner = createBannerCloth(frame.bannerColor, 1.35, 2.45);
  banner.position.set(0.2, 3.2, 0);
  banner.rotation.y = Math.PI / 2;
  banner.userData.baseRotationZ = THREE.MathUtils.degToRad(5);
  group.add(banner);

  const label = createLabelSprite(
    frame.title,
    frame.accent,
    frame.labelScale ?? { x: 8.8, y: 2.7 },
  );
  label.position.set(0, frame.labelHeight ?? 6.25, 0);
  group.add(label);

  const leftBrazier = createBrazier(frame.accent, frame.glow);
  leftBrazier.group.position.set(0.95, 0, -2.3);
  group.add(leftBrazier.group);

  const rightBrazier = createBrazier(frame.accent, frame.glow);
  rightBrazier.group.position.set(-0.95, 0, 2.3);
  group.add(rightBrazier.group);

  group.position.copy(frame.anchor);
  group.position.y = sampleGroundY(terrain, frame.anchor) + 0.05;
  if (frame.facingTarget) {
    group.lookAt(
      frame.facingTarget.x,
      group.position.y + 1.5,
      frame.facingTarget.z,
    );
  }
  markNoCollision(group);
  group.userData.frameLabel = label;
  group.userData.frameBanner = banner;
  group.userData.extraFlames = [leftBrazier.flame, rightBrazier.flame];
  group.userData.routeMarkerId = frame.markerId;
  return group;
}

function createBaseMarker(marker) {
  const group = new THREE.Group();
  group.name = `DemoMarker_${marker.id}`;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.55, 0.65, 18),
    new THREE.MeshStandardMaterial({
      color: 0xa79a84,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  base.position.y = 0.325;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);



  const label = createLabelSprite(marker.label, marker.accent, marker.labelScale);
  label.position.set(0, marker.labelHeight ?? 5.8, 0);
  group.add(label);

  const focusLight = new THREE.PointLight(
    marker.glow,
    0.9,
    marker.focusLightDistance ?? 16,
    2,
  );
  focusLight.position.set(0, marker.focusLightHeight ?? 3.4, 0);
  group.add(focusLight);

  const arrivalHalo = createArrivalHalo(marker);
  group.add(arrivalHalo.light);

  group.userData = group.userData || {};
  group.userData.label = label;
  group.userData.focusLight = focusLight;
  group.userData.arrivalLight = arrivalHalo.light;
  return group;
}

function addHarborDetails(group, marker) {
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 5.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x7c664f, roughness: 0.76 }),
  );
  mast.position.y = 3.0;
  mast.castShadow = true;
  group.add(mast);

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 2.9),
    new THREE.MeshStandardMaterial({
      color: marker.accent,
      side: THREE.DoubleSide,
      roughness: 0.62,
    }),
  );
  sail.position.set(0.95, 3.2, 0);
  sail.rotation.y = Math.PI / 2;
  sail.castShadow = true;
  group.add(sail);

  const counterSail = sail.clone();
  counterSail.position.x = -0.95;
  counterSail.rotation.y = -Math.PI / 2;
  group.add(counterSail);

  const dockCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.14, 1.8),
    new THREE.MeshStandardMaterial({
      color: 0xe2d4b0,
      roughness: 0.7,
      metalness: 0.04,
    }),
  );
  dockCanopy.position.set(0, 1.8, -1.6);
  dockCanopy.castShadow = true;
  group.add(dockCanopy);

  for (const offset of [
    [-1.6, 0, 1.5],
    [1.4, 0, 1.3],
    [-0.5, 0.32, 1.85],
  ]) {
    const crate = createCrate(0x8f6f4c, offset[1] > 0 ? 0.72 : 0.9);
    crate.position.set(offset[0], 0.32 + offset[1], offset[2]);
    crate.rotation.y = Math.random() * Math.PI * 2;
    group.add(crate);
  }

  const palmTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 3.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x7b6549, roughness: 0.82 }),
  );
  palmTrunk.position.set(2.3, 1.6, -1.6);
  palmTrunk.castShadow = true;
  group.add(palmTrunk);

  for (let i = 0; i < 5; i++) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 1.35, 6, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x4f7e52, roughness: 0.74 }),
    );
    frond.position.set(2.3, 3.4, -1.6);
    frond.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-20, 14));
    frond.rotation.y = (i / 5) * Math.PI * 2;
    frond.castShadow = true;
    group.add(frond);
  }
}

function addAgoraDetails(group, marker) {
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.09, 3.2, 10);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x8c775f, roughness: 0.8 });
  const awningMaterial = new THREE.MeshStandardMaterial({
    color: marker.accent,
    side: THREE.DoubleSide,
    roughness: 0.58,
  });

  for (const x of [-1.35, 1.35]) {
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 1.8, 0);
    pole.castShadow = true;
    group.add(pole);
  }

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.16, 1.7),
    awningMaterial,
  );
  canopy.position.y = 3.3;
  canopy.castShadow = true;
  group.add(canopy);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.8),
    awningMaterial,
  );
  banner.position.set(0, 2.35, -0.92);
  banner.castShadow = true;
  group.add(banner);

  const sideBannerLeft = createBannerCloth(0xc66f2c, 0.9, 1.5);
  sideBannerLeft.position.set(-1.55, 2.2, 0.75);
  sideBannerLeft.rotation.y = Math.PI / 10;
  group.add(sideBannerLeft);

  const sideBannerRight = createBannerCloth(0xb8442f, 0.9, 1.5);
  sideBannerRight.position.set(1.55, 2.2, 0.75);
  sideBannerRight.rotation.y = -Math.PI / 10;
  group.add(sideBannerRight);

  const amphoraA = createAmphora(0xbe7d57);
  amphoraA.position.set(-1.3, 0.04, 1.35);
  group.add(amphoraA);

  const amphoraB = createAmphora(0xd19a6d);
  amphoraB.position.set(1.05, 0.04, 1.28);
  amphoraB.rotation.y = 0.45;
  group.add(amphoraB);

  const marketBench = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.18, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x8c6945, roughness: 0.8, metalness: 0.04 }),
  );
  marketBench.position.set(0, 0.86, 1.45);
  marketBench.castShadow = true;
  group.add(marketBench);

  const sightlineFrame = new THREE.Group();
  sightlineFrame.name = "AgoraSightlineFrame";
  sightlineFrame.position.set(3.8, 0, -0.2);

  for (const z of [-1.55, 1.55]) {
    const column = createSightlineColumn(0xd7cfbe, 4.9);
    column.position.z = z;
    sightlineFrame.add(column);
  }

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.3, 3.65),
    new THREE.MeshStandardMaterial({
      color: 0xc9bda5,
      roughness: 0.58,
      metalness: 0.04,
    }),
  );
  lintel.position.set(0, 4.82, 0);
  lintel.castShadow = true;
  sightlineFrame.add(lintel);

  const routeBanner = createBannerCloth(0x2b86a8, 1.2, 2.4);
  routeBanner.position.set(0.18, 3.2, 0);
  routeBanner.rotation.y = Math.PI / 2;
  routeBanner.userData.baseRotationZ = THREE.MathUtils.degToRad(4);
  sightlineFrame.add(routeBanner);

  const routeTorch = createBrazier(0x50778e, 0x82d7f4);
  routeTorch.group.position.set(0.9, 0, -2.35);
  sightlineFrame.add(routeTorch.group);

  const acropolisTorch = createBrazier(0x8f6d4f, 0xffe7b0);
  acropolisTorch.group.position.set(-0.9, 0, 2.35);
  sightlineFrame.add(acropolisTorch.group);

  group.userData.extraFlames = [
    ...(group.userData.extraFlames ?? []),
    routeTorch.flame,
    acropolisTorch.flame,
  ];
  group.add(sightlineFrame);
}

function addAcropolisDetails(group, marker) {
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.34, 4.3, 16),
    new THREE.MeshStandardMaterial({
      color: 0xded7c7,
      roughness: 0.46,
      metalness: 0.04,
    }),
  );
  column.position.y = 2.5;
  column.castShadow = true;
  group.add(column);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.72, 0.45, 16),
    new THREE.MeshStandardMaterial({
      color: 0x8b745d,
      roughness: 0.58,
      metalness: 0.08,
    }),
  );
  bowl.position.y = 4.8;
  bowl.castShadow = true;
  group.add(bowl);

  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 18, 18),
    new THREE.MeshStandardMaterial({
      color: marker.glow,
      emissive: marker.glow,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.0,
    }),
  );
  flame.position.y = 5.1;
  group.add(flame);
  group.userData.flame = flame;

  for (const x of [-1.9, 1.9]) {
    const sideColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.19, 2.8, 14),
      new THREE.MeshStandardMaterial({
        color: 0xd8d0bf,
        roughness: 0.5,
        metalness: 0.03,
      }),
    );
    sideColumn.position.set(x, 1.55, 0.2);
    sideColumn.castShadow = true;
    group.add(sideColumn);
  }

  const leftBrazier = createBrazier(0x8f6d4f, marker.glow);
  leftBrazier.group.position.set(-2.5, 0, 1.4);
  group.add(leftBrazier.group);

  const rightBrazier = createBrazier(0x8f6d4f, marker.glow);
  rightBrazier.group.position.set(2.5, 0, 1.4);
  group.add(rightBrazier.group);

  group.userData.extraFlames = [leftBrazier.flame, rightBrazier.flame];
}

function createDistrictMarker(marker, terrain) {
  const group = createBaseMarker(marker);

  if (marker.theme === "harbor") {
    addHarborDetails(group, marker);
  } else if (marker.theme === "agora") {
    addAgoraDetails(group, marker);
  } else {
    addAcropolisDetails(group, marker);
  }

  group.position.copy(marker.anchor);
  group.position.y = sampleGroundY(terrain, marker.anchor) + 0.05;
  markNoCollision(group);
  return group;
}

export function createDemoTour(scene, { terrain, questManager } = {}) {
  const group = new THREE.Group();
  group.name = "DemoTour";

  const markers = new Map();
  for (const marker of DISTRICT_MARKERS) {
    const object = createDistrictMarker(marker, terrain);
    group.add(object);
    markers.set(marker.id, object);
  }

  const guidePosts = [];
  for (const route of ROUTE_GUIDES) {
    route.positions.forEach((_, index) => {
      const guide = createRouteGuide(route, index, terrain);
      guide.visible = false;
      group.add(guide);
      guidePosts.push(guide);
    });
  }

  const approachFrames = [];
  for (const frame of APPROACH_FRAMES) {
    const frameObject = createApproachFrame(frame, terrain);
    frameObject.visible = false;
    group.add(frameObject);
    approachFrames.push(frameObject);
  }

  scene.add(group);

  let currentStageIndex = 0;
  let completed = false;

  const triggerArrivalPulse = (markerId, elapsed = 0) => {
    const object = markers.get(markerId);
    if (!object) return;
    object.userData.arrivalStartedAt = elapsed;
    object.userData.arrivalUntil = elapsed + ARRIVAL_PULSE_DURATION;
  };

  const setQuestObjective = (objective) => {
    if (!questManager) return;
    if (questManager.currentQuest?.status === "In Progress") {
      questManager.updateObjective(objective);
    } else {
      questManager.startQuest("A Short Walk Through Athens", objective);
    }
  };

  const setActiveMarker = () => {
    const activeStage = TOUR_STAGES[currentStageIndex];
    for (const marker of DISTRICT_MARKERS) {
      const object = markers.get(marker.id);
      if (!object) continue;

      const isActive = activeStage?.markerId === marker.id;
      const ring = object.userData?.ring;
      const label = object.userData?.label;
      const flame = object.userData?.flame;
      const focusLight = object.userData?.focusLight;

      object.userData.active = isActive;
      object.scale.setScalar(isActive ? 1.06 : 0.96);

      if (ring?.material) {
        ring.material.emissiveIntensity = isActive ? 1.15 : 0.35;
      }
      if (label?.material) {
        label.material.opacity = isActive ? 1 : 0.82;
      }
      if (flame?.material) {
        flame.material.emissiveIntensity = isActive ? 1.05 : 0.52;
      }
      if (focusLight) {
        focusLight.intensity = isActive ? 1.45 : 0.62;
        focusLight.distance = isActive ? 20 : 13;
      }
    }

    const activeRouteMarkerId = activeStage?.markerId ?? null;
    for (const guide of guidePosts) {
      const isActive = guide.userData?.routeMarkerId === activeRouteMarkerId;
      guide.visible = isActive;
      const guideLight = guide.userData?.guideLight;
      if (guideLight) {
        guideLight.intensity = isActive ? 0.95 : 0;
      }
    }

    for (const frame of approachFrames) {
      frame.visible = frame.userData?.routeMarkerId === activeRouteMarkerId;
    }
  };

  setQuestObjective(TOUR_STAGES[0].objective);
  setActiveMarker();

  return {
    group,
    update(playerPosition, elapsed = 0) {
      for (const marker of DISTRICT_MARKERS) {
        const object = markers.get(marker.id);
        if (!object) continue;
        const ring = object.userData?.ring;
        if (ring) {
          ring.rotation.z = elapsed * 0.45;
          ring.position.y = 1.3 + Math.sin(elapsed * 1.8 + object.position.x * 0.01) * 0.08;
        }
        const label = object.userData?.label;
        if (label) {
          const labelBaseY = DISTRICT_MARKERS.find((entry) => entry.id === marker.id)?.labelHeight ?? 5.8;
          label.position.y = labelBaseY + Math.sin(elapsed * 1.4 + object.position.z * 0.02) * 0.12;
        }
        const arrivalRing = object.userData?.arrivalRing;
        const arrivalLight = object.userData?.arrivalLight;
        const arrivalUntil = object.userData?.arrivalUntil ?? 0;
        const arrivalStartedAt = object.userData?.arrivalStartedAt ?? 0;
        if (arrivalRing?.material && arrivalLight) {
          const remaining = arrivalUntil - elapsed;
          if (remaining > 0) {
            const pulseProgress = THREE.MathUtils.clamp(
              (elapsed - arrivalStartedAt) / ARRIVAL_PULSE_DURATION,
              0,
              1,
            );
            const envelope = Math.sin(pulseProgress * Math.PI);
            const ripple = 0.82 + Math.sin(elapsed * 7.5 + object.position.x * 0.015) * 0.18;
            const intensity = Math.max(0, envelope * ripple);
            arrivalRing.visible = true;
            arrivalRing.material.opacity = 0.16 + intensity * 0.26;
            arrivalRing.material.emissiveIntensity = 0.45 + intensity * 1.25;
            arrivalRing.scale.setScalar(1 + pulseProgress * 1.85);
            arrivalLight.intensity = 0.35 + intensity * 1.8;
          } else {
            arrivalRing.visible = false;
            arrivalRing.material.opacity = 0;
            arrivalLight.intensity = 0;
            arrivalRing.scale.setScalar(1);
          }
        }
        if (object.userData?.flame) {
          object.userData.flame.scale.setScalar(0.92 + Math.sin(elapsed * 5.5) * 0.08);
        }
        if (Array.isArray(object.userData?.extraFlames)) {
          object.userData.extraFlames.forEach((extraFlame, index) => {
            extraFlame.scale.setScalar(
              0.88 + Math.sin(elapsed * (4.7 + index * 0.4) + index) * 0.09,
            );
          });
        }
        object.traverse((child) => {
          const sway = child.userData?.swayAmount;
          if (!sway) return;
          const speed = child.userData?.swaySpeed ?? 1;
          const baseRotationZ = child.userData?.baseRotationZ ?? 0;
          child.rotation.z =
            baseRotationZ +
            Math.sin(elapsed * speed + object.position.x * 0.01) * sway;
        });
      }

      for (const guide of guidePosts) {
        if (!guide.visible) continue;
        const guideLight = guide.userData?.guideLight;
        const guideFlame = guide.userData?.guideFlame;
        if (guideFlame) {
          guideFlame.scale.setScalar(0.92 + Math.sin(elapsed * 5.2 + guide.position.x * 0.01) * 0.09);
        }
        if (guideLight) {
          guideLight.intensity = 0.76 + Math.sin(elapsed * 4.1 + guide.position.z * 0.02) * 0.18;
        }
      }

      for (const frame of approachFrames) {
        if (!frame.visible) continue;
        const label = frame.userData?.frameLabel;
        if (label) {
          label.position.y = 6.25 + Math.sin(elapsed * 1.25 + frame.position.x * 0.01) * 0.1;
        }
        const banner = frame.userData?.frameBanner;
        if (banner?.userData?.swayAmount) {
          const speed = banner.userData?.swaySpeed ?? 1;
          const baseRotationZ = banner.userData?.baseRotationZ ?? 0;
          banner.rotation.z = baseRotationZ + Math.sin(elapsed * speed + frame.position.z * 0.01) * banner.userData.swayAmount;
        }
        if (Array.isArray(frame.userData?.extraFlames)) {
          frame.userData.extraFlames.forEach((extraFlame, index) => {
            extraFlame.scale.setScalar(
              0.88 + Math.sin(elapsed * (4.3 + index * 0.5) + index) * 0.08,
            );
          });
        }
      }

      if (!playerPosition || completed) {
        return;
      }

      const stage = TOUR_STAGES[currentStageIndex];
      if (!stage) {
        return;
      }

      const marker = DISTRICT_MARKERS.find((entry) => entry.id === stage.markerId);
      if (!marker) {
        return;
      }

      const target = markers.get(marker.id);
      if (!target) {
        return;
      }

      const horizontalDistance = Math.hypot(
        playerPosition.x - target.position.x,
        playerPosition.z - target.position.z,
      );

      if (horizontalDistance > stage.radius) {
        return;
      }

      triggerArrivalPulse(marker.id, elapsed);
      currentStageIndex += 1;
      if (currentStageIndex >= TOUR_STAGES.length) {
        completed = true;
        questManager?.completeQuest?.();
        setActiveMarker();
        return;
      }

      setQuestObjective(stage.completion);
      setActiveMarker();
    },
  };
}

export default createDemoTour;
