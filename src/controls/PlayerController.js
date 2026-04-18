import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

const UP = new THREE.Vector3(0, 1, 0);

export class PlayerController {
  /**
   * @param {import('../input/InputMap').InputMap} input
   * @param {import('../env/EnvironmentCollider.js').EnvironmentCollider} env
   * @param {Object} [opts]
   * @param {number} [opts.height]
   * @param {number} [opts.radius]
   * @param {THREE.Camera} [opts.camera]
   * @param {function(number, number)|null} [opts.terrainHeightSampler]
   * @param {number} [opts.terrainSnapMaxDistance]
   * @param {number} [opts.terrainSnapThreshold]
   */
  constructor(input, env, opts = {}) {
    opts = opts ?? {};
    this.object = new THREE.Object3D();
    this.object.userData.noCollision = true;

    this.moveSpeed = 4.0;
    this.sprintMult = 1.8;
    this.gravity = 12.0;
    this.jumpSpeed = 5.0;
    this.slopeLimit = 50;

    this.input = input;
    this.env = env;
    this.camera = opts.camera;
    this.terrainHeightSampler =
      typeof opts.terrainHeightSampler === "function"
        ? opts.terrainHeightSampler
        : null;
    this.terrainSnapMaxDistance = Math.max(
      Number.isFinite(opts.terrainSnapMaxDistance)
        ? opts.terrainSnapMaxDistance
        : 1.2,
      0,
    );
    this.terrainSnapThreshold = Math.max(
      Number.isFinite(opts.terrainSnapThreshold)
        ? opts.terrainSnapThreshold
        : 0.005,
      0,
    );

    this.height = opts.height ?? 1.8;
    this.radius = opts.radius ?? 0.35;

    this.cameraYaw = 0;
    this.cameraPitch = THREE.MathUtils.degToRad(-15);
    this.cameraMinPitch = THREE.MathUtils.degToRad(-80);
    this.cameraMaxPitch = THREE.MathUtils.degToRad(60);
    this.cameraDistance = 6;
    this.cameraTargetHeight = this.height * 0.6;
    this.cameraDamping = 10;
    this.cameraTarget = new THREE.Vector3();
    this.cameraDesired = new THREE.Vector3();
    this.cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.cameraOffset = new THREE.Vector3();

    const topOffset = this.height - this.radius;
    this.capsule = new Capsule(
      new THREE.Vector3(0, this.radius, 0),
      new THREE.Vector3(0, topOffset, 0),
      this.radius
    );

    this.object.position.set(0, this.height * 0.5, 0);
    this.syncCapsuleToObject();

    this.velocity = new THREE.Vector3();
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.grounded = false;
    this.jumpLocked = false;

    this.flying = true;
    this.flySpeed = 8.0;
    this.flyIdleDecay = 0.9;

    this.character = undefined;

    this.desired = new THREE.Vector3();
    this.tmpVec = new THREE.Vector3();
    this.tmpVec2 = new THREE.Vector3();
    this.tmpVec3 = new THREE.Vector3();
    this.tmpVec4 = new THREE.Vector3();
    this.tmpVecSnap = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();

    this.groundDamping = 16;
    this.airDamping = 6;
  }

  get position() {
    return this.object.position;
  }

  /**
   * @param {import('../characters/Character.js').Character} char
   */
  attachCharacter(char) {
    this.character = char;
    this.object.add(char);
    char.position.set(0, 0, 0);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    const toggledFly =
      typeof this.input.consumeFlyToggle === 'function'
        ? this.input.consumeFlyToggle()
        : false;
    if (toggledFly) {
      this.flying = !this.flying;
      this.grounded = false;
      this.velocity.y = 0;
      if (!this.flying) {
        this.jumpLocked = true;
      }
    }

    const lookDelta = this.input.consumeLookDelta(dt);
    if (this.camera) {
      this.cameraYaw -= lookDelta.yaw;
      this.cameraPitch -= lookDelta.pitch;
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch,
        this.cameraMinPitch,
        this.cameraMaxPitch
      );
      if (!Number.isFinite(this.cameraYaw)) this.cameraYaw = 0;
      this.cameraYaw = THREE.MathUtils.euclideanModulo(this.cameraYaw + Math.PI, Math.PI * 2) - Math.PI;
    }

    const sprinting = this.input.sprint;
    const baseSpeed = this.flying ? this.flySpeed : this.moveSpeed;
    const speed = baseSpeed * (sprinting ? this.sprintMult : 1);

    this.computeDesiredVelocity(speed, this.flying);

    const damping = this.flying || !this.grounded ? this.airDamping : this.groundDamping;
    this.velocity.x = THREE.MathUtils.damp(
      this.velocity.x,
      this.desired.x,
      damping,
      dt
    );
    this.velocity.z = THREE.MathUtils.damp(
      this.velocity.z,
      this.desired.z,
      damping,
      dt
    );

