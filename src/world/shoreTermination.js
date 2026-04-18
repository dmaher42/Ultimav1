import * as THREE from "three";
import { getSeaLevelY } from "./seaLevelState.js";
import { HARBOR_CENTER_3D } from "./locations.js";
import { RENDER_LAYERS } from "./renderLayers.js";

const DEFAULT_COASTAL_INNER_RADIUS = 235;
const DEFAULT_COASTAL_WIDTH = 42;
const SKY_HORIZON_COLOR = new THREE.Color(0x35577c);
const SKY_BLEND_COLOR = new THREE.Color(0x7f9cbb);

// Harbor direction calculation.
// Ring geometry uses X/Y before rotation, where ring.y corresponds to -world.z.
// This must track the live harbor anchor or the coastal silhouette aims at the wrong side
// of the map after layout changes.
const HARBOR_RING_X = HARBOR_CENTER_3D.x;
const HARBOR_RING_Y = -HARBOR_CENTER_3D.z;
const HARBOR_ANGLE = Math.atan2(HARBOR_RING_Y, HARBOR_RING_X); // ~ -2.55 rad
const HARBOR_ARC_LENGTH = Math.PI * 1.5;

function resolveFogColor(scene, provided) {
  if (provided) return provided.clone();
  if (scene?.fog?.color) return scene.fog.color.clone();
  if (scene?.userData?.getFogOptions) {
    const fogOptions = scene.userData.getFogOptions();
    if (fogOptions?.color) {
      return fogOptions.color.clone();
    }
  }
  return SKY_BLEND_COLOR.clone();
}

function getAngleDistance(a, b) {
  let diff = a - b;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return Math.abs(diff);
}

function createWaterFadeRing({
  innerRadius,
  outerRadius,
  seaLevel,
  fogColor,
  horizonColor,
}) {
  // We use the full ring geometry for the water fade but mask it in the shader,
  // OR we use the arc geometry. Arc geometry is more efficient.
  const thetaStart = HARBOR_ANGLE - HARBOR_ARC_LENGTH * 0.5;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 96, 1, thetaStart, HARBOR_ARC_LENGTH);
  geometry.rotateX(-Math.PI / 2);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      innerRadius: { value: innerRadius },
      outerRadius: { value: outerRadius },
      seaLevel: { value: seaLevel },
      horizonColor: { value: horizonColor.clone() },
      centerAngle: { value: HARBOR_ANGLE },
      arcLength: { value: HARBOR_ARC_LENGTH },
    },
  ]);

  const material = new THREE.ShaderMaterial({
    name: "WaterHorizonFade",
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec3 vWorldPosition;
      uniform float innerRadius;
      uniform float outerRadius;
      uniform float seaLevel;
      uniform vec3 horizonColor;
      uniform float centerAngle;
      uniform float arcLength;

      #define PI 3.14159265359

      float getAngleDistance(float a, float b) {
        float diff = a - b;
        if (diff < -PI) diff += PI * 2.0;
        if (diff > PI) diff -= PI * 2.0;
        return abs(diff);
      }

      void main() {
        #ifdef USE_FOG
          float dist = length(vWorldPosition.xz);
          float t = clamp((dist - innerRadius) / max(outerRadius - innerRadius, 0.0001), 0.0, 1.0);
          float fade = smoothstep(0.08, 0.96, t);
          float heightFade = smoothstep(seaLevel + 0.4, seaLevel + 8.0, vWorldPosition.y);

          // Angular fade
          // We need angle in the ring's coordinate system (which is rotated -90X)
          // Actually, vWorldPosition is world space.
          // Ring geometry was created in XY then rotated to XZ.
          // x_ring = x_world
          // y_ring = -z_world
          float angle = atan(-vWorldPosition.z, vWorldPosition.x);

          float angleDist = getAngleDistance(angle, centerAngle);
          float arcEdge = arcLength * 0.5;
          // Fade out over the last 15% of the arc or fixed angle
          float taper = clamp((arcEdge - angleDist) / 0.5, 0.0, 1.0);

          float alpha = fade * (1.0 - heightFade) * 0.82 * taper;

          if (alpha <= 0.003) {
            gl_FragColor = vec4(0.0);
            discard;
          }

          vec3 color = mix(horizonColor, fogColor, fade * 0.85);
          gl_FragColor = vec4(color, alpha);
        #else
          gl_FragColor = vec4(0.0);
          discard;
        #endif
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "WaterHorizonFade";
  mesh.position.y = seaLevel + 0.05;
  mesh.renderOrder = RENDER_LAYERS.HORIZON;
  mesh.userData.nonInteractive = true;
  return mesh;
}

export function createShorelineTermination(scene, options = {}) {
  const seaLevel = Number.isFinite(options.seaLevel)
    ? options.seaLevel
    : getSeaLevelY();
  const innerRadius = Math.max(options.innerRadius ?? DEFAULT_COASTAL_INNER_RADIUS, 100);
  const bandWidth = Math.max(options.bandWidth ?? DEFAULT_COASTAL_WIDTH, 10);
  const outerRadius = innerRadius + bandWidth;
  const oceanRadius = Math.max(options.oceanRadius ?? outerRadius + 360, outerRadius + 120);
  const fadeWidth = Math.max(Math.min(options.fadeWidth ?? 320, oceanRadius - outerRadius - 20), 120);

  const fogColor = resolveFogColor(scene, options.fogColor);
  const horizonColor = options.horizonColor
    ? new THREE.Color(options.horizonColor)
    : SKY_HORIZON_COLOR.clone();

  const group = new THREE.Group();
  group.name = "ShoreTermination";
  group.userData.nonInteractive = true;

  const waterFade = createWaterFadeRing({
    innerRadius: outerRadius - 6,
    outerRadius: Math.min(oceanRadius - 40, outerRadius + fadeWidth),
    seaLevel,
    fogColor,
    horizonColor,
  });

  group.add(waterFade);

  if (scene) {
    scene.add(group);
  }

  group.userData.bounds = { innerRadius, outerRadius, oceanRadius };
  group.userData.seaLevel = seaLevel;
  return group;
}
