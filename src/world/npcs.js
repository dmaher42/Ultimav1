import * as THREE from 'three';
import { Character } from '../characters/Character.js';
import { resolveBaseUrl, joinPath } from '../utils/baseUrl.js';
import { loadSafeTexture } from '../utils/TextureUtils.js';
import { applyForegroundFogPolicy } from '../utils/materialUtils.js';

function sanitizeRelativePath(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    // strip leading slashes FIRST so repo-folder stripping matches
    .replace(/^\/+/, '')
    .replace(/^public\//i, '')
    .replace(/^docs\//i, '')
    .replace(/^athens-game-starter\//i, '')
    .replace(/^\.\//, '');
}

async function headOk(url) {
  if (!url) return false;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;
    const contentType = response.headers?.get?.('content-type') || '';
    return !contentType.toLowerCase().includes('text/html');
  } catch {
    return false;
  }
}

const manifestWarnings = new Set();
const npcWarnings = new Set();
const npcAvailability = new Map();
const DEFAULT_ROLE_SEQUENCE = ['merchant', 'scholar', 'guard', 'artisan', 'citizen', 'dockworker', 'priest'];
const SHARED_GEOMETRIES = {
  body: new THREE.CapsuleGeometry(0.35, 1.0, 8, 16),
  tunic: new THREE.CylinderGeometry(0.38, 0.42, 0.85, 12, 1, true), // Open-ended cylinder for cloth
  head: new THREE.SphereGeometry(0.28, 16, 16),
  arm: new THREE.CapsuleGeometry(0.1, 0.55, 6, 10),
  leg: new THREE.CapsuleGeometry(0.11, 0.62, 6, 10),
  foot: new THREE.BoxGeometry(0.16, 0.06, 0.28),
  belt: new THREE.TorusGeometry(0.32, 0.04, 8, 16),
  cloak: new THREE.BoxGeometry(0.62, 1.0, 0.05),
  apron: new THREE.BoxGeometry(0.36, 0.72, 0.03),
  headwrap: new THREE.TorusGeometry(0.22, 0.045, 8, 18),
  helmet: new THREE.SphereGeometry(0.3, 12, 12),
  cap: new THREE.CylinderGeometry(0.2, 0.24, 0.1, 12),
  basket: new THREE.CylinderGeometry(0.16, 0.22, 0.26, 12),
  scroll: new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10),
  spearShaft: new THREE.CylinderGeometry(0.024, 0.028, 1.9, 8),
  spearTip: new THREE.ConeGeometry(0.05, 0.16, 8),
  staff: new THREE.CylinderGeometry(0.026, 0.032, 1.6, 8),
  satchel: new THREE.BoxGeometry(0.22, 0.26, 0.1),
  toolHandle: new THREE.CylinderGeometry(0.022, 0.022, 0.4, 8),
  toolHead: new THREE.BoxGeometry(0.14, 0.05, 0.07),
  sash: new THREE.TorusGeometry(0.42, 0.06, 8, 18, Math.PI * 1.25),
  lowBody: new THREE.BoxGeometry(0.6, 1.2, 0.32),
  lowHead: new THREE.SphereGeometry(0.26, 12, 12),
  lowBase: new THREE.CylinderGeometry(0.26, 0.32, 0.16, 10),
};
const ROLE_MATERIALS = new Map();
const ROLE_PROFILES = {
  citizen: {
    id: 'citizen',
    label: 'Citizen',
    garmentColor: 0xcd9f72,
    trimColor: 0xf2ead8,
    accentColor: 0x8d5f3f,
    skinColor: 0xd6b087,
    accessory: 'sash',
    paceMultiplier: 0.96,
    scaleRange: [0.94, 1.05],
    moveAction: 'Walk',
    idleAction: 'Idle',
    stopChance: 0.16,
    stopDuration: [0.7, 1.8],
  },
  merchant: {
    id: 'merchant',
    label: 'Merchant',
    garmentColor: 0xc35d33,
    trimColor: 0xf6e5bf,
    accentColor: 0x7b4f2b,
    skinColor: 0xd8b690,
    accessory: 'basket',
    paceMultiplier: 0.9,
    scaleRange: [0.95, 1.06],
    moveAction: 'Walk',
    idleAction: 'Idle',
    stopChance: 0.24,
    stopDuration: [1.2, 2.8],
  },
  scholar: {
    id: 'scholar',
    label: 'Scholar',
    garmentColor: 0x4a68a8,
    trimColor: 0xf5efe3,
    accentColor: 0x324a77,
    skinColor: 0xd0ac83,
    accessory: 'scroll',
    paceMultiplier: 0.85,
    scaleRange: [0.92, 1.01],
    moveAction: 'Walk',
    idleAction: 'Idle',
    stopChance: 0.3,
    stopDuration: [1.4, 3.2],
  },
  guard: {
    id: 'guard',
    label: 'Guard',
    garmentColor: 0x5f4a33,
    trimColor: 0xd9ccb5,
    accentColor: 0x8d6a32,
    skinColor: 0xcda780,
    accessory: 'spear',
    paceMultiplier: 1.05,
    scaleRange: [1.0, 1.12],
    moveAction: 'Swagger',
    idleAction: 'Idle',
    stopChance: 0.14,
    stopDuration: [0.6, 1.5],
  },
  dockworker: {
    id: 'dockworker',
    label: 'Dockworker',
    garmentColor: 0x7e6653,
    trimColor: 0xe7d3b0,
    accentColor: 0x5a4636,
    skinColor: 0xc89d75,
    accessory: 'satchel',
    paceMultiplier: 1.12,
    scaleRange: [0.98, 1.1],
    moveAction: 'Walk',
    idleAction: 'Idle',
    stopChance: 0.18,
    stopDuration: [0.6, 1.6],
  },
  priest: {
    id: 'priest',
    label: 'Priest',
    garmentColor: 0xddd2bd,
    trimColor: 0xf7f1e4,
    accentColor: 0xb2905a,
    skinColor: 0xd2ae86,
    accessory: 'staff',
    paceMultiplier: 0.82,
    scaleRange: [0.96, 1.05],
    moveAction: 'Walk',
    idleAction: 'Idle',
    stopChance: 0.32,
    stopDuration: [1.6, 3.6],
  },
  artisan: {
    id: 'artisan',
    label: 'Artisan',
    garmentColor: 0x6b8a5e,
    trimColor: 0xefeadc,
    accentColor: 0x7f5632,
    skinColor: 0xcfab84,
    accessory: 'tool',
    paceMultiplier: 0.98,
    scaleRange: [0.95, 1.05],
    moveAction: 'Walk',
    idleAction: 'Idle',
    stopChance: 0.2,
    stopDuration: [0.8, 2.2],
  },
};

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function randomBetween(min, max, rng = Math.random) {
  return THREE.MathUtils.lerp(min, max, rng());
}

function createSeededRng(seed) {
  let state = Math.floor(seed * 1000) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function smoothAngle(current, target, alpha) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
}

function pickRoleProfile(roleId, index = 0, roles = DEFAULT_ROLE_SEQUENCE) {
  const roleKey =
    typeof roleId === 'string' && ROLE_PROFILES[roleId]
      ? roleId
      : roles[index % roles.length] ?? 'citizen';
  return ROLE_PROFILES[roleKey] ?? ROLE_PROFILES.citizen;
}

function inferRoleFromFileName(fileName, fallbackIndex = 0, roles = DEFAULT_ROLE_SEQUENCE) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.includes('guard') || lower.includes('soldier')) return 'guard';
  if (lower.includes('dock') || lower.includes('porter') || lower.includes('worker')) return 'dockworker';
  if (lower.includes('priest') || lower.includes('oracle')) return 'priest';
  if (lower.includes('merchant') || lower.includes('vendor') || lower.includes('seller')) return 'merchant';
  if (lower.includes('scribe') || lower.includes('scholar') || lower.includes('philos')) return 'scholar';
  if (lower.includes('artisan') || lower.includes('smith') || lower.includes('maker')) return 'artisan';
  return roles[fallbackIndex % roles.length] ?? 'citizen';
}

