import type { BufferGeometry, Material, Mesh, ShaderMaterial } from 'three';
import type { IUniform } from 'three';

export type UniformMap = Record<string, IUniform>;

export type TypedShaderMaterial<TUniforms extends UniformMap> = ShaderMaterial & {
  uniforms: TUniforms;
};

export type TypedMesh<
  TGeometry extends BufferGeometry = BufferGeometry,
  TMaterial extends Material | Material[] = Material
> = Mesh<TGeometry, TMaterial>;
