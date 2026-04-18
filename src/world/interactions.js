import * as THREE from "three";

const PENDING_INTERACTABLES_KEY = "__interactorPending";
const CITIZEN_MESH_NAME = "Citizens";
const CITIZEN_PROMPT_TEXT = "Citizen: [Press E to Talk]";
const CITIZEN_DIALOGUES = [
  "The wind is favorable today.",
  "Have you visited the Agora?",
  "Follow the blue sail marker if you want the harbor.",
  "The bakers have fresh bread this morning.",
  "Be careful on the steeper slopes near the Acropolis.",
  "The ivory beacon on the height marks the Acropolis.",
  "They say a new play opens at the theater tonight.",
];

const _instanceMatrix = new THREE.Matrix4();
const _instancePosition = new THREE.Vector3();
const _instanceQuaternion = new THREE.Quaternion();
const _instanceScale = new THREE.Vector3();
const _instanceLook = new THREE.Vector3();

export function queueSceneInteractable(scene, object, options = {}) {
  if (!scene || !object) return;
  scene.userData = scene.userData || {};
  const { includeChildren = true } = options;

  const interactor = scene.userData.interactor;
  if (interactor && typeof interactor.registerInteractable === "function") {
    interactor.registerInteractable(object, { includeChildren });
    return;
  }

  let pending = scene.userData[PENDING_INTERACTABLES_KEY];
  if (!(pending instanceof Map)) {
    pending = new Map();
    scene.userData[PENDING_INTERACTABLES_KEY] = pending;
  }
  pending.set(object, { includeChildren });
}

/**
 * Create a simple helper that lets us cast rays from the camera into the scene.
 * Raycasters are how we "pick" objects in three.js – we shoot an invisible ray
 * and see what it hits first. Beginners can imagine it like a laser pointer.
 *
 * @param {THREE.WebGLRenderer} renderer - The renderer so we can read the canvas size.
 * @param {THREE.Camera} camera - The active camera that defines the view.
 * @param {THREE.Scene} scene - The scene graph containing objects to test against.
 * @returns {Object} interactor helper
 */