function createRoleAccessory(roleProfile, rng, accentMaterial, trimMaterial) {
  const accessoryRoot = new THREE.Group();
  accessoryRoot.name = `${roleProfile.label}Accessory`;

  if (roleProfile.accessory === 'basket') {
    const basket = new THREE.Mesh(
      SHARED_GEOMETRIES.basket,
      accentMaterial,
    );
    basket.position.set(0.34, 0.84, 0.12);
    accessoryRoot.add(basket);
  } else if (roleProfile.accessory === 'scroll') {
    const scroll = new THREE.Mesh(
      SHARED_GEOMETRIES.scroll,
      trimMaterial,
    );
    scroll.rotation.z = Math.PI / 2;
    scroll.position.set(-0.34, 1.08, 0.18);
    accessoryRoot.add(scroll);
  } else if (roleProfile.accessory === 'spear') {
    const shaft = new THREE.Mesh(
      SHARED_GEOMETRIES.spearShaft,
      accentMaterial,
    );
    shaft.position.set(0.42, 1.12, 0.02);
    accessoryRoot.add(shaft);
    const tip = new THREE.Mesh(
      SHARED_GEOMETRIES.spearTip,
      trimMaterial,
    );
    tip.position.set(0.42, 2.02, 0.02);
    accessoryRoot.add(tip);
  } else if (roleProfile.accessory === 'staff') {
    const staff = new THREE.Mesh(
      SHARED_GEOMETRIES.staff,
      accentMaterial,
    );
    staff.position.set(-0.34, 1.02, 0.05);
    accessoryRoot.add(staff);
  } else if (roleProfile.accessory === 'satchel') {
    const satchel = new THREE.Mesh(
      SHARED_GEOMETRIES.satchel,
      accentMaterial,
    );
    satchel.position.set(-0.28, 0.96, 0.22);
    satchel.rotation.z = -0.2;
    accessoryRoot.add(satchel);
  } else if (roleProfile.accessory === 'tool') {
    const handle = new THREE.Mesh(
      SHARED_GEOMETRIES.toolHandle,
      accentMaterial,
    );
    handle.position.set(0.36, 0.88, 0.08);
    handle.rotation.z = 0.55;
    accessoryRoot.add(handle);
    const head = new THREE.Mesh(
      SHARED_GEOMETRIES.toolHead,
      trimMaterial,
    );
    head.position.set(0.45, 1.0, 0.08);
    head.rotation.z = 0.55;
    accessoryRoot.add(head);
  } else {
    const sash = new THREE.Mesh(
      SHARED_GEOMETRIES.sash,
      trimMaterial,
    );
    sash.rotation.set(Math.PI / 2, Math.PI / 3 + randomBetween(-0.08, 0.08, rng), 0);
    sash.position.y = 1.3;
    accessoryRoot.add(sash);
  }

  accessoryRoot.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.noCollision = true;
  });

  return accessoryRoot;
}

