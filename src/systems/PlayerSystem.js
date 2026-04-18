import * as THREE from "three";
import { InputMap } from "../input/InputMap.ts";
import { PlayerController } from "../controls/PlayerController.js";
import { ThirdPersonCamera } from "../controls/ThirdPersonCamera.js";
import { Character } from "../characters/Character.js";
import { findSafePlayerSpawn } from "../world/spawn.js";
import { AGORA_CENTER_3D, HARBOR_CENTER_3D, getSeaLevelY } from "../world/locations.js";
import { createGLTFLoader, loadGLBWithFallbacks } from "../utils/glbSafeLoader.js";
import { joinPath } from "../utils/baseUrl.js";

const USE_THIRD_PERSON = true;
const ENABLE_HERO_GLB = true;
const DEMO_SPAWN_OFFSET = new THREE.Vector3(0, 0, 0);
const DEMO_LOOK_BLEND = 0.0;
const DEMO_LOOK_OFFSET = new THREE.Vector3(-20, 0, -15);
const DEMO_CAMERA_PITCH = THREE.MathUtils.degToRad(18);
const DEMO_CAMERA_DISTANCE = 8;
const HERO_MAX_ENVMAP_INTENSITY = 0.06;
const HERO_MAX_GLOSSINESS = 0.16;
const HERO_MAX_SPECULAR = 0.18;
const HERO_MAX_METALNESS = 0.02;
const HERO_MIN_ROUGHNESS = 0.88;
const HERO_MAX_REFLECTIVITY = 0.18;

function createDemoSpawnAnchor() {
  return AGORA_CENTER_3D.clone().add(DEMO_SPAWN_OFFSET);
}

function getOpeningCameraYaw(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5)) {
    return 0;
  }
  return Math.atan2(-dx, dz);
}

function softenHeroMaterials(root) {
  if (!root || typeof root.traverse !== "function") return;

  root.traverse((child) => {
    if (!child?.isMesh || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.userData = material.userData || {};
      material.userData.envMapIntensityCap = Math.min(
        material.userData.envMapIntensityCap ?? Infinity,
        HERO_MAX_ENVMAP_INTENSITY,
      );

      // Keep the player's original cloth-and-leather feel by dialing back the
      // strong reflection response that our global lighting now gives the hero.
      if (typeof material.envMapIntensity === "number") {
        material.envMapIntensity = Math.min(material.envMapIntensity, HERO_MAX_ENVMAP_INTENSITY);
      }

      if (material.isGLTFSpecularGlossinessMaterial) {
        if (typeof material.glossiness === "number") {
          material.glossiness = Math.min(material.glossiness, HERO_MAX_GLOSSINESS);
        }
        if (material.specular?.isColor) {
          material.specular.r = Math.min(material.specular.r, HERO_MAX_SPECULAR);
          material.specular.g = Math.min(material.specular.g, HERO_MAX_SPECULAR);
          material.specular.b = Math.min(material.specular.b, HERO_MAX_SPECULAR);
        }
      } else {
        if (typeof material.metalness === "number") {
          material.metalness = Math.min(material.metalness, HERO_MAX_METALNESS);
        }
        if (typeof material.roughness === "number") {
          material.roughness = Math.max(material.roughness, HERO_MIN_ROUGHNESS);
        }
        if (typeof material.reflectivity === "number") {
          material.reflectivity = Math.min(material.reflectivity, HERO_MAX_REFLECTIVITY);
        }
        if (typeof material.clearcoat === "number") {
          material.clearcoat = 0;
        }
        if (typeof material.clearcoatRoughness === "number") {
          material.clearcoatRoughness = 1;
        }
        if (typeof material.sheen === "number") {
          material.sheen = 0;
        }
      }

      material.needsUpdate = true;
    }
  });
}

export class PlayerSystem {
  constructor({ scene, camera, renderer, envCollider, terrain, worldRoot, baseUrl }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.envCollider = envCollider;
    this.terrain = terrain;
    this.worldRoot = worldRoot;
    this.baseUrl = baseUrl;
    this.player = null;
    this.thirdPersonCamera = null;
    this.playerMovementEnabled = true;
  }

