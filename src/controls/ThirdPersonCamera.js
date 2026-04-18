import * as THREE from "three";
import {
  loadSettings,
  subscribe,
  defaultCameraSettings,
} from "../state/settingsStore.ts";

const DEFAULT_OFFSET = new THREE.Vector3(0, 2.2, -4.5);
const DEFAULT_TARGET_OFFSET = new THREE.Vector3(0, 1.2, 0);
const DEFAULT_MIN_PITCH = THREE.MathUtils.degToRad(-25);
const DEFAULT_MAX_PITCH = THREE.MathUtils.degToRad(65);
const DEFAULT_COLLISION_OFFSET = 0.25;
const DEFAULT_FOLLOW_LERP = 0.12;
const DEFAULT_ROTATION_LERP = 0.15;
const DEFAULT_YAW_SENSITIVITY = 0.0024;
const DEFAULT_PITCH_SENSITIVITY = 0.0021;
const DEFAULT_KEY_ORBIT = {
  enabled: false,
  yawSpeed: 0.9,
  pitchSpeed: 0.9,
  minPitch: -0.6,
  maxPitch: 0.6,
  minDist: 2.5,
  maxDist: 7.5,
  zoomSpeed: 4,
  invertPitch: false,
}; // ArrowKeyOrbit: defaults for keyboard orbit behaviour
const TAU = Math.PI * 2;

const _tmpOffset = new THREE.Vector3();
const _tmpDirection = new THREE.Vector3();
const _tmpTarget = new THREE.Vector3();
const _tmpCollision = new THREE.Vector3();
const _tmpLookAt = new THREE.Vector3();

const KEY_CODES = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
];

function wrapAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, TAU) - Math.PI;
}

function lerpAngle(current, target, t) {
  if (t >= 1) return wrapAngle(target);
  const delta = wrapAngle(target - current);
  return wrapAngle(current + delta * t);
}

function isObject3D(value) {
  return value && typeof value === "object" && value.isObject3D === true;
}

function getTargetFacingYaw(targetObject) {
  if (!isObject3D(targetObject)) {
    return null;
  }

  let facingSource = null;
  for (const child of targetObject.children ?? []) {
    if (isObject3D(child) && child.visible !== false) {
      facingSource = child;
      break;
    }
  }

  const source = facingSource ?? targetObject;
  const yaw = source.rotation?.y;
  return Number.isFinite(yaw) ? yaw : null;
}

/**
 * Third-person orbital camera with obstacle avoidance.
 */