function buildAccessoryParts(roleProfile, rng) {
  if (roleProfile.accessory === 'basket') {
    return [
      {
        partKey: 'basket',
        geometry: SHARED_GEOMETRIES.basket,
        materialKey: 'accent',
        position: new THREE.Vector3(0.34, 0.84, 0.12),
        rotation: new THREE.Euler(0, 0, 0),
      },
    ];
  }
  if (roleProfile.accessory === 'scroll') {
    return [
      {
        partKey: 'scroll',
        geometry: SHARED_GEOMETRIES.scroll,
        materialKey: 'trim',
        position: new THREE.Vector3(-0.34, 1.08, 0.18),
        rotation: new THREE.Euler(0, 0, Math.PI / 2),
      },
    ];
  }
  if (roleProfile.accessory === 'spear') {
    return [
      {
        partKey: 'spearShaft',
        geometry: SHARED_GEOMETRIES.spearShaft,
        materialKey: 'accent',
        position: new THREE.Vector3(0.42, 1.12, 0.02),
        rotation: new THREE.Euler(0, 0, 0),
      },
      {
        partKey: 'spearTip',
        geometry: SHARED_GEOMETRIES.spearTip,
        materialKey: 'trim',
        position: new THREE.Vector3(0.42, 2.02, 0.02),
        rotation: new THREE.Euler(0, 0, 0),
      },
    ];
  }
  if (roleProfile.accessory === 'staff') {
    return [
      {
        partKey: 'staff',
        geometry: SHARED_GEOMETRIES.staff,
        materialKey: 'accent',
        position: new THREE.Vector3(-0.34, 1.02, 0.05),
        rotation: new THREE.Euler(0, 0, 0),
      },
    ];
  }
  if (roleProfile.accessory === 'satchel') {
    return [
      {
        partKey: 'satchel',
        geometry: SHARED_GEOMETRIES.satchel,
        materialKey: 'accent',
        position: new THREE.Vector3(-0.28, 0.96, 0.22),
        rotation: new THREE.Euler(0, 0, -0.2),
      },
    ];
  }
  if (roleProfile.accessory === 'tool') {
    return [
      {
        partKey: 'toolHandle',
        geometry: SHARED_GEOMETRIES.toolHandle,
        materialKey: 'accent',
        position: new THREE.Vector3(0.36, 0.88, 0.08),
        rotation: new THREE.Euler(0, 0, 0.55),
      },
      {
        partKey: 'toolHead',
        geometry: SHARED_GEOMETRIES.toolHead,
        materialKey: 'trim',
        position: new THREE.Vector3(0.45, 1.0, 0.08),
        rotation: new THREE.Euler(0, 0, 0.55),
      },
    ];
  }

  return [
    {
      partKey: 'sash',
      geometry: SHARED_GEOMETRIES.sash,
      materialKey: 'trim',
      position: new THREE.Vector3(0, 1.3, 0),
      rotation: new THREE.Euler(Math.PI / 2, Math.PI / 3 + randomBetween(-0.08, 0.08, rng), 0),
    },
  ];
}

function getRoleMaterials(roleProfile) {
  const cached = ROLE_MATERIALS.get(roleProfile.id);
  if (cached) return cached;

  const garmentTex = loadSafeTexture('textures/plaster_rough.jpg', {
    repeat: [8, 8],
    isColor: true
  });

  const materials = {
    garmentMaterial: new THREE.MeshStandardMaterial({
      color: roleProfile.garmentColor,
      map: garmentTex,
      roughness: 0.92,
      metalness: roleProfile.id === 'guard' ? 0.04 : 0.01,
      fog: true,
    }),
    skinMaterial: new THREE.MeshStandardMaterial({
      color: roleProfile.skinColor,
      roughness: 0.75,
      metalness: 0.0,
      fog: true,
    }),
    trimMaterial: new THREE.MeshStandardMaterial({
      color: roleProfile.trimColor,
      roughness: 0.82,
      metalness: 0.02,
      fog: true,
    }),
    accentMaterial: new THREE.MeshStandardMaterial({
      color: roleProfile.accentColor,
      roughness: 0.88,
      metalness: roleProfile.id === 'guard' ? 0.12 : 0.04,
      fog: true,
    }),
  };

  ROLE_MATERIALS.set(roleProfile.id, materials);
  return materials;
}