  async initialize() {
    const { scene, camera, renderer, envCollider, terrain, worldRoot, baseUrl } = this;

    const input = new InputMap(renderer.domElement);
    this.player = new PlayerController(input, envCollider, {
      camera,
      terrainHeightSampler: terrain?.userData?.getHeightAt ?? null,
    });
    worldRoot.add(this.player.object);

    const spawnAnchor = createDemoSpawnAnchor();
    const spawnPosition = findSafePlayerSpawn({
      envCollider,
      terrain,
      searchCenter: spawnAnchor,
      fallback: spawnAnchor,
      playerHeight: this.player.height,
      playerRadius: this.player.radius,
      verticalClearance: 3.0,
      seaLevel: 0,
    });
    this.player.object.position.copy(spawnPosition);
    this.player.syncCapsuleToObject();

    const thirdPersonSolids = [];
    if (envCollider?.mesh) {
      thirdPersonSolids.push(envCollider.mesh);
    }
    if (terrain) {
      thirdPersonSolids.push(terrain);
    }

    const thirdPersonTargetOffset = new THREE.Vector3(
      0,
      this.player.height * 0.82,
      0,
    );

    if (USE_THIRD_PERSON) {
      this.thirdPersonCamera = new ThirdPersonCamera(camera, this.player.object, {
        targetOffset: thirdPersonTargetOffset,
        followLerp: 0.46,
        rotationLerp: 0.56,
        solids: thirdPersonSolids,
        enabled: false,
        keyOrbit: {
          enabled: true,
          yawSpeed: 1.9,
          pitchSpeed: 1.7,
          minPitch: -0.6,
          maxPitch: 0.6,
          minDist: 2.5,
          maxDist: 18,
          zoomSpeed: 4,
        },
      });

      const openingLookTarget = AGORA_CENTER_3D
        .clone()
        .lerp(HARBOR_CENTER_3D.clone(), DEMO_LOOK_BLEND)
        .add(DEMO_LOOK_OFFSET);
      const openingYaw = getOpeningCameraYaw(spawnPosition, openingLookTarget);
      this.thirdPersonCamera.distance = DEMO_CAMERA_DISTANCE;
      this.thirdPersonCamera.setAngles(openingYaw, DEMO_CAMERA_PITCH, { snap: true });
      this.player.cameraYaw = openingYaw;
      this.player.cameraPitch = DEMO_CAMERA_PITCH;
    }

    this.attachFallbackAvatar();
    this.setThirdPersonEnabled(USE_THIRD_PERSON);
    void this.loadCharacter();
  }

  update(deltaTime) {
    if (this.playerMovementEnabled) {
      this.player.update(deltaTime);
    } else {
      this.player.velocity.set(0, 0, 0);
    }

    if (this.thirdPersonCamera) {
      this.player.cameraYaw = this.thirdPersonCamera.getYaw();
      this.player.cameraPitch = this.thirdPersonCamera.getPitch();
      this.thirdPersonCamera.update(deltaTime);
      this.camera.position.copy(this.thirdPersonCamera.camera.position);
      this.camera.quaternion.copy(this.thirdPersonCamera.camera.quaternion);
    }

    const playerRoot = this.player?.object;
    const seaLevel = getSeaLevelY();

    if (playerRoot && playerRoot.position.y < seaLevel - 15.0) {
      const respawnAnchor = createDemoSpawnAnchor();
      const respawnPos = findSafePlayerSpawn({
        envCollider: this.envCollider,
        terrain: this.terrain,
        searchCenter: respawnAnchor,
        fallback: respawnAnchor,
        playerHeight: this.player.height,
        playerRadius: this.player.radius,
        verticalClearance: 0.5,
        seaLevel: seaLevel,
      });
      this.player.velocity.set(0, 0, 0);
      playerRoot.position.copy(respawnPos);
      this.player.syncCapsuleToObject();
    }

    const terrainSize = this.terrain?.geometry?.userData?.size;
    if (playerRoot && Number.isFinite(terrainSize)) {
      const halfSize = terrainSize * 0.5;
      const margin = 2.0;
      const minBound = -halfSize + margin;
      const maxBound = halfSize - margin;
      const pos = playerRoot.position;

      const clampedX = THREE.MathUtils.clamp(pos.x, minBound, maxBound);
      const clampedZ = THREE.MathUtils.clamp(pos.z, minBound, maxBound);
      const clamped = clampedX !== pos.x || clampedZ !== pos.z;
      if (clamped) {
        pos.x = clampedX;
        pos.z = clampedZ;

        const sampler =
          typeof this.scene?.userData?.getHeightAt === "function"
            ? this.scene.userData.getHeightAt
            : typeof this.terrain?.userData?.getHeightAt === "function"
            ? this.terrain.userData.getHeightAt
            : null;
        if (sampler) {
          const groundHeight = sampler(pos.x, pos.z);
          if (Number.isFinite(groundHeight)) {
            pos.y = Math.max(pos.y, groundHeight + 0.1);
          }
        }
      }
    }
  }

