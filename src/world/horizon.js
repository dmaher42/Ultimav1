import * as THREE from "three";
import { getSeaLevelY } from "./seaLevelState.js";

const DEFAULT_HORIZON_RADIUS = 1700;
const DEFAULT_FADE_WIDTH = 320;
const SKYBOX_SEA_TINT = new THREE.Color(0x46719a);
const SKYBOX_SKY_BLEND = new THREE.Color(0x8cabca);

function resolveFogColor(scene) {
  const fallback = SKYBOX_SKY_BLEND.clone();
  if (scene?.fog?.color) {
    return scene.fog.color.clone();
  }
  const fogOptions = scene?.userData?.getFogOptions?.();
  if (fogOptions?.color) {
    return fogOptions.color.clone();
  }
  return fallback;
}

function createHorizonRing({
  innerRadius,
  outerRadius,
  seaLevel,
  horizonColor,
  fogColor,
  eastHeight,
  westHeight,
  westRadiusScale,
}) {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1);
  geometry.rotateX(-Math.PI / 2);

  const uniforms = {
    innerRadius: { value: innerRadius },
    outerRadius: { value: outerRadius },
    seaLevel: { value: seaLevel },
    horizonColor: { value: horizonColor.clone() },
    fogColor: { value: fogColor.clone() },
    eastHeight: { value: eastHeight },
    westHeight: { value: westHeight },
    westRadiusScale: { value: westRadiusScale },
  };

  const material = new THREE.ShaderMaterial({
    name: "SkyboxHorizonRing",
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      varying float vWestness;
      varying float vRadialMix;
      uniform float innerRadius;
      uniform float outerRadius;
      uniform float seaLevel;
      uniform float eastHeight;
      uniform float westHeight;
      uniform float westRadiusScale;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec2 xz = worldPosition.xz;
        float dist = length(xz);
        vec2 dir = dist > 0.0 ? (xz / dist) : vec2(0.0, 0.0);
        float angle = atan(dir.y, dir.x);
        float westness = smoothstep(0.0, 0.9, -dir.x);
        vWestness = westness;

        float radiusBlend = mix(1.0, westRadiusScale, westness);
        float dynamicInner = innerRadius * radiusBlend;
        float dynamicOuter = mix(outerRadius, outerRadius * westRadiusScale, westness);
        float radialFade = clamp((dist - dynamicInner) / max(dynamicOuter - dynamicInner, 0.0001), 0.0, 1.0);
        vRadialMix = radialFade;

        float broadForms = 0.78 + 0.18 * cos(angle * 1.4);
        float heightBias = mix(eastHeight, westHeight * broadForms, westness);
        float heightFalloff = 1.0 - pow(radialFade, 0.6);
        worldPosition.y = seaLevel + heightBias * heightFalloff;

        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPosition;
      varying float vWestness;
      varying float vRadialMix;
      uniform float innerRadius;
      uniform float outerRadius;
      uniform float seaLevel;
      uniform vec3 horizonColor;
      uniform vec3 fogColor;
      uniform float westRadiusScale;

      #define PI 3.14159265

      void main() {
        vec2 xz = vWorldPosition.xz;
        float dist = length(xz);
        vec2 dir = dist > 0.0 ? (xz / dist) : vec2(0.0, 0.0);
        float eastness = smoothstep(0.0, 0.9, dir.x);
        float westness = vWestness;

        float radiusBlend = mix(1.0, westRadiusScale, westness);
        float dynamicInner = innerRadius * radiusBlend;
        float dynamicOuter = mix(outerRadius, outerRadius * westRadiusScale, westness);
        float radialFade = clamp((dist - dynamicInner) / max(dynamicOuter - dynamicInner, 0.0001), 0.0, 1.0);

        float alpha = 1.0 - smoothstep(0.0, 1.0, radialFade);

        // Sea side stays light and low; land side fades softly into haze
        float directionalAlpha = mix(0.55, 1.0, eastness);
        alpha *= directionalAlpha;

        float skyFeather = smoothstep(0.52, 1.0, vRadialMix);
        alpha *= mix(1.0, 0.45, skyFeather * westness);

        // Gently fade out if the band is ever viewed from above sea level.
        float heightFade = smoothstep(seaLevel + 2.0, seaLevel + 14.0, vWorldPosition.y);
        alpha *= (1.0 - heightFade);

        if (alpha <= 0.01) {
          gl_FragColor = vec4(0.0);
          discard;
        }

        float skyBlend = smoothstep(0.35, 1.0, vRadialMix);
        vec3 color = mix(horizonColor, fogColor, skyBlend);
        float desaturate = westness * vRadialMix;
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(color, vec3(luma), desaturate * 0.55);
        color = mix(color, fogColor, westness * 0.5 * skyBlend);
        gl_FragColor = vec4(color, alpha * 0.82);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "HorizonFadeRing";
  mesh.renderOrder = -2;
  return mesh;
}

export function createHorizon(scene, options = {}) {
  const seaLevel = Number.isFinite(options.seaLevel)
    ? options.seaLevel
    : getSeaLevelY();
  const radius = Math.max(options.radius ?? DEFAULT_HORIZON_RADIUS, 400);
  const fadeWidth = Math.max(options.fadeWidth ?? DEFAULT_FADE_WIDTH, 80);
  const innerRadius = Math.max(radius - fadeWidth, 10);
  const outerRadius = radius + fadeWidth;

  const westHeight = Math.min(options.westHeight ?? 7.5, 12.0);
  const eastHeight = Math.max(options.eastHeight ?? 1.5, 0.0);
  const westRadiusScale = THREE.MathUtils.clamp(
    options.westRadiusScale ?? 1.85,
    1.0,
    2.05,
  );

  const fogColor = resolveFogColor(scene);
  const horizonColor = options.horizonColor
    ? new THREE.Color(options.horizonColor)
    : SKYBOX_SEA_TINT;

  const group = new THREE.Group();
  group.name = "HorizonSystem";

  const ring = createHorizonRing({
    innerRadius,
    outerRadius,
    seaLevel,
    horizonColor,
    fogColor,
    eastHeight,
    westHeight,
    westRadiusScale,
  });
  ring.position.y = seaLevel;
  group.add(ring);

  // Soften distance falloff to better match the painted sea line of the skybox.
  const setFogOptions = scene?.userData?.setFogOptions;
  if (typeof setFogOptions === "function") {
    setFogOptions({
      color: fogColor.lerp(horizonColor, 0.25),
      near: Math.max(scene?.fog?.near ?? 0, 180),
      far: Math.max(scene?.fog?.far ?? 0, outerRadius * 0.9),
    });
  }

  if (scene) {
    scene.add(group);
  }

  group.userData.horizonRadius = radius;
  group.userData.fadeWidth = fadeWidth;
  return group;
}