export class ThirdPersonCamera {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D | null} targetObject
   * @param {Object} [options]
   * @param {THREE.Vector3} [options.offset]
   * @param {THREE.Vector3} [options.targetOffset]
   * @param {number} [options.minPitch]
   * @param {number} [options.maxPitch]
   * @param {number} [options.collisionOffset]
   * @param {number} [options.followLerp]
   * @param {number} [options.rotationLerp]
   * @param {number} [options.yawSensitivity]
   * @param {number} [options.pitchSensitivity]
   * @param {THREE.Object3D[]} [options.solids]
   * @param {boolean} [options.enabled]
   * @param {Object} [options.keyOrbit]
   * @param {boolean} [options.keyOrbit.enabled]
   * @param {number} [options.keyOrbit.yawSpeed]
   * @param {number} [options.keyOrbit.pitchSpeed]
   * @param {number} [options.keyOrbit.minPitch]
   * @param {number} [options.keyOrbit.maxPitch]
   * @param {number} [options.keyOrbit.minDist]
   * @param {number} [options.keyOrbit.maxDist]
   * @param {number} [options.keyOrbit.zoomSpeed]
   */
  constructor(camera, targetObject, options = {}) {
    this.camera = camera;
    this.targetObject = targetObject ?? null;

    this.offset = (options.offset ?? DEFAULT_OFFSET).clone();
    this.targetOffset = (options.targetOffset ?? DEFAULT_TARGET_OFFSET).clone();

    this.followLerp = options.followLerp ?? DEFAULT_FOLLOW_LERP;
    this.rotationLerp = options.rotationLerp ?? DEFAULT_ROTATION_LERP;
    this.yawSensitivity = options.yawSensitivity ?? DEFAULT_YAW_SENSITIVITY;
    this.pitchSensitivity = options.pitchSensitivity ?? DEFAULT_PITCH_SENSITIVITY;

    this.minPitch = options.minPitch ?? DEFAULT_MIN_PITCH;
    this.maxPitch = options.maxPitch ?? DEFAULT_MAX_PITCH;
    this.collisionOffset = options.collisionOffset ?? DEFAULT_COLLISION_OFFSET;

    this.distance = Math.max(0.1, this.offset.length());

    const keyOrbitOptions = options.keyOrbit ?? DEFAULT_KEY_ORBIT;
    const resolvedKeyOrbit = { ...DEFAULT_KEY_ORBIT, ...keyOrbitOptions };
    resolvedKeyOrbit.minPitch = THREE.MathUtils.clamp(
      resolvedKeyOrbit.minPitch,
      -Math.PI * 0.5,
      Math.PI * 0.5
    );
    resolvedKeyOrbit.maxPitch = THREE.MathUtils.clamp(
      resolvedKeyOrbit.maxPitch,
      -Math.PI * 0.5,
      Math.PI * 0.5
    );
    if (resolvedKeyOrbit.maxPitch < resolvedKeyOrbit.minPitch) {
      const swap = resolvedKeyOrbit.maxPitch;
      resolvedKeyOrbit.maxPitch = resolvedKeyOrbit.minPitch;
      resolvedKeyOrbit.minPitch = swap;
    }
    this.keyOrbit = resolvedKeyOrbit; // ArrowKeyOrbit: resolved configuration

    this.keyOrbitState = {
      desiredYawDelta: 0,
      desiredPitchDelta: 0,
      keys: {
        left: false,
        right: false,
        up: false,
        down: false,
        pageUp: false,
        pageDown: false,
      },
    }; // ArrowKeyOrbit: runtime state
    this.keyOrbitHandlersAttached = false;
    this.handleKeyDown = (event) => {
      if (!this.shouldHandleKeyOrbitEvent(event)) return;
      let handled = false;
      switch (event.code) {
        case "ArrowLeft":
          this.keyOrbitState.keys.left = true;
          handled = true;
          break;
        case "ArrowRight":
          this.keyOrbitState.keys.right = true;
          handled = true;
          break;
        case "ArrowUp":
          this.keyOrbitState.keys.up = true;
          handled = true;
          break;
        case "ArrowDown":
          this.keyOrbitState.keys.down = true;
          handled = true;
          break;
        case "PageUp":
          this.keyOrbitState.keys.pageUp = true;
          handled = true;
          break;
        case "PageDown":
          this.keyOrbitState.keys.pageDown = true;
          handled = true;
          break;
        case "End":
          if (!event.repeat) {
            this.resetBehindTarget();
          }
          handled = true;
          break;
        default:
          break;
      }
      if (handled && this.shouldConsumeKeyOrbit()) {
        event.preventDefault(); // ArrowKeyOrbit: prevent scrolling when orbiting
      }
    };
    this.handleKeyUp = (event) => {
      if (!this.keyOrbitHandlersAttached) return;
      switch (event.code) {
        case "ArrowLeft":
          this.keyOrbitState.keys.left = false;
          break;
        case "ArrowRight":
          this.keyOrbitState.keys.right = false;
          break;
        case "ArrowUp":
          this.keyOrbitState.keys.up = false;
          break;
        case "ArrowDown":
          this.keyOrbitState.keys.down = false;
          break;
        case "PageUp":
          this.keyOrbitState.keys.pageUp = false;
          break;
        case "PageDown":
          this.keyOrbitState.keys.pageDown = false;
          break;
        default:
          break;
      }
    };

    const clampedY = THREE.MathUtils.clamp(this.offset.y / this.distance, -1, 1);
    this.basePitch = Math.asin(clampedY);
    this.baseYaw = Math.atan2(this.offset.x, -this.offset.z);

    this.targetYaw = wrapAngle(this.baseYaw);
    this.targetPitch = THREE.MathUtils.clamp(this.basePitch, this.minPitch, this.maxPitch);
    this.currentYaw = this.targetYaw;
    this.currentPitch = this.targetPitch;

    this.smoothedPosition = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();
    this.intersections = [];

    this.solids = Array.isArray(options.solids)
      ? options.solids.filter(isObject3D)
      : [];

    // CameraSettingsStore: keyboard orbit state
    this.keyboardState = {
      ArrowLeft: false,
      ArrowRight: false,
      ArrowUp: false,
      ArrowDown: false,
      PageUp: false,
      PageDown: false,
    };
    this.arrowOrbitEnabled = defaultCameraSettings.enableArrowOrbit;
    this.keyboardYawSpeed = defaultCameraSettings.yawSpeed;
    this.keyboardPitchSpeed = defaultCameraSettings.pitchSpeed;
    this.keyboardZoomSpeed = defaultCameraSettings.zoomSpeed;
    this.minDistance = defaultCameraSettings.minDist;
    this.maxDistance = defaultCameraSettings.maxDist;
    this.invertKeyboardPitch = defaultCameraSettings.invertPitch;
    this._settingsUnsubscribe = null;

    this._handleKeyDown = (event) => {
      if (!event || typeof event.code !== "string") return;
      if (!KEY_CODES.includes(event.code)) return;
      this.keyboardState[event.code] = true;
    };
    this._handleKeyUp = (event) => {
      if (!event || typeof event.code !== "string") return;
      if (!KEY_CODES.includes(event.code)) return;
      this.keyboardState[event.code] = false;
    };
    this._handleBlur = this._handleBlur.bind(this);
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._handleKeyDown, true);
      window.addEventListener("keyup", this._handleKeyUp, true);
      window.addEventListener("blur", this._handleBlur, { passive: true });
    }

    this.applyCameraSettings(loadSettings());
    this._settingsUnsubscribe = subscribe((next) => {
      this.applyCameraSettings(next);
    });

    this.enabled = false;
    this.needsImmediateSnap = false;
    this.warnedMissingTarget = false;
    this.disposed = false;

    const initialEnabled = options.enabled ?? true;
    if (initialEnabled) {
      this.setEnabled(true);
      if (this.camera) {
        this.smoothedPosition.copy(this.camera.position);
      }
    }
  }

  _handleBlur() {
    this.clearKeyStates();
  }

  clearKeyStates() {
    if (this.keyStates) {
      Object.keys(this.keyStates).forEach((key) => {
        this.keyStates[key] = false;
      });
    }
    if (this.keyboardState) {
      for (const key of Object.keys(this.keyboardState)) {
        this.keyboardState[key] = false;
      }
    }
    if (this.keyOrbitState && this.keyOrbitState.keys) {
      const { keys } = this.keyOrbitState;
      for (const key of Object.keys(keys)) {
        keys[key] = false;
      }
      this.keyOrbitState.desiredYawDelta = 0;
      this.keyOrbitState.desiredPitchDelta = 0;
      if ("yaw" in this.keyOrbitState) this.keyOrbitState.yaw = 0;
      if ("pitch" in this.keyOrbitState) this.keyOrbitState.pitch = 0;
    }
    this.isDragging = false;
    if (this._pointerDelta && typeof this._pointerDelta.set === "function") {
      this._pointerDelta.set(0, 0);
    }
  }

  /**
   * @returns {number}
   */
  getYaw() {
    return this.currentYaw;
  }

  /**
   * @param {import("../state/settingsStore.ts").CameraSettings} settings
   */
  applyCameraSettings(settings) {
    const resolved = {
      ...defaultCameraSettings,
      ...(settings && typeof settings === "object" ? settings : {}),
    };

    const toNumber = (value, fallback) =>
      Number.isFinite(value) ? value : fallback;

    const prevEnabled = this.keyOrbit.enabled;

    this.arrowOrbitEnabled = !!resolved.enableArrowOrbit;
    this.keyOrbit.enabled = this.arrowOrbitEnabled;

    this.keyOrbit.yawSpeed = toNumber(
      resolved.yawSpeed,
      defaultCameraSettings.yawSpeed
    );
    this.keyOrbit.pitchSpeed = toNumber(
      resolved.pitchSpeed,
      defaultCameraSettings.pitchSpeed
    );
    this.keyOrbit.zoomSpeed = toNumber(
      resolved.zoomSpeed,
      defaultCameraSettings.zoomSpeed
    );
    this.keyOrbit.minPitch = toNumber(
      resolved.minPitch,
      defaultCameraSettings.minPitch
    );
    this.keyOrbit.maxPitch = toNumber(
      resolved.maxPitch,
      defaultCameraSettings.maxPitch
    );
    this.keyOrbit.minDist = Math.max(
      0.1,
      toNumber(resolved.minDist, defaultCameraSettings.minDist)
    );
    this.keyOrbit.maxDist = Math.max(
      this.keyOrbit.minDist,
      toNumber(resolved.maxDist, defaultCameraSettings.maxDist)
    );
    this.keyOrbit.invertPitch = !!resolved.invertPitch;

    this.keyboardYawSpeed = this.keyOrbit.yawSpeed;
    this.keyboardPitchSpeed = this.keyOrbit.pitchSpeed;
    this.keyboardZoomSpeed = this.keyOrbit.zoomSpeed;
    this.invertKeyboardPitch = this.keyOrbit.invertPitch;

    this.minDistance = this.keyOrbit.minDist;
    this.maxDistance = this.keyOrbit.maxDist;
    this.distance = THREE.MathUtils.clamp(
      this.distance,
      this.minDistance,
      this.maxDistance
    );

    if (this.enabled) {
      if (this.keyOrbit.enabled && !prevEnabled) {
        this.attachKeyOrbit();
      } else if (!this.keyOrbit.enabled && prevEnabled) {
        this.detachKeyOrbit();
      }
    }
  }

  /**
   * @returns {number}
   */
  getPitch() {
    return this.currentPitch;
  }

  /**
   * @returns {number}
   */
  getTargetYaw() {
    return this.targetYaw;
  }

  /**
   * @returns {number}
   */
  getTargetPitch() {
    return this.targetPitch;
  }

  /**
   * @param {number} yaw
   * @param {number} pitch
   * @param {Object} [opts]
   * @param {boolean} [opts.snap]
   */
  setAngles(yaw, pitch, opts = {}) {
    if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return;
    const snap = opts.snap ?? true;

    this.targetYaw = wrapAngle(yaw);
    this.targetPitch = THREE.MathUtils.clamp(pitch, this.minPitch, this.maxPitch);

    if (snap) {
      this.currentYaw = this.targetYaw;
      this.currentPitch = this.targetPitch;
      this.needsImmediateSnap = true;
    }
  }

  /**
   * @param {boolean} value
   */
  setEnabled(value) {
    const nextEnabled = !!value && !this.disposed;
    if (nextEnabled === this.enabled) return;

    this.enabled = nextEnabled;
    if (!this.enabled) {
      this.clearKeyStates();
    }
    if (this.enabled) {
      this.needsImmediateSnap = true;
      this.warnedMissingTarget = false;
      this.attachKeyOrbit();
    }
    if (!this.enabled) {
      this.detachKeyOrbit();
    }
  }

  /**
   * Update camera position and orientation.
   * @param {number} dt
   */
  update(dt) {
    if (!this.enabled || this.disposed) return;
    if (!this.camera) return;

    const target = this.targetObject;
    if (!isObject3D(target)) {
      if (!this.warnedMissingTarget) {
        console.warn("[ThirdPersonCamera] Missing target object; update skipped.");
        this.warnedMissingTarget = true;
      }
      return;
    }

    target.updateWorldMatrix(true, false);
    target.getWorldPosition(_tmpTarget);
    _tmpTarget.add(this.targetOffset);

    const dtSafe = Number.isFinite(dt) ? Math.max(0, dt) : 0;

    if (this.keyOrbit.enabled) {
      this.updateKeyOrbit(dtSafe);
    }

    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, this.minPitch, this.maxPitch);
    this.distance = THREE.MathUtils.clamp(this.distance, this.minDistance, this.maxDistance);

    const rotationAlpha = dtSafe > 0
      ? 1 - Math.pow(1 - this.rotationLerp, dtSafe * 60)
      : this.rotationLerp;
    const followAlpha = dtSafe > 0
      ? 1 - Math.pow(1 - this.followLerp, dtSafe * 60)
      : this.followLerp;

    const clampedRot = THREE.MathUtils.clamp(rotationAlpha, 0, 1);
    const clampedFollow = THREE.MathUtils.clamp(followAlpha, 0, 1);

    this.currentYaw = lerpAngle(this.currentYaw, this.targetYaw, clampedRot);
    this.currentPitch = THREE.MathUtils.lerp(
      this.currentPitch,
      this.targetPitch,
      clampedRot
    );

    const horizontal = Math.cos(this.currentPitch) * this.distance;
    _tmpOffset.set(
      Math.sin(this.currentYaw) * horizontal,
      Math.sin(this.currentPitch) * this.distance,
      -Math.cos(this.currentYaw) * horizontal
    );

    this.desiredPosition.copy(_tmpTarget).add(_tmpOffset);

    const direction = _tmpDirection
      .copy(this.desiredPosition)
      .sub(_tmpTarget);
    const distance = direction.length();
    if (distance > 1e-6) {
      direction.multiplyScalar(1 / distance);
    } else {
      direction.set(0, 0, -1);
    }

    let maxDistance = distance;
    if (maxDistance < this.collisionOffset) {
      maxDistance = this.collisionOffset;
    }

    if (this.solids.length > 0) {
      this.raycaster.near = 0;
      this.raycaster.far = maxDistance;
      this.raycaster.set(_tmpTarget, direction);
      this.intersections.length = 0;
      this.raycaster.intersectObjects(this.solids, true, this.intersections);
      if (this.intersections.length > 0) {
        const hit = this.intersections[0];
        const safeDistance = Math.max(
          0,
          Math.min(hit.distance - this.collisionOffset, maxDistance)
        );
        _tmpCollision.copy(_tmpTarget).addScaledVector(direction, safeDistance);
      } else {
        _tmpCollision.copy(this.desiredPosition);
      }
    } else {
      _tmpCollision.copy(this.desiredPosition);
    }

    if (this.needsImmediateSnap) {
      this.smoothedPosition.copy(_tmpCollision);
      this.needsImmediateSnap = false;
    } else {
      this.smoothedPosition.lerp(_tmpCollision, clampedFollow);
    }

    this.lookTarget.copy(_tmpTarget);
    this.camera.position.copy(this.smoothedPosition);
    this.camera.lookAt(this.lookTarget);
  }

  /**
   * @param {number} deltaX
   * @param {number} deltaY
   */
  handlePointer(deltaX, deltaY) {
    if (!this.enabled || this.disposed) return;
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;

    const yaw = this.targetYaw - deltaX * this.yawSensitivity;
    const pitch = this.targetPitch - deltaY * this.pitchSensitivity;

    this.targetYaw = wrapAngle(yaw);
    this.targetPitch = THREE.MathUtils.clamp(pitch, this.minPitch, this.maxPitch);
  }

  /**
   * @param {boolean} value
   */
  dispose() {
    this.setEnabled(false);
    this.solids.length = 0;
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._handleKeyDown, true);
      window.removeEventListener("keyup", this._handleKeyUp, true);
      window.removeEventListener("blur", this._handleBlur);
    }
    this.clearKeyStates();
    if (typeof this._settingsUnsubscribe === "function") {
      this._settingsUnsubscribe();
      this._settingsUnsubscribe = null;
    }
    this.disposed = true;
  }

  // ArrowKeyOrbit: determine if keyboard events should be handled
  shouldHandleKeyOrbitEvent(event) {
    if (!this.keyOrbit.enabled) return false;
    if (!this.enabled || this.disposed) return false;
    if (!event) return false;
    if (typeof document !== "undefined" && document.pointerLockElement && !this.enabled) {
      return false;
    }
    return true;
  }

  // ArrowKeyOrbit: prevent default browser behaviour only when active
  shouldConsumeKeyOrbit() {
    if (!this.keyOrbit.enabled) return false;
    if (!this.enabled || this.disposed) return false;
    if (typeof document !== "undefined" && document.pointerLockElement && !this.enabled) {
      return false;
    }
    return true;
  }

  // ArrowKeyOrbit: attach keyboard listeners when enabled
  attachKeyOrbit() {
    if (!this.keyOrbit.enabled) return;
    if (this.keyOrbitHandlersAttached) return;
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.keyOrbitHandlersAttached = true;
  }

  // ArrowKeyOrbit: detach keyboard listeners
  detachKeyOrbit() {
    if (!this.keyOrbitHandlersAttached) return;
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
    }
    this.keyOrbitHandlersAttached = false;
    this.keyOrbitState.desiredYawDelta = 0;
    this.keyOrbitState.desiredPitchDelta = 0;
    const { keys } = this.keyOrbitState;
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
    keys.pageUp = false;
    keys.pageDown = false;
  }

  // ArrowKeyOrbit: smooth keyboard-driven yaw/pitch/zoom updates
  updateKeyOrbit(dt) {
    if (dt <= 0) return;
    const state = this.keyOrbitState;
    const { keys } = state;
    const yawInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const invert = this.keyOrbit.invertPitch ? -1 : 1;
    const pitchInput = ((keys.up ? 1 : 0) - (keys.down ? 1 : 0)) * invert;
    const zoomInput = (keys.pageDown ? 1 : 0) - (keys.pageUp ? 1 : 0);

    const yawStep = yawInput * this.keyOrbit.yawSpeed * dt;
    const pitchStep = pitchInput * this.keyOrbit.pitchSpeed * dt;

    if (yawStep !== 0) {
      this.targetYaw = wrapAngle(this.targetYaw + yawStep);
    }
    if (pitchStep !== 0) {
      const minPitch = Math.max(this.minPitch, this.keyOrbit.minPitch);
      const maxPitch = Math.min(this.maxPitch, this.keyOrbit.maxPitch);
      const nextPitch = this.targetPitch + pitchStep;
      this.targetPitch = THREE.MathUtils.clamp(nextPitch, minPitch, maxPitch);
    }

    if (zoomInput !== 0) {
      const zoomDelta = zoomInput * this.keyOrbit.zoomSpeed * dt;
      const minDist = Math.max(0.1, this.keyOrbit.minDist);
      const maxDist = Math.max(minDist, this.keyOrbit.maxDist);
      this.distance = THREE.MathUtils.clamp(
        this.distance + zoomDelta,
        minDist,
        maxDist
      );
    } else {
      const minDist = Math.max(0.1, this.keyOrbit.minDist);
      const maxDist = Math.max(minDist, this.keyOrbit.maxDist);
      this.distance = THREE.MathUtils.clamp(this.distance, minDist, maxDist);
    }
  }

  resetBehindTarget() {
    if (!this.enabled || this.disposed) return;

    const facingYaw = getTargetFacingYaw(this.targetObject);
    if (!Number.isFinite(facingYaw)) return;

    this.targetYaw = wrapAngle(facingYaw - Math.PI);
    this.currentYaw = this.targetYaw;
    this.needsImmediateSnap = true;
  }
}

/*
Testing checklist:
- Mouse/touch drag rotates the camera smoothly around the player.
- Walk the player up to a wall; the camera should slide forward without clipping.
- Press V to toggle between first- and third-person.
- Watch the console for errors and confirm no per-frame allocations occur (no GC thrash).
*/