function tuneMaterialPresentation(material, roleProfile, rng) {
  if (!material || material.userData?.npcPresentationApplied) return material;
  material.userData = material.userData || {};

  if (material.color?.isColor) {
    const hsl = { h: 0, s: 0, l: 0 };
    material.color.getHSL(hsl);
    hsl.h = (hsl.h + randomBetween(-0.015, 0.015, rng) + 1) % 1;
    hsl.s = clamp01(hsl.s * randomBetween(0.92, 1.08, rng));
    hsl.l = clamp01(hsl.l * randomBetween(0.94, 1.04, rng));
    material.color.setHSL(hsl.h, hsl.s, hsl.l);
  }

  if (typeof material.roughness === 'number') {
    material.roughness = Math.max(material.roughness, 0.68);
  }
  if (typeof material.metalness === 'number') {
    material.metalness = Math.min(material.metalness, roleProfile.id === 'guard' ? 0.18 : 0.08);
  }
  if (typeof material.envMapIntensity === 'number') {
    material.envMapIntensity = Math.min(material.envMapIntensity, roleProfile.id === 'guard' ? 0.18 : 0.1);
  }

  material.userData.npcPresentationApplied = true;
  material.needsUpdate = true;
  return material;
}

function createCitizenModel(roleProfile, rng = Math.random, instancingContext = null) {
  const group = new THREE.Group();
  group.name = `${roleProfile.label}NPC`;
  const highGroup = new THREE.Group();
  highGroup.name = `${roleProfile.label}High`;
  group.add(highGroup);
  const lowGroup = new THREE.Group();
  lowGroup.name = `${roleProfile.label}Low`;
  lowGroup.visible = false;
  group.add(lowGroup);

  const { garmentMaterial, skinMaterial, trimMaterial, accentMaterial } =
    getRoleMaterials(roleProfile);

  let accessoryInstances = [];

  const body = new THREE.Mesh(SHARED_GEOMETRIES.body, skinMaterial);
  body.position.y = 1.08;
  highGroup.add(body);

  const tunic = new THREE.Mesh(SHARED_GEOMETRIES.tunic, garmentMaterial);
  tunic.position.y = 1.0;
  highGroup.add(tunic);

  const head = new THREE.Mesh(SHARED_GEOMETRIES.head, skinMaterial);
  head.position.y = 2.02;
  highGroup.add(head);

  const leftArm = new THREE.Mesh(SHARED_GEOMETRIES.arm, skinMaterial);
  leftArm.position.set(-0.48, 1.35, 0);
  leftArm.rotation.z = 0.12;
  highGroup.add(leftArm);

  const rightArm = new THREE.Mesh(SHARED_GEOMETRIES.arm, skinMaterial);
  rightArm.position.set(0.48, 1.35, 0);
  rightArm.rotation.z = -0.12;
  highGroup.add(rightArm);

  const leftLeg = new THREE.Mesh(SHARED_GEOMETRIES.leg, garmentMaterial);
  leftLeg.position.set(-0.18, 0.42, 0);
  highGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(SHARED_GEOMETRIES.leg, garmentMaterial);
  rightLeg.position.set(0.18, 0.42, 0);
  highGroup.add(rightLeg);

  const leftFoot = new THREE.Mesh(
    SHARED_GEOMETRIES.foot,
    accentMaterial,
  );
  leftFoot.position.set(-0.18, 0.05, 0.08);
  highGroup.add(leftFoot);

  const rightFoot = new THREE.Mesh(
    SHARED_GEOMETRIES.foot,
    accentMaterial,
  );
  rightFoot.position.set(0.18, 0.05, 0.08);
  highGroup.add(rightFoot);

  const belt = new THREE.Mesh(
    SHARED_GEOMETRIES.belt,
    accentMaterial,
  );
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.0;
  highGroup.add(belt);

  if (roleProfile.id === 'guard' || roleProfile.id === 'priest') {
    const cloak = new THREE.Mesh(
      SHARED_GEOMETRIES.cloak,
      garmentMaterial,
    );
    cloak.position.set(0, 1.18, -0.2);
    highGroup.add(cloak);
  } else if (roleProfile.id === 'merchant' || roleProfile.id === 'artisan') {
    const apron = new THREE.Mesh(
      SHARED_GEOMETRIES.apron,
      trimMaterial,
    );
    apron.position.set(0, 0.94, 0.26);
    highGroup.add(apron);
  }

  if (roleProfile.id === 'priest') {
    const headwrap = new THREE.Mesh(
      SHARED_GEOMETRIES.headwrap,
      trimMaterial,
    );
    headwrap.rotation.x = Math.PI / 2;
    headwrap.position.y = 2.08;
    highGroup.add(headwrap);
  } else if (roleProfile.id === 'guard') {
    const helmet = new THREE.Mesh(
      SHARED_GEOMETRIES.helmet,
      accentMaterial,
    );
    helmet.scale.y = 0.7;
    helmet.position.y = 2.05;
    highGroup.add(helmet);
  } else if (roleProfile.id === 'scholar') {
    const cap = new THREE.Mesh(
      SHARED_GEOMETRIES.cap,
      trimMaterial,
    );
    cap.position.y = 2.08;
    highGroup.add(cap);
  }

  let accessory = null;
  if (instancingContext?.accessoryBatches) {
    const parts = buildAccessoryParts(roleProfile, rng);
    const materialMap = {
      accent: accentMaterial,
      trim: trimMaterial,
      garment: garmentMaterial,
      skin: skinMaterial,
    };

    parts.forEach((part) => {
      const material = materialMap[part.materialKey] ?? accentMaterial;
      const batch = instancingContext.getBatch(
        roleProfile.id,
        part.partKey,
        part.geometry,
        material
      );
      if (!batch) return;
      const index = batch.nextIndex;
      batch.nextIndex += 1;
      accessoryInstances.push({
        mesh: batch.mesh,
        index,
        basePosition: part.position.clone(),
        baseRotation: part.rotation.clone(),
      });
    });
  } else {
    accessory = createRoleAccessory(roleProfile, rng, accentMaterial, trimMaterial);
    highGroup.add(accessory);
  }

  const lowBody = new THREE.Mesh(SHARED_GEOMETRIES.lowBody, garmentMaterial);
  lowBody.position.y = 1.0;
  lowGroup.add(lowBody);
  const lowHead = new THREE.Mesh(SHARED_GEOMETRIES.lowHead, skinMaterial);
  lowHead.position.y = 1.82;
  lowGroup.add(lowHead);
  const lowBase = new THREE.Mesh(SHARED_GEOMETRIES.lowBase, accentMaterial);
  lowBase.position.y = 0.12;
  lowGroup.add(lowBase);

  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.noCollision = true;
  });

  applyForegroundFogPolicy(group);

  return {
    group,
    highGroup,
    lowGroup,
    body,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftFoot,
    rightFoot,
    accessory,
    accessoryInstances,
  };
}