  async loadCharacter() {
    const character = new Character();
    const heroRootPath = "models/character/hero.glb";
    const absolutePath = "/athens-game-starter/models/character/hero.glb";
    const bundledHeroName = encodeURIComponent("astronaut.glb");
    const characterDir = joinPath(this.baseUrl, "models/character");
    const bundledHeroPath = joinPath(characterDir, bundledHeroName);
    const bundledHeroRootPath = `models/character/${bundledHeroName}`;
    const heroCandidates = Array.from(
      new Set(
        [absolutePath, heroRootPath, bundledHeroPath, bundledHeroRootPath].filter(Boolean),
      ),
    );

    if (ENABLE_HERO_GLB) {
      try {
        const heroLoader = await createGLTFLoader(this.renderer);
        const loadedHero = await loadGLBWithFallbacks(
          heroLoader,
          heroCandidates,
          {
            allowSingleModel: true,
            renderer: this.renderer,
            targetHeight: 1.8,
          },
        );

        if (!loadedHero || !loadedHero.root) {
          throw new Error("No hero GLB candidates reachable");
        }

        const { root, gltf } = loadedHero;

        // Don't reset scale - it was already scaled to targetHeight in loadGLBWithFallbacks
        // root.scale.set(1, 1, 1);  // REMOVED - this was undoing the scaling!
        root.position.set(0, 0, 0);
        softenHeroMaterials(root);
        
        // Update matrix world to ensure proper bounding box calculations
        root.updateMatrixWorld(true);
        
        // Enable shadow casting for all meshes and update bounding spheres
        root.traverse((child) => {
          if (child.isMesh) {
            // Some imported hero GLB mesh parts arrive hidden; force them visible on the player rig.
            child.visible = true;
            child.castShadow = true;
            child.receiveShadow = false;
            child.frustumCulled = false;  // Disable frustum culling for character meshes
            // Update geometry bounds
            if (child.geometry) {
              child.geometry.computeBoundingBox();
              child.geometry.computeBoundingSphere();
            }
          }
        });

        character.initializeFromGLTF(root, gltf.animations);
        this.player.attachCharacter(character);
        
        // Hide fallback capsule if it exists
        if (this.fallbackAvatar) {
          this.fallbackAvatar.visible = false;
        }
      } catch (error) {
        console.warn('[PlayerSystem] Failed to load hero GLB, using fallback avatar:', error);
        if (this.fallbackAvatar) {
          this.fallbackAvatar.visible = true;
        } else {
          this.attachFallbackAvatar();
        }
      }
    } else {
      this.attachFallbackAvatar();
    }
  }

  attachFallbackAvatar() {
    if (this.fallbackAvatar) {
      this.fallbackAvatar.visible = true;
      return;
    }
    const fallbackAvatar = this.createFallbackAvatar();
    this.fallbackAvatar = fallbackAvatar;
    this.player.object.add(fallbackAvatar);
    fallbackAvatar.position.set(0, 0, 0);
  }

  createFallbackAvatar() {
    const group = new THREE.Group();
    group.name = "FallbackAvatar";

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4e8ef7,
      metalness: 0.2,
      roughness: 0.6,
      fog: false,
    });

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16),
      bodyMaterial,
    );
    body.castShadow = true;
    body.receiveShadow = false;
    body.position.y = 0.6;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.4, fog: false }),
    );
    head.castShadow = true;
    head.position.y = 1.32;
    group.add(head);

    return group;
  }

  setThirdPersonEnabled(enabled) {
    if (!this.thirdPersonCamera) return;
    this.thirdPersonCamera.setEnabled(enabled);
  }

  setPlayerMovementEnabled(enabled) {
    this.playerMovementEnabled = enabled;
  }
}
