import type {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  Vector2,
} from "three";
import type { TypedMesh } from "@app/types/global";
import type { HeightSampler } from "@app/types";

export interface TerrainHeightProvider extends Object3D {
  userData: Object3D["userData"] & {
    getHeightAt?: HeightSampler;
  };
}

export type DepthOccluderMesh = TypedMesh<BufferGeometry, MeshStandardMaterial> & {
  name: "WaterDepthOccluderRibbon";
  userData: Mesh["userData"] & { noCollision?: boolean };
};

export function addDepthOccluderRibbon(
  scene: Scene,
  terrain: TerrainHeightProvider | null,
  p1XZ: Vector2,
  p2XZ: Vector2,
  width?: number,
  segments?: number
): DepthOccluderMesh | null;