function createCurveLengthLookup(curve) {
  const divisions = 100;
  const lengths = curve.getLengths(divisions);
  const totalLength = lengths[lengths.length - 1];
  return { divisions, lengths, totalLength };
}

export function spawnCitizenCrowd(scene, pathCurve, options = {}) {
  if (!pathCurve) {
    return { citizens: [], updaters: [] };
  }

  const count = options.count ?? 6;
  const minSpeed = options.minSpeed ?? 0.6;
  const maxSpeed = options.maxSpeed ?? 1.2;
  const terrain = options.terrain ?? null;
  const camera = options.camera ?? null;
  const instancedAccessories = options.instancedAccessories !== false;
  const lodDistance = options.lodDistance ?? 70;
  const lodHysteresis = options.lodHysteresis ?? 6;
  const lodDistanceIn = Math.max(5, lodDistance - lodHysteresis);
  const lodDistanceOut = lodDistance + lodHysteresis;
  const lodDistanceInSq = lodDistanceIn * lodDistanceIn;
  const lodDistanceOutSq = lodDistanceOut * lodDistanceOut;
  const farUpdateDistance = options.farUpdateDistance ?? 140;
  const farUpdateStride = options.farUpdateStride ?? 2;
  const farUpdateDistanceSq = farUpdateDistance * farUpdateDistance;
  const roles = Array.isArray(options.roles) && options.roles.length > 0
    ? options.roles
    : DEFAULT_ROLE_SEQUENCE;

  const { totalLength } = createCurveLengthLookup(pathCurve);
  const getHeightAt = terrain?.userData?.getHeightAt?.bind(terrain?.userData);

  const citizens = [];
  const updaters = [];
  const accessoryBatches = instancedAccessories ? new Map() : null;
  const getAccessoryBatch = instancedAccessories
    ? (roleId, partKey, geometry, material) => {
        const key = `${roleId}:${partKey}`;
        const existing = accessoryBatches.get(key);
        if (existing) return existing;
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.noCollision = true;
        scene.add(mesh);
        const batch = { mesh, nextIndex: 0 };
        accessoryBatches.set(key, batch);
        return batch;
      }
    : null;
  const instancingContext = instancedAccessories
    ? { accessoryBatches, getBatch: getAccessoryBatch }
    : null;
  const tempAccessoryObject = instancedAccessories ? new THREE.Object3D() : null;

  for (let i = 0; i < count; i++) {
    const rng = createSeededRng((i + 1) * 97.31);
    const roleProfile = pickRoleProfile(options.role, i, roles);
    const {
      group,
      highGroup,
      lowGroup,
      body,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      leftFoot,
      rightFoot,
      accessory,
      accessoryInstances,
    } =
      createCitizenModel(roleProfile, rng, instancingContext);
    const scale = randomBetween(roleProfile.scaleRange[0], roleProfile.scaleRange[1], rng);
    group.scale.setScalar(scale);
    group.userData.npcRole = roleProfile.id;
    group.userData.npcLabel = roleProfile.label;
    group.userData.noCollision = true;
    scene.add(group);
    citizens.push(group);

    const speed =
      THREE.MathUtils.lerp(minSpeed, maxSpeed, rng()) * roleProfile.paceMultiplier;
    let progress = (i / count + rng() * 0.1) % 1;
    let stepPhase = rng() * Math.PI * 2;
    const gaitScale = randomBetween(0.85, 1.18, rng);
    const swayScale = randomBetween(0.85, 1.15, rng);
    const armSwingScale = randomBetween(0.85, 1.2, rng);
    let moveTimeRemaining = randomBetween(2.8, 6.2, rng);
    let idleTimeRemaining = 0;
    let targetYaw = 0;
    let headYaw = 0;
    let headYawTarget = 0;
    let headYawTimer = randomBetween(0.6, 1.8, rng);
    let idleTurnYaw = 0;
    let idleTurnTarget = 0;
    let idleTurnTimer = randomBetween(1.4, 3.2, rng);
    let skipFrameCounter = 0;
    let usingHighDetail = true;

    const update = (dt) => {
      if (!Number.isFinite(dt)) return;
      const isIdle = idleTimeRemaining > 0;
      if (isIdle) {
        idleTimeRemaining = Math.max(0, idleTimeRemaining - dt);
        if (idleTimeRemaining === 0) {
          moveTimeRemaining = randomBetween(2.6, 6.4, rng);
        }
      } else {
        const distancePerSecond = speed;
        const deltaProgress = (distancePerSecond * dt) / totalLength;
        progress = (progress + deltaProgress) % 1;
        moveTimeRemaining -= dt;
        if (moveTimeRemaining <= 0 && rng() < roleProfile.stopChance) {
          idleTimeRemaining = randomBetween(
            roleProfile.stopDuration[0],
            roleProfile.stopDuration[1],
            rng,
          );
        }
      }

      const position = pathCurve.getPointAt(progress);
      const tangent = pathCurve.getTangentAt(progress);

      group.position.copy(position);

      // Snap NPC to terrain height (with safe fallback)
      const sampledY = getHeightAt ? getHeightAt(group.position.x, group.position.z) : position.y;
      group.position.y = Number.isFinite(sampledY) ? sampledY + 0.05 : position.y + 0.05;

      if (tangent) {
        targetYaw = Math.atan2(tangent.x, tangent.z);
      }
      group.rotation.y = smoothAngle(
        group.rotation.y,
        targetYaw,
        Math.min(1, dt * (isIdle ? 3.2 : 6.8)),
      );
      group.updateMatrixWorld(true);

      let distanceSq = null;
      if (camera) {
        const dx = group.position.x - camera.position.x;
        const dy = group.position.y - camera.position.y;
        const dz = group.position.z - camera.position.z;
        distanceSq = dx * dx + dy * dy + dz * dz;
        if (usingHighDetail && distanceSq > lodDistanceOutSq) {
          usingHighDetail = false;
          highGroup.visible = false;
          lowGroup.visible = true;
        } else if (!usingHighDetail && distanceSq < lodDistanceInSq) {
          usingHighDetail = true;
          highGroup.visible = true;
          lowGroup.visible = false;
        }
      }

      if (camera && farUpdateStride > 1) {
        const dx = group.position.x - camera.position.x;
        const dy = group.position.y - camera.position.y;
        const dz = group.position.z - camera.position.z;
        distanceSq = distanceSq ?? (dx * dx + dy * dy + dz * dz);
        if (distanceSq > farUpdateDistanceSq) {
          skipFrameCounter = (skipFrameCounter + 1) % farUpdateStride;
          if (skipFrameCounter !== 0) {
            return;
          }
        } else {
          skipFrameCounter = 0;
        }
      }

      stepPhase += dt * speed * (isIdle ? 1.8 : 6.4);
      const gait = Math.sin(stepPhase) * gaitScale;
      const sway = Math.cos(stepPhase * 0.5) * swayScale;
      if (isIdle) {
        headYawTimer -= dt;
        if (headYawTimer <= 0) {
          headYawTarget = randomBetween(-0.55, 0.55, rng);
          headYawTimer = randomBetween(0.9, 2.4, rng);
        }
        idleTurnTimer -= dt;
        if (idleTurnTimer <= 0) {
          idleTurnTarget = randomBetween(-0.28, 0.28, rng);
          idleTurnTimer = randomBetween(1.6, 3.6, rng);
        }
      } else {
        headYawTarget = 0;
        headYawTimer = Math.min(headYawTimer, randomBetween(0.6, 1.2, rng));
        idleTurnTarget = 0;
        idleTurnTimer = Math.min(idleTurnTimer, randomBetween(1.2, 2.2, rng));
      }
      headYaw = smoothAngle(headYaw, headYawTarget, Math.min(1, dt * 3.2));
      idleTurnYaw = smoothAngle(idleTurnYaw, idleTurnTarget, Math.min(1, dt * 2.4));
      body.position.y = 1.08 + (isIdle ? sway * 0.02 : gait * 0.06);
      body.rotation.z = isIdle ? sway * 0.05 : gait * 0.16;
      body.rotation.y = isIdle ? idleTurnYaw : 0;
      head.rotation.y = isIdle ? headYaw + Math.sin(stepPhase * 0.35) * 0.12 : headYaw * 0.35;
      leftArm.rotation.z = isIdle
        ? 0.08 + sway * 0.06
        : 0.16 + gait * 0.32 * armSwingScale;
      rightArm.rotation.z = isIdle
        ? -0.08 - sway * 0.06
        : -0.16 - gait * 0.32 * armSwingScale;
      leftLeg.rotation.x = isIdle ? 0 : gait * 0.45;
      rightLeg.rotation.x = isIdle ? 0 : -gait * 0.45;
      leftFoot.position.z = isIdle ? 0.08 : 0.08 + gait * 0.06;
      rightFoot.position.z = isIdle ? 0.08 : 0.08 - gait * 0.06;
      if (accessory) {
        accessory.rotation.y = isIdle ? Math.sin(stepPhase * 0.2) * 0.12 : 0;
        accessory.position.y = isIdle ? 0.01 : Math.sin(stepPhase * 2) * 0.02;
      }
      if (accessoryInstances && accessoryInstances.length && tempAccessoryObject) {
        const accessoryYaw = isIdle ? Math.sin(stepPhase * 0.2) * 0.12 : 0;
        const accessoryBob = isIdle ? 0.01 : Math.sin(stepPhase * 2) * 0.02;
        const accessoryScale = usingHighDetail ? 1 : 0;
        accessoryInstances.forEach((instance) => {
          tempAccessoryObject.position.copy(instance.basePosition);
          tempAccessoryObject.position.y += accessoryBob;
          tempAccessoryObject.rotation.copy(instance.baseRotation);
          tempAccessoryObject.rotation.y += accessoryYaw;
          tempAccessoryObject.scale.setScalar(accessoryScale);
          tempAccessoryObject.updateMatrix();
          tempAccessoryObject.matrix.premultiply(group.matrixWorld);
          instance.mesh.setMatrixAt(instance.index, tempAccessoryObject.matrix);
          instance.mesh.instanceMatrix.needsUpdate = true;
        });
      }
    };

    updaters.push(update);
  }

  return { citizens, updaters };
}