export function createInteractor(renderer, camera, scene) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const hoverCameraPosition = new THREE.Vector3();
  const lastHoverCameraPosition = new THREE.Vector3();
  const hoverCameraQuaternion = new THREE.Quaternion();
  const lastHoverCameraQuaternion = new THREE.Quaternion();

  const HOVER_COLOR = 0x222244;
  const HOVER_UPDATE_INTERVAL = 1 / 24; // limit expensive raycasts to ~24 Hz
  const STATIONARY_HOVER_REFRESH_INTERVAL = 0.25;
  const CAMERA_MOVE_EPSILON_SQ = 0.0004;
  const CAMERA_ROTATION_DOT_THRESHOLD = 0.99995;
  const storedMaterialState = new Map();
  let currentHover = null;
  let currentCitizenHit = null;
  let hoverTimer = HOVER_UPDATE_INTERVAL; // ensure the first call performs a hit test
  let stationaryHoverTimer = STATIONARY_HOVER_REFRESH_INTERVAL;
  let hoverPoseInitialized = false;

  const trackedInteractables = new Map();
  const intersectTargets = [];
  let targetsDirty = true;

  const citizenPrompt = createCitizenPrompt();
  const citizenDialogueOverlay = createCitizenDialogueOverlay();
  let dialogueHideTimer = null;

  function isInScene(object) {
    let node = object;
    while (node) {
      if (node === scene) return true;
      node = node.parent;
    }
    return false;
  }

  function rebuildTargets() {
    intersectTargets.length = 0;
    for (const object of trackedInteractables.keys()) {
      if (!object) continue;
      if (!isInScene(object)) continue;
      intersectTargets.push(object);
    }
    const citizenMesh = scene?.getObjectByName?.(CITIZEN_MESH_NAME);
    if (citizenMesh?.isInstancedMesh && !intersectTargets.includes(citizenMesh)) {
      intersectTargets.push(citizenMesh);
    }
    targetsDirty = false;
  }

  function getRaycastTargets() {
    if (targetsDirty) {
      rebuildTargets();
    }
    return intersectTargets.length > 0 ? intersectTargets : scene.children;
  }

  function addTrackedObject(object) {
    if (!object || trackedInteractables.has(object)) return;
    const onAdded = () => {
      targetsDirty = true;
    };
    const onRemoved = () => {
      const entry = trackedInteractables.get(object);
      if (!entry) return;
      object.removeEventListener("added", onAdded);
      object.removeEventListener("removed", onRemoved);
      trackedInteractables.delete(object);
      targetsDirty = true;
      if (currentHover === object || currentHover === getHighlightTarget(object)) {
        clearHover();
      }
    };

    object.addEventListener("added", onAdded);
    object.addEventListener("removed", onRemoved);
    trackedInteractables.set(object, { onAdded, onRemoved });
    targetsDirty = true;
  }

  function registerInteractable(object, options = {}) {
    if (!object) return;
    const { includeChildren = true } = options;
    const visit = (node) => {
      if (!node?.userData?.interactable) return;
      addTrackedObject(node);
    };
    if (includeChildren && typeof object.traverse === "function") {
      object.traverse(visit);
    } else {
      visit(object);
    }
  }

  function unregisterInteractable(object, options = {}) {
    if (!object) return;
    const { includeChildren = true } = options;
    const removeNode = (node) => {
      const entry = trackedInteractables.get(node);
      if (!entry) return;
      node.removeEventListener("added", entry.onAdded);
      node.removeEventListener("removed", entry.onRemoved);
      trackedInteractables.delete(node);
      targetsDirty = true;
    };
    if (includeChildren && typeof object.traverse === "function") {
      object.traverse(removeNode);
    } else {
      removeNode(object);
    }
  }

  function scanSceneForInteractables(root) {
    if (!root || typeof root.traverse !== "function") return;
    root.traverse((node) => {
      if (node?.userData?.interactable) {
        addTrackedObject(node);
      }
    });
  }

  /**
   * Because `userData` is just a plain JavaScript object, we can attach custom
   * metadata to any mesh. Here we look for a boolean flag that marks an object
   * as interactable and optional callbacks to run when it is used.
   *
   * @param {THREE.Object3D | null} object
   * @returns {THREE.Object3D | null}
   */
  function findInteractable(object) {
    let node = object;
    while (node) {
      if (node.userData && node.userData.interactable) {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  /**
   * Helper that gathers all materials on the object (meshes may have an array).
   * @param {THREE.Object3D} object
   * @returns {THREE.Material[]}
   */
  function getMaterials(object) {
    if (!object || !object.material) return [];
    return Array.isArray(object.material) ? object.material : [object.material];
  }

  function getHighlightTarget(object) {
    if (!object) return object;
    const target = object.userData?.highlightTarget;
    return target || object;
  }

  /**
   * Restore material colors/emissive values for the previously hovered object.
   */
  function clearHover() {
    if (!currentHover) return;
    const target = getHighlightTarget(currentHover);
    for (const material of getMaterials(target)) {
      if (!material || !storedMaterialState.has(material)) continue;
      const stored = storedMaterialState.get(material);
      if (material.emissive && stored.emissive) {
        material.emissive.copy(stored.emissive);
      }
      if (material.color && stored.color) {
        material.color.copy(stored.color);
      }
      storedMaterialState.delete(material);
    }
    currentHover = null;
    hoverTimer = HOVER_UPDATE_INTERVAL;
    setCitizenHover(null);
  }

  /**
   * Apply a subtle highlight to the hovered object. We try to tint the
   * emissive channel for PBR materials, otherwise fall back to the base color.
   * The highlight feedback tells the player what they can interact with.
   *
   * @param {THREE.Object3D} object
   */
  function applyHighlight(object) {
    const target = getHighlightTarget(object);
    for (const material of getMaterials(target)) {
      if (!material) continue;

      if (!storedMaterialState.has(material)) {
        storedMaterialState.set(material, {
          emissive: material.emissive ? material.emissive.clone() : null,
          color: material.color ? material.color.clone() : null,
        });
      }

      if (material.emissive) {
        material.emissive.setHex(HOVER_COLOR);
      } else if (material.color) {
        material.color.offsetHSL(0, 0, 0.2);
      }
    }

    currentHover = object;
  }

  /**
   * Convert a screen-space coordinate to normalized device coordinates (NDC)
   * and cast a ray to find the closest intersected object. Raycasters only hit
   * meshes that are in the scene graph and visible to the camera, so hidden or
   * culled objects are naturally ignored.
   *
   * @param {number} screenX - Pixel X coordinate relative to the canvas.
   * @param {number} screenY - Pixel Y coordinate relative to the canvas.
   * @returns {THREE.Intersection | null}
   */
  function pickObject(screenX, screenY) {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (width === 0 || height === 0) return null;

    const xNdc = (screenX / width) * 2 - 1;
    const yNdc = -(screenY / height) * 2 + 1;

    mouse.set(xNdc, yNdc);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(getRaycastTargets(), true);
    return intersects.length > 0 ? intersects[0] : null;
  }

  /**
   * Convenience for casting a ray straight through the center of the screen.
   * This is perfect for a first-person "crosshair" style interaction.
   *
   * @returns {THREE.Intersection | null}
   */
  function pickCenter() {
    mouse.set(0, 0);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(getRaycastTargets(), true);
    return intersects.length > 0 ? intersects[0] : null;
  }

  function hasHoverPoseChanged() {
    camera.getWorldPosition(hoverCameraPosition);
    camera.getWorldQuaternion(hoverCameraQuaternion);

    if (!hoverPoseInitialized) {
      lastHoverCameraPosition.copy(hoverCameraPosition);
      lastHoverCameraQuaternion.copy(hoverCameraQuaternion);
      hoverPoseInitialized = true;
      return true;
    }

    const moved =
      hoverCameraPosition.distanceToSquared(lastHoverCameraPosition) >
      CAMERA_MOVE_EPSILON_SQ;
    const rotated =
      Math.abs(hoverCameraQuaternion.dot(lastHoverCameraQuaternion)) <
      CAMERA_ROTATION_DOT_THRESHOLD;

    if (!moved && !rotated) {
      return false;
    }

    lastHoverCameraPosition.copy(hoverCameraPosition);
    lastHoverCameraQuaternion.copy(hoverCameraQuaternion);
    return true;
  }

  function updateHover(deltaSeconds = HOVER_UPDATE_INTERVAL) {
    if (Number.isFinite(deltaSeconds)) {
      hoverTimer += deltaSeconds;
      stationaryHoverTimer += deltaSeconds;
    }

    if (hoverTimer < HOVER_UPDATE_INTERVAL) {
      return currentHover;
    }

    hoverTimer = 0;
    const poseChanged = hasHoverPoseChanged();
    const shouldRefreshHover =
      poseChanged ||
      targetsDirty ||
      stationaryHoverTimer >= STATIONARY_HOVER_REFRESH_INTERVAL;

    if (!shouldRefreshHover) {
      return currentHover;
    }

    stationaryHoverTimer = 0;
    const hit = pickCenter();
    const citizenHit = resolveCitizenHit(hit);
    setCitizenHover(citizenHit);

    const target = citizenHit ? hit?.object : hit ? findInteractable(hit.object) : null;

    if (!target) {
      clearHover();
      return null;
    }

    if (target === currentHover) {
      return currentHover;
    }

    clearHover();
    applyHighlight(target);
    return currentHover;
  }

  function getCurrentHover() {
    return currentHover;
  }

  function useObject() {
    if (currentCitizenHit) {
      handleCitizenInteraction(currentCitizenHit);
      return;
    }

    if (!currentHover) {
      // console.log("Nothing to interact with.");
      return;
    }

    const onUse = currentHover.userData && currentHover.userData.onUse;
    if (typeof onUse === "function") {
      onUse(currentHover);
    } else {
      const name = currentHover.name || currentHover.type || "object";
      console.log(`Nothing to interact with on ${name}.`);
    }
  }

  function resolveCitizenHit(hit) {
    if (!hit || !hit.object || !hit.object.isInstancedMesh) return null;
    if (hit.object.name !== CITIZEN_MESH_NAME) return null;
    if (!Number.isInteger(hit.instanceId) || hit.instanceId < 0) return null;

    const trafficManager = scene?.userData?.trafficManager;
    const agent =
      trafficManager?.getAgentByInstanceId?.(hit.instanceId, hit.object) ??
      trafficManager?.getAgent?.(hit.instanceId, hit.object) ??
      (Array.isArray(trafficManager?.agents) ? trafficManager.agents[hit.instanceId] : null);

    return {
      object: hit.object,
      instanceId: hit.instanceId,
      agent,
    };
  }

  function setCitizenHover(hit) {
    currentCitizenHit = hit;
    if (citizenPrompt) {
      citizenPrompt.style.opacity = hit ? "1" : "0";
    }
  }

  function handleCitizenInteraction(hit) {
    if (!hit?.object || !Number.isInteger(hit.instanceId)) return;

    tryPauseCitizen(hit.agent, hit.instanceId);
    rotateCitizenToFacePlayer(hit.object, hit.instanceId);
    showCitizenDialogue();
  }

  function tryPauseCitizen(agent, instanceId) {
    const trafficManager = scene?.userData?.trafficManager;
    if (trafficManager?.pauseAgent) {
      trafficManager.pauseAgent(agent ?? instanceId, instanceId);
      return;
    }
    if (trafficManager?.setAgentPaused) {
      trafficManager.setAgentPaused(instanceId, true);
      return;
    }
    if (!agent) return;
    if (typeof agent.pause === "function") {
      agent.pause();
      return;
    }
    if (typeof agent.setPaused === "function") {
      agent.setPaused(true);
      return;
    }
    if ("paused" in agent) {
      agent.paused = true;
    }
  }

  function rotateCitizenToFacePlayer(mesh, instanceId) {
    if (!mesh?.isInstancedMesh || !Number.isInteger(instanceId)) return;

    mesh.getMatrixAt(instanceId, _instanceMatrix);
    _instanceMatrix.decompose(_instancePosition, _instanceQuaternion, _instanceScale);

    _instanceLook.subVectors(camera.position, _instancePosition);
    _instanceLook.y = 0;
    if (_instanceLook.lengthSq() === 0) return;

    _instanceLook.normalize();
    const yaw = Math.atan2(_instanceLook.x, _instanceLook.z);
    _instanceQuaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    _instanceMatrix.compose(_instancePosition, _instanceQuaternion, _instanceScale);
    mesh.setMatrixAt(instanceId, _instanceMatrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  function showCitizenDialogue() {
    if (!citizenDialogueOverlay) return;

    const dialogue = CITIZEN_DIALOGUES[Math.floor(Math.random() * CITIZEN_DIALOGUES.length)];
    citizenDialogueOverlay.textContent = dialogue;
    citizenDialogueOverlay.style.opacity = "1";

    if (dialogueHideTimer) {
      clearTimeout(dialogueHideTimer);
    }

    dialogueHideTimer = setTimeout(() => {
      citizenDialogueOverlay.style.opacity = "0";
    }, 3200);
  }

  const api = {
    raycaster,
    mouse,
    pickObject,
    pickCenter,
    updateHover,
    clearHover,
    getCurrentHover,
    useObject,
    registerInteractable,
    unregisterInteractable,
    rescanInteractables: () => {
      targetsDirty = true;
      scanSceneForInteractables(scene);
    },
  };

  scene.userData = scene.userData || {};
  scene.userData.interactor = api;

  const pending = scene.userData[PENDING_INTERACTABLES_KEY];
  if (pending instanceof Map) {
    for (const [object, options] of pending.entries()) {
      registerInteractable(object, options);
    }
    pending.clear();
  }

  scanSceneForInteractables(scene);

  return api;
}

function createCitizenPrompt() {
  if (typeof document === "undefined") return null;
  const node = document.createElement("div");
  node.textContent = CITIZEN_PROMPT_TEXT;
  Object.assign(node.style, {
    position: "fixed",
    left: "50%",
    bottom: "26%",
    transform: "translateX(-50%)",
    padding: "8px 12px",
    borderRadius: "6px",
    background: "rgba(0, 0, 0, 0.7)",
    color: "#fff",
    fontFamily: "sans-serif",
    fontSize: "14px",
    letterSpacing: "0.05em",
    opacity: "0",
    transition: "opacity 0.2s ease",
    pointerEvents: "none",
    zIndex: 1100,
  });
  document.body.appendChild(node);
  return node;
}

function createCitizenDialogueOverlay() {
  if (typeof document === "undefined") return null;
  const node = document.createElement("div");
  Object.assign(node.style, {
    position: "fixed",
    left: "50%",
    bottom: "32%",
    transform: "translateX(-50%)",
    padding: "10px 14px",
    borderRadius: "8px",
    background: "rgba(0, 0, 0, 0.75)",
    color: "#f5f5f5",
    fontFamily: "sans-serif",
    fontSize: "15px",
    letterSpacing: "0.05em",
    opacity: "0",
    transition: "opacity 0.25s ease",
    pointerEvents: "none",
    zIndex: 1150,
    minWidth: "220px",
    textAlign: "center",
  });
  document.body.appendChild(node);
  return node;
}
