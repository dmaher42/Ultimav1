import type {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Line3,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Plane,
  Triangle,
  Vector3,
} from "three";
import type { MeshBVH } from "three-mesh-bvh";
import type { Capsule } from "three/examples/jsm/math/Capsule.js";

export interface EnvironmentColliderOptions {
  debug?: boolean;
}

export interface CapsuleHitResult {
  normal: Vector3;
  depth: number;
}

export class EnvironmentCollider {
  constructor();
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  lastRoot: Object3D | null;
  positionAttr: BufferAttribute | null;
  indexAttr: BufferAttribute | null;
  boundsTree: MeshBVH | null;
  capsuleBox: Box3;
  triangleBox: Box3;
  triangle: Triangle;
  plane: Plane;
  capsuleSegment: Line3;
  tmpVec0: Vector3;
  tmpVec1: Vector3;
  tmpVec2: Vector3;
  tmpVec3: Vector3;
  tmpVec4: Vector3;
  tmpVec5: Vector3;
  tmpVec6: Vector3;
  tmpVec7: Vector3;
  tmpVec8: Vector3;
  tmpVec9: Vector3;
  tmpNormal: Vector3;
  segPoint: Vector3;
  triPoint: Vector3;
  fromStaticScene(root?: Object3D | null, opts?: EnvironmentColliderOptions): void;
  refresh(opts?: EnvironmentColliderOptions): void;
  capsuleIntersect(capsule: Capsule): CapsuleHitResult | null;
}

export default EnvironmentCollider;