// NPC GLB manifest loader
export async function spawnGLBNPCs(scene, pathCurve, options = {}) {
  if (!scene || !pathCurve) {
    return { npcs: [], updaters: [] };
  }

  const baseUrl = resolveBaseUrl();
  const manifestUrl = joinPath(baseUrl, 'models/npcs/manifest.json');

  let manifest = null;
  try {
    const response = await fetch(manifestUrl, { method: 'GET', cache: 'no-cache' });
    if (!response.ok) {
      warnOnce(
        manifestWarnings,
        'missing-manifest',
        '[NPC Manifest] Missing models/npcs/manifest.json; skipping GLB NPCs.'
      );
      return { npcs: [], updaters: [] };
    }
    manifest = await response.json();
  } catch (error) {
    const statusMessage = error?.message || error;
    warnOnce(
      manifestWarnings,
      'manifest-error',
      `[NPC Manifest] Failed to load ${manifestUrl}: ${statusMessage}`
    );
    return { npcs: [], updaters: [] };
  }

  const entries = Array.isArray(manifest?.npcs) ? manifest.npcs : [];
  if (!entries.length) {
    return { npcs: [], updaters: [] };
  }

  const roles = Array.isArray(options.roles) && options.roles.length > 0
    ? options.roles
    : DEFAULT_ROLE_SEQUENCE;
  const manifestEntries = entries
    .map((value, index) => {
      if (typeof value === 'string') {
        const fileName = sanitizeRelativePath(value);
        return fileName
          ? {
              fileName,
              role: inferRoleFromFileName(fileName, index, roles),
            }
          : null;
      }
      if (value && typeof value === 'object') {
        const fileName = sanitizeRelativePath(value.file ?? value.path ?? value.url ?? '');
        if (!fileName) return null;
        return {
          fileName,
          role: typeof value.role === 'string' ? value.role : inferRoleFromFileName(fileName, index, roles),
          moveAction: typeof value.moveAction === 'string' ? value.moveAction : null,
          idleAction: typeof value.idleAction === 'string' ? value.idleAction : null,
        };
      }
      return null;
    })
    .filter(Boolean);

  if (!manifestEntries.length) {
    return { npcs: [], updaters: [] };
  }

  const { totalLength } = createCurveLengthLookup(pathCurve);
  const terrain = options.terrain ?? null;
  const getHeightAt = terrain?.userData?.getHeightAt?.bind(terrain?.userData);
  const minSpeed = options.minSpeed ?? 0.6;
  const maxSpeed = options.maxSpeed ?? 1.2;

  const npcs = [];
  const updaters = [];

  for (let i = 0; i < manifestEntries.length; i += 1) {
    const manifestEntry = manifestEntries[i];
    const fileName = manifestEntry.fileName;
    const rng = createSeededRng((i + 11) * 53.17);
    const roleProfile = pickRoleProfile(manifestEntry.role, i, roles);
    const npcDir = joinPath(baseUrl, 'models/npcs');
    const relativeNpcPath = `models/npcs/${fileName}`;
    const urlCandidates = Array.from(
      new Set([
        joinPath(npcDir, fileName),
        relativeNpcPath,
        joinPath(baseUrl, fileName),
        fileName,
      ].filter(Boolean))
    );

    const availableUrl = await resolveNpcUrl(fileName, urlCandidates);
    if (!availableUrl) {
      warnOnce(
        npcWarnings,
        `missing:${fileName}`,
        `[NPC Loader] Missing GLB for ${fileName}; skipping.`
      );
      continue;
    }

    const prioritizedCandidates = [
      availableUrl,
      ...urlCandidates.filter((candidate) => candidate !== availableUrl),
    ];

    const character = new Character();
    character.name = `GLBNPC:${fileName}`;
    character.userData.noCollision = true;
    character.userData.npcRole = roleProfile.id;
    character.userData.npcLabel = roleProfile.label;

    try {
      await character.load(prioritizedCandidates, scene.userData?.renderer, { targetHeight: 1.7 });
      applyForegroundFogPolicy(character);
      const scale = randomBetween(roleProfile.scaleRange[0], roleProfile.scaleRange[1], rng);
      character.scale.setScalar(scale);
      character.traverse((child) => {
        if (!child?.isMesh || !child.material) return;
        if (Array.isArray(child.material)) {
          child.material = child.material.map((material) =>
            tuneMaterialPresentation(material, roleProfile, rng)
          );
        } else {
          child.material = tuneMaterialPresentation(child.material, roleProfile, rng);
        }
      });
    } catch (error) {
      const message = error?.message || String(error);
      if (message && message.includes('Downloaded HTML instead of GLB')) {
        warnOnce(
          npcWarnings,
          `html:${fileName}`,
          '[NPC Loader] Skipping NPC due to HTML response',
          fileName
        );
      } else {
        warnOnce(
          npcWarnings,
          `error:${fileName}`,
          '[NPC Loader] Failed to load NPC',
          fileName,
          message
        );
      }
      continue;
    }

    scene.add(character);
    npcs.push(character);

    const moveAction = manifestEntry.moveAction
      ?? (character.actions?.get(roleProfile.moveAction) ? roleProfile.moveAction : null)
      ?? (character.actions?.get('Swagger') ? 'Swagger' : null)
      ?? (character.actions?.get('Walk') ? 'Walk' : null)
      ?? 'Idle';
    const idleAction = manifestEntry.idleAction
      ?? (character.actions?.get(roleProfile.idleAction) ? roleProfile.idleAction : null)
      ?? 'Idle';
    const targetAction = moveAction;
    if (targetAction) {
      try {
        character.play(targetAction, 0.4);
        if (character.current) {
          character.current.timeScale = THREE.MathUtils.clamp(roleProfile.paceMultiplier, 0.8, 1.2);
        }
      } catch (error) {
        console.warn('[NPC Loader] Unable to play animation for', fileName, error);
      }
    }

    const speed =
      THREE.MathUtils.lerp(minSpeed, maxSpeed, rng()) * roleProfile.paceMultiplier;
    let progress = ((i / manifestEntries.length) + rng() * 0.1) % 1;
    let moveTimeRemaining = randomBetween(3.0, 7.0, rng);
    let idleTimeRemaining = 0;
    let targetYaw = 0;

    const initialPosition = pathCurve.getPointAt(progress);
    if (initialPosition) {
      character.position.copy(initialPosition);
      const sampledY = getHeightAt
        ? getHeightAt(character.position.x, character.position.z)
        : initialPosition.y;
      character.position.y = Number.isFinite(sampledY) ? sampledY : initialPosition.y;
      const tangent = pathCurve.getTangentAt(progress);
      if (tangent) {
        targetYaw = Math.atan2(tangent.x, tangent.z);
        if (Number.isFinite(targetYaw)) {
          character.rotation.set(0, targetYaw, 0);
        }
      }
    }

    const update = (dt) => {
      if (!Number.isFinite(dt)) return;

      const isIdle = idleTimeRemaining > 0;
      if (isIdle) {
        idleTimeRemaining = Math.max(0, idleTimeRemaining - dt);
        if (idleTimeRemaining === 0 && moveAction) {
          character.play(moveAction, 0.28);
          if (character.current) {
            character.current.timeScale = THREE.MathUtils.clamp(roleProfile.paceMultiplier, 0.8, 1.2);
          }
          moveTimeRemaining = randomBetween(3.0, 7.4, rng);
        }
      } else {
        const distancePerSecond = speed;
        const length = totalLength > 0 ? totalLength : 1;
        const deltaProgress = (distancePerSecond * dt) / length;
        progress = (progress + deltaProgress) % 1;
        moveTimeRemaining -= dt;
        if (moveTimeRemaining <= 0 && rng() < roleProfile.stopChance) {
          idleTimeRemaining = randomBetween(
            roleProfile.stopDuration[0],
            roleProfile.stopDuration[1],
            rng,
          );
          if (idleAction) {
            character.play(idleAction, 0.3);
            if (character.current) character.current.timeScale = 1;
          }
        }
      }

      const position = pathCurve.getPointAt(progress);
      if (!position) {
        character.update(dt);
        return;
      }

      const tangent = pathCurve.getTangentAt(progress);

      character.position.copy(position);

      const sampledY = getHeightAt ? getHeightAt(character.position.x, character.position.z) : position.y;
      character.position.y = Number.isFinite(sampledY) ? sampledY : position.y;

      if (tangent) {
        targetYaw = Math.atan2(tangent.x, tangent.z);
      }
      character.rotation.y = smoothAngle(
        character.rotation.y,
        targetYaw,
        Math.min(1, dt * (isIdle ? 2.8 : 6.4)),
      );

      character.update(dt);
    };

    updaters.push(update);
  }

  return { npcs, updaters };
}

export default spawnCitizenCrowd;
