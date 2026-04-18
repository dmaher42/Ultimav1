import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Safe registration (idempotent)
if (
  THREE.Mesh &&
  typeof THREE.Mesh.prototype.raycast === "function" &&
  !THREE.Mesh.prototype.__bvhRaycastPatched
) {
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  THREE.Mesh.prototype.__bvhRaycastPatched = true;
}

const EPSILON = 1e-6;
const _instanceMatrix = new THREE.Matrix4();
const _worldInstanceMatrix = new THREE.Matrix4();

export class EnvironmentCollider {
  constructor() {
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      color: 0x00ff99,
    });

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.name = 'EnvironmentCollider';
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.userData.noCollision = true;

    this.lastRoot = null;
    this.positionAttr = null;
    this.indexAttr = null;
    this.boundsTree = null;
    this.capsuleBox = new THREE.Box3();
    this.triangleBox = new THREE.Box3();
    this.triangle = new THREE.Triangle();
    this.plane = new THREE.Plane();
    this.capsuleSegment = new THREE.Line3();

    this.tmpVec0 = new THREE.Vector3();
    this.tmpVec1 = new THREE.Vector3();
    this.tmpVec2 = new THREE.Vector3();
    this.tmpVec3 = new THREE.Vector3();
    this.tmpVec4 = new THREE.Vector3();
    this.tmpVec5 = new THREE.Vector3();
    this.tmpVec6 = new THREE.Vector3();
    this.tmpVec7 = new THREE.Vector3();
    this.tmpVec8 = new THREE.Vector3();
    this.tmpVec9 = new THREE.Vector3();
    this.tmpNormal = new THREE.Vector3();
    this.segPoint = new THREE.Vector3();
    this.triPoint = new THREE.Vector3();
  }

  /**
   * @param {THREE.Object3D} root
   * @param {Object} [opts]
   * @param {boolean} [opts.debug]
   */
  fromStaticScene(root, opts = {}) {
    const source =
      root ?? this.lastRoot ?? (this.mesh ? this.mesh.parent : null);

    if (!source || typeof source.traverse !== "function") {
      return;
    }

    const geometries = [];
    source.updateWorldMatrix(true, true);

    const material = this.mesh.material;
    material.visible = !!opts.debug;

    this.lastRoot = source;

    const shouldInclude = (node) => {
      let current = node;
      while (current) {
        if (current.userData?.noCollision === true) {
          return false;
        }
        current = current.parent;
      }
      return true;
    };

    const pushGeometry = (geometry, matrix) => {
      if (!geometry || !geometry.attributes || !geometry.attributes.position)
        return;

      const src = geometry.index ? geometry.toNonIndexed() : geometry;
      const posAttr = src.getAttribute('position');
      if (!posAttr) return;

      const clean = new THREE.BufferGeometry();
      clean.setAttribute('position', posAttr.clone());
      clean.setIndex(null);
      clean.applyMatrix4(matrix);
      clean.computeBoundingBox();
      clean.computeBoundingSphere();

      geometries.push(clean);
    };

    source.traverse((child) => {
      if (!child.isMesh) return;
      if (child === this.mesh) return;

      const mesh = child;
      if (!shouldInclude(mesh)) return;
      const geometry = mesh.geometry;
      if (!geometry || !geometry.attributes.position) return;
      if (!mesh.visible) return;

      if (mesh.isInstancedMesh) {
        const count = mesh.count ?? 0;
        if (count === 0) return;

        for (let i = 0; i < count; i++) {
          mesh.getMatrixAt(i, _instanceMatrix);
          _worldInstanceMatrix.multiplyMatrices(mesh.matrixWorld, _instanceMatrix);
          pushGeometry(geometry, _worldInstanceMatrix);
        }
        return;
      }

      pushGeometry(geometry, mesh.matrixWorld);
    });

    let merged = new THREE.BufferGeometry();
    if (geometries.length > 0) {
      const combined = mergeGeometries(geometries, false);
      if (combined) {
        merged = combined;
      }
    }

    geometries.forEach((geom) => geom.dispose());

    const oldGeometry = this.mesh.geometry;
    if (this.boundsTree) {
      try {
        if (typeof this.boundsTree.dispose === "function") {
          this.boundsTree.dispose();
        } else if (typeof this.boundsTree.release === "function") {
          // Older builds exposed release() instead of dispose().
          this.boundsTree.release();
        }
      } catch (err) {
        console.warn("EnvironmentCollider boundsTree dispose skipped", err);
      }
      this.boundsTree = null;
    }

    if (oldGeometry) oldGeometry.dispose();

    this.mesh.geometry = merged;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    this.positionAttr = merged.getAttribute('position');
    this.indexAttr = merged.getIndex();

    if (this.positionAttr && this.positionAttr.count > 0) {
      try {
        this.boundsTree = new MeshBVH(merged, { lazyGeneration: false, maxDepth: 64 });
      } catch (err) {
        console.warn('Failed to build environment bounds tree', err);
        this.boundsTree = null;
      }
    }
  }

  refresh(opts = {}) {
    this.fromStaticScene(undefined, opts);
  }

  /**
   * @param {import('three/examples/jsm/math/Capsule.js').Capsule} capsule
   * @returns {Object|null} hit result with normal and depth properties
   */
  capsuleIntersect(capsule) {
    const geometry = this.mesh.geometry;
    const position = this.positionAttr;
    if (!geometry || !position || position.count === 0) return null;

    const boundingBox = geometry.boundingBox;
    if (!boundingBox) return null;

    this.capsuleSegment.set(capsule.start, capsule.end);
    this.capsuleBox.makeEmpty();
    this.capsuleBox.expandByPoint(capsule.start);
    this.capsuleBox.expandByPoint(capsule.end);
    this.capsuleBox.min.addScalar(-capsule.radius);
    this.capsuleBox.max.addScalar(capsule.radius);

    if (!boundingBox.intersectsBox(this.capsuleBox)) return null;

    let bestDepth = 0;
    const bestNormal = this.tmpVec3;
    let hasHit = false;

    const processTriangle = (a, b, c) => {
      const triA = this.tmpVec6.copy(a);
      const triB = this.tmpVec7.copy(b);
      const triC = this.tmpVec8.copy(c);

      this.triangleBox.makeEmpty();
      this.triangleBox.expandByPoint(triA);
      this.triangleBox.expandByPoint(triB);
      this.triangleBox.expandByPoint(triC);
      this.triangleBox.min.addScalar(-capsule.radius);
      this.triangleBox.max.addScalar(capsule.radius);

      if (!this.triangleBox.intersectsBox(this.capsuleBox)) {
        return;
      }

      this.triangle.set(triA, triB, triC);

      const distance = this.closestPointsSegmentTriangle(
        this.capsuleSegment,
        this.triangle,
        this.segPoint,
        this.triPoint
      );

      if (distance === null) return;

      if (distance < capsule.radius - EPSILON) {
        const depth = capsule.radius - distance;
        if (depth > bestDepth) {
          bestDepth = depth;

          this.tmpNormal.subVectors(this.segPoint, this.triPoint);
          if (this.tmpNormal.lengthSq() < EPSILON) {
            this.triangle.getNormal(this.tmpNormal);
          } else {
            this.tmpNormal.normalize();
          }

          bestNormal.copy(this.tmpNormal);
          hasHit = true;
        }
      }
    };

    if (this.boundsTree) {
      this.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(this.capsuleBox),
        intersectsTriangle: (triangle) => {
          processTriangle(triangle.a, triangle.b, triangle.c);
          return false;
        },
      });
    } else {
      const index = this.indexAttr;
      const v0 = this.tmpVec0;
      const v1 = this.tmpVec1;
      const v2 = this.tmpVec2;

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          v0.fromBufferAttribute(position, index.getX(i));
          v1.fromBufferAttribute(position, index.getX(i + 1));
          v2.fromBufferAttribute(position, index.getX(i + 2));
          processTriangle(v0, v1, v2);
        }
      } else {
        for (let i = 0; i < position.count; i += 3) {
          v0.fromBufferAttribute(position, i);
          v1.fromBufferAttribute(position, i + 1);
          v2.fromBufferAttribute(position, i + 2);
          processTriangle(v0, v1, v2);
        }
      }
    }

    if (!hasHit) return null;

    return {
      normal: bestNormal.clone(),
      depth: bestDepth,
    };
  }

  closestPointsSegmentTriangle(segment, triangle, segPoint, triPoint) {
    const a = triangle.a;
    const b = triangle.b;
    const c = triangle.c;

    this.tmpVec4.subVectors(b, a);
    this.tmpVec5.subVectors(c, a);
    const normal = this.tmpVec6.copy(this.tmpVec4).cross(this.tmpVec5);
    if (normal.lengthSq() < EPSILON) {
      return null;
    }

    this.plane.setFromCoplanarPoints(a, b, c);

    const startDist = this.plane.distanceToPoint(segment.start);
    const endDist = this.plane.distanceToPoint(segment.end);

    const dir = this.tmpVec7.subVectors(segment.end, segment.start);

    if (Math.abs(startDist - endDist) > EPSILON) {
      const t = startDist / (startDist - endDist);
      if (t >= 0 && t <= 1) {
        segPoint.copy(dir).multiplyScalar(t).add(segment.start);
        if (triangle.containsPoint(segPoint)) {
          triPoint.copy(segPoint);
          return 0;
        }
      }
    }

    let bestDistance = Infinity;

    triangle.closestPointToPoint(segment.start, this.tmpVec8);
    let dist = this.tmpVec8.distanceTo(segment.start);
    if (dist < bestDistance) {
      bestDistance = dist;
      segPoint.copy(segment.start);
      triPoint.copy(this.tmpVec8);
    }

    triangle.closestPointToPoint(segment.end, this.tmpVec8);
    dist = this.tmpVec8.distanceTo(segment.end);
    if (dist < bestDistance) {
      bestDistance = dist;
      segPoint.copy(segment.end);
      triPoint.copy(this.tmpVec8);
    }

    bestDistance = this.testEdgeDistance(
      segment,
      a,
      b,
      bestDistance,
      segPoint,
      triPoint
    );

    bestDistance = this.testEdgeDistance(
      segment,
      b,
      c,
      bestDistance,
      segPoint,
      triPoint
    );

    bestDistance = this.testEdgeDistance(
      segment,
      c,
      a,
      bestDistance,
      segPoint,
      triPoint
    );

    return bestDistance;
  }

  testEdgeDistance(segment, edgeStart, edgeEnd, currentBest, segPoint, triPoint) {
    const dist = this.closestPointsSegmentSegment(
      segment.start,
      segment.end,
      edgeStart,
      edgeEnd,
      this.tmpVec8,
      this.tmpVec9
    );

    if (dist < currentBest) {
      currentBest = dist;
      segPoint.copy(this.tmpVec8);
      triPoint.copy(this.tmpVec9);
    }

    return currentBest;
  }

  closestPointsSegmentSegment(p1, q1, p2, q2, target1, target2) {
    const d1 = this.tmpVec4.subVectors(q1, p1);
    const d2 = this.tmpVec5.subVectors(q2, p2);
    const r = this.tmpVec6.subVectors(p1, p2);
    const a = d1.dot(d1);
    const e = d2.dot(d2);
    const f = d2.dot(r);
    const EPS = EPSILON;

    let s = 0;
    let t = 0;

    if (a <= EPS && e <= EPS) {
      target1.copy(p1);
      target2.copy(p2);
      return target1.distanceTo(target2);
    }

    if (a <= EPS) {
      s = 0;
      t = THREE.MathUtils.clamp(f / e, 0, 1);
    } else {
      const c = d1.dot(r);
      if (e <= EPS) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else {
        const b = d1.dot(d2);
        const denom = a * e - b * b;
        if (denom !== 0) {
          s = THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1);
        } else {
          s = 0;
        }
        t = (b * s + f) / e;

        if (t < 0) {
          t = 0;
          s = THREE.MathUtils.clamp(-c / a, 0, 1);
        } else if (t > 1) {
          t = 1;
          s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
        }
      }
    }

    target1.copy(d1).multiplyScalar(s).add(p1);
    target2.copy(d2).multiplyScalar(t).add(p2);
    return target1.distanceTo(target2);
  }
}

export default EnvironmentCollider;
