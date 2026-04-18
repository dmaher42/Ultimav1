import { Color, ShaderMaterial, Vector3 } from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const defaultShadowTint = new Color(0xf4f8ff);
const defaultHighlightTint = new Color(0xfff0df);
const neutralMidTint = new Color(0xffffff);

function colorToVector3(input) {
  const color = input instanceof Color ? input : new Color(input);
  return new Vector3(color.r, color.g, color.b);
}

export function createColorGradePass({
  contrastStrength = 0.18,
  saturationBoost = 0.04,
  shadowTint = defaultShadowTint,
  midTint = neutralMidTint,
  highlightTint = defaultHighlightTint,
} = {}) {
  const uniforms = {
    tDiffuse: { value: null },
    contrastStrength: { value: contrastStrength },
    saturationBoost: { value: saturationBoost },
    shadowTint: { value: colorToVector3(shadowTint) },
    midTint: { value: colorToVector3(midTint) },
    highlightTint: { value: colorToVector3(highlightTint) },
  };

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform float contrastStrength;
      uniform float saturationBoost;
      uniform vec3 shadowTint;
      uniform vec3 midTint;
      uniform vec3 highlightTint;

      float computeLuminance(vec3 color) {
        return dot(color, vec3(0.2126, 0.7152, 0.0722));
      }

      vec3 applySCurve(vec3 color, float strength) {
        vec3 curve = color * color * (3.0 - 2.0 * color);
        return mix(color, curve, strength);
      }

      vec3 applyTints(vec3 color) {
        float luma = computeLuminance(color);
        vec3 rangeTint = mix(shadowTint, highlightTint, smoothstep(0.32, 0.82, luma));
        vec3 mixTint = mix(midTint, rangeTint, 0.55);
        return color * mixTint;
      }

      vec3 applySaturation(vec3 color, float boost) {
        float luma = computeLuminance(color);
        vec3 gray = vec3(luma);
        return mix(gray, color, 1.0 + boost);
      }

      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec3 color = clamp(base.rgb, 0.0, 1.0);

        color = applySCurve(color, contrastStrength);
        color = applyTints(color);

        float luma = computeLuminance(color);
        float highlightGlow = smoothstep(0.58, 1.0, luma);
        color = mix(color, color * vec3(1.03, 0.995, 0.98), highlightGlow * 0.35);

        color = applySaturation(color, saturationBoost);

        gl_FragColor = vec4(color, base.a);
      }
    `,
  });

  return new ShaderPass(material, "tDiffuse");
}
