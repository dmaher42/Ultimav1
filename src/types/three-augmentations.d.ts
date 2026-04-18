import type { Color, Matrix4, ShaderMaterial, Texture, Vector3 } from 'three';
import type { UniformMap } from './global';

declare module 'three/examples/jsm/objects/Sky.js' {
  export interface SkyUniforms extends UniformMap {
    turbidity: import('three').IUniform<number>;
    rayleigh: import('three').IUniform<number>;
    mieCoefficient: import('three').IUniform<number>;
    mieDirectionalG: import('three').IUniform<number>;
    sunPosition: import('three').IUniform<Vector3>;
    up: import('three').IUniform<Vector3>;
  }

  export type SkyMaterial = ShaderMaterial & { uniforms: SkyUniforms };
}

declare module 'three/examples/jsm/objects/Water.js' {
  export interface WaterUniforms extends UniformMap {
    mirrorSampler: import('three').IUniform<Texture | null>;
    textureMatrix: import('three').IUniform<Matrix4>;
    normalSampler: import('three').IUniform<Texture | null>;
    alpha: import('three').IUniform<number>;
    time: import('three').IUniform<number>;
    size: import('three').IUniform<number>;
    distortionScale: import('three').IUniform<number>;
    sunColor: import('three').IUniform<Color>;
    sunDirection: import('three').IUniform<Vector3>;
    eye: import('three').IUniform<Vector3>;
    waterColor: import('three').IUniform<Color>;
  }

  export type WaterMaterial = ShaderMaterial & { uniforms: WaterUniforms };
}