    if (this.flying) {
      this.velocity.y = THREE.MathUtils.damp(
        this.velocity.y,
        this.desired.y,
        this.airDamping,
        dt
      );
    }

    if (this.desired.lengthSq() === 0) {
      if (this.flying) {
        const decay = Math.pow(this.flyIdleDecay, dt);
        this.velocity.multiplyScalar(decay);
      } else {
        const friction = this.grounded ? 0.85 : 0.95;
        const decay = Math.pow(friction, dt);
        this.velocity.x *= decay;
        this.velocity.z *= decay;
      }
    }

    if (!this.flying) {
      if (this.grounded && this.input.jump && !this.jumpLocked) {
        this.velocity.y = this.jumpSpeed;
        this.grounded = false;
        this.jumpLocked = true;
      }

      if (!this.input.jump) {
        this.jumpLocked = false;
      }

      if (!this.grounded) {
        this.velocity.y -= this.gravity * dt;
      }
    } else if (!this.input.flyUp) {
      this.jumpLocked = false;
    }

    const delta = this.tmpVec.copy(this.velocity).multiplyScalar(dt);
    this.capsule.translate(delta);
    this.resolveCollisions(dt);
    this.applyTerrainSnap();

    const center = this.getCapsuleCenter(this.tmpVec);
    this.object.position.copy(center);

    this.updateCamera(dt);

