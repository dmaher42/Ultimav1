import type {
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import type { HeightSampler } from "@app/types";
import type { TypedShaderMaterial, UniformMap } from "@app/types/global";

export interface GrassUniforms extends UniformMap {
  uTime: import("three").IUniform<number>;
  uWindDir: import("three").IUniform<Vector2>;
  uColor: import("three").IUniform<import("three").Color>;
  uNightFactor: import("three").IUniform<number>;
}

export type GrassMaterial = TypedShaderMaterial<GrassUniforms>;

export interface GrassTileGeometry extends InstancedBufferGeometry {
  attributes: InstancedBufferGeometry["attributes"] & {
    instanceOffset: InstancedBufferAttribute;
    instanceScale: InstancedBufferAttribute;
    instancePhase: InstancedBufferAttribute;
  };
}

export interface GrassTile {
  geometry: GrassTileGeometry;
  mesh: Mesh<GrassTileGeometry, GrassMaterial>;
  offsets: Float32Array;
  scales: Float32Array;
  phases: Float32Array;
  coord: Vector2;
}

export interface GrassState {
  root: Group;
  scene: Scene;
  material: GrassMaterial;
  tiles: GrassTile[];
  seed: number;
  heightSampler: HeightSampler | null;
  time: number;
  lastCenter: Vector2;
}

export type GrassPlayerPosition =
  | Vector3
  | { x?: number | null; y?: number | null; z?: number | null };

export function mount(scene: Scene | null | undefined): Group | null;
export function update(dt?: number, playerPosition?: GrassPlayerPosition | null): void;
export function setNightFactor(value?: number | null): void;
export function dispose(): void;