    if (this.character) {
      const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      const EPS = 0.05;
      const yawFacing = Math.atan2(this.velocity.x, this.velocity.z);
      if (horizontalSpeed > EPS) {
        this.character.rotation.y = yawFacing;
      }

      const runThreshold = this.moveSpeed * 1.5;
      const swaggerThreshold = this.moveSpeed * 0.8;

      if (this.flying) {
        this.character.play('Jump', 0.1);
      } else if (!this.grounded) {
        this.character.play('Jump', 0.1);
      } else if (horizontalSpeed > runThreshold) {
        this.character.play('Run', 0.1);
      } else if (horizontalSpeed > swaggerThreshold) {
        this.character.play('Swagger', 0.1);
      } else if (horizontalSpeed > 0.1) {
        this.character.play('Walk', 0.15);
      } else {
        this.character.play('Idle', 0.2);
      }

      this.character.update(dt);
    }
  }

  /**
   * @param {number} speed
   */
  computeDesiredVelocity(speed, allowVertical = false) {
    this.desired.set(0, 0, 0);

    const dirX = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const dirZ = (this.input.forward ? 1 : 0) - (this.input.back ? 1 : 0);
    const dirY = allowVertical
      ? (this.input.flyUp ? 1 : 0) - (this.input.flyDown ? 1 : 0)
      : 0;

    if (dirX !== 0 || dirZ !== 0) {
      this.tmpVec2.set(dirX, 0, dirZ).normalize();

      if (this.camera) {
        this.tmpQuat.setFromEuler(
          this.cameraEuler.set(this.cameraPitch, this.cameraYaw, 0, 'YXZ')
        );
        const forward = this.tmpVec3.set(0, 0, -1).applyQuaternion(this.tmpQuat);
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) {
          forward.set(0, 0, -1);
        } else {
          forward.normalize();
        }

        const right = this.tmpVec.copy(forward).cross(UP);
        if (right.lengthSq() < 1e-6) {
          right.set(1, 0, 0);
        } else {
          right.normalize();
        }

        this.desired
          .copy(forward)
          .multiplyScalar(this.tmpVec2.z)
          .addScaledVector(right, this.tmpVec2.x);
      } else {
        this.desired.copy(this.tmpVec2);
      }
    }

    if (allowVertical && dirY !== 0) {
      this.desired.y = dirY;
    }

    if (this.desired.lengthSq() === 0) {
      return;
    }

    this.desired.normalize().multiplyScalar(speed);
  }

  updateCamera(dt) {
    if (!this.camera) return;

    this.cameraTarget.copy(this.object.position);
    this.cameraTarget.y += this.cameraTargetHeight;

    this.tmpQuat.setFromEuler(
      this.cameraEuler.set(this.cameraPitch, this.cameraYaw, 0, 'YXZ')
    );

    this.cameraOffset.set(0, 0, this.cameraDistance).applyQuaternion(this.tmpQuat);
    this.cameraDesired.copy(this.cameraTarget).add(this.cameraOffset);

    if (!Number.isFinite(dt) || dt <= 0) {
      this.camera.position.copy(this.cameraDesired);
    } else {
      const t = 1 - Math.exp(-this.cameraDamping * dt);
      this.camera.position.lerp(this.cameraDesired, t);
    }

    this.camera.lookAt(this.cameraTarget);
  }

  applyTerrainSnap() {
    if (this.flying) return;

    const sampler = this.terrainHeightSampler;
    if (typeof sampler !== "function") return;

    const center = this.getCapsuleCenter(this.tmpVecSnap);
    const groundHeight = sampler(center.x, center.z);
    if (!Number.isFinite(groundHeight)) return;

    const halfHeight = this.height * 0.5;
    const capsuleBottom = this.capsule.start.y - this.capsule.radius;
    const penetration = groundHeight - capsuleBottom;

    if (
      penetration <= this.terrainSnapThreshold ||
      penetration > this.terrainSnapMaxDistance
    ) {
      return;
    }

    const targetCenterY = groundHeight + halfHeight;
    const deltaY = targetCenterY - center.y;
    if (Math.abs(deltaY) <= 1e-5) {
      return;
    }

    this.tmpVecSnap.set(0, deltaY, 0);
    this.capsule.translate(this.tmpVecSnap);
    if (this.velocity.y < 0) {
      this.velocity.y = 0;
    }
    this.grounded = true;
    this.groundNormal.set(0, 1, 0);
  }

  resolveCollisions(dt) {
    const collider = this.env;

    const allowGrounding = !this.flying;
    this.grounded = false;
    let slopeNormal = null;

    if (collider?.capsuleIntersect) {
      // Perform a downward raycast from the capsule's center to detect ground.
      // This provides a more reliable ground detection than just capsule intersection.
      const center = this.getCapsuleCenter(this.tmpVec3);
      const ray = new THREE.Ray(center, new THREE.Vector3(0, -1, 0));
      const hit = collider.boundsTree ? collider.boundsTree.raycastFirst(ray) : null;

      let groundDistance = Infinity;
      if (hit) {
        groundDistance = center.y - hit.point.y;
      }

      for (let i = 0; i < 3; i++) {
        const result = collider.capsuleIntersect(this.capsule);
        if (!result) break;

        this.tmpVec.copy(result.normal).multiplyScalar(result.depth);
        this.capsule.translate(this.tmpVec);

        const normal = this.tmpVec2.copy(result.normal).normalize();
        const velDot = normal.dot(this.velocity);
        if (velDot < 0) {
          this.velocity.addScaledVector(normal, -velDot);
        }

        const cosSlope = THREE.MathUtils.clamp(normal.dot(UP), -1, 1);
        const slopeAngle = THREE.MathUtils.radToDeg(Math.acos(cosSlope));

        if (normal.y > 0) {
          if (slopeNormal === null) slopeNormal = this.tmpVec4;
          slopeNormal.copy(normal);
          if (allowGrounding && slopeAngle <= this.slopeLimit) {
            this.grounded = true;
            this.groundNormal.copy(normal);
          } else if (!allowGrounding) {
            this.groundNormal.copy(normal);
          }
        }
      }

      // If the raycast found ground nearby, and we're not flying, consider us grounded.
      if (groundDistance < (this.height * 0.5 + 0.1) && allowGrounding) {
        this.grounded = true;
      }

    } else {
      const center = this.getCapsuleCenter(this.tmpVec3);
      const minY = this.height * 0.5;
      if (center.y < minY) {
        this.tmpVec.set(0, minY - center.y, 0);
        this.capsule.translate(this.tmpVec);
        if (this.velocity.y < 0) this.velocity.y = 0;
        if (allowGrounding) {
          this.grounded = true;
        }
        this.groundNormal.set(0, 1, 0);
      }
    }

    if (allowGrounding && this.grounded) {
      if (this.velocity.y < 0) this.velocity.y = 0;
      const cosSlope = THREE.MathUtils.clamp(this.groundNormal.dot(UP), -1, 1);
      const angle = THREE.MathUtils.radToDeg(Math.acos(cosSlope));
      if (angle > this.slopeLimit) {
        this.grounded = false;
      }
    }

    if (allowGrounding && !this.grounded && slopeNormal) {
      const slide = this.tmpVec.copy(slopeNormal).projectOnPlane(UP);
      if (slide.lengthSq() > 1e-6) {
        slide.normalize();
        this.velocity.addScaledVector(slide, this.gravity * dt);
      }
      this.groundNormal.copy(slopeNormal);
    }

    if (allowGrounding && !this.grounded && this.velocity.y > 0 && slopeNormal) {
      const normal = slopeNormal;
      const velDot = normal.dot(this.velocity);
      if (velDot < 0) {
        this.velocity.addScaledVector(normal, -velDot);
      }
    }

    if (!this.grounded && !slopeNormal) {
      this.groundNormal.set(0, 1, 0);
    }
  }

  syncCapsuleToObject() {
    const center = this.object.position;
    const halfHeight = this.height * 0.5;
    this.capsule.start.set(
      center.x,
      center.y - halfHeight + this.radius,
      center.z
    );
    this.capsule.end.set(
      center.x,
      center.y + halfHeight - this.radius,
      center.z
    );
  }

  /**
   * @param {THREE.Vector3} target
   */
  getCapsuleCenter(target) {
    return target
      .copy(this.capsule.start)
      .add(this.capsule.end)
      .multiplyScalar(0.5);
  }
}

export default PlayerController;
