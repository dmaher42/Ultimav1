import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  MathUtils,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

const UP = new Vector3(0, 1, 0);

const SKY_PRESETS = {
  high_noon: {
    turbidity: 2.2,
    rayleigh: 1.35,
    mieCoefficient: 0.0032,
    mieDirectionalG: 0.82,
    horizon: "#ffd9a3",
    zenith: "#6fa7ff",
  },
  golden_hour: {
    turbidity: 3.4,
    rayleigh: 1.05,
    mieCoefficient: 0.0052,
    mieDirectionalG: 0.82,
    horizon: "#ffd4a6",
    zenith: "#5f93e0",
  },
  blue_hour: {
    turbidity: 2.0,
    rayleigh: 2.2,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.86,
    horizon: "#4d6fa8",
    zenith: "#102754",
  },
};

function createStarField(radius = 4000, count = 4000) {
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;
    const r = radius;
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta);
    const z = r * Math.sin(theta) * Math.sin(phi);
    positions.push(x, y, z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: new Color("#dbe6ff"),
    size: 6,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function createCloudLayer(radius = 4200) {
  const geometry = new SphereGeometry(radius, 32, 18);
  const material = new ShaderMaterial({
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0.08 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPosition;
      uniform float time;
      uniform float opacity;

      // Simple tiled noise using sine blends
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec3 dir = normalize(vWorldPosition);
        vec2 uv = dir.xz * 0.45 + vec2(time * 0.003, time * 0.002);
        float n = noise(uv * 3.0);
        float clouds = smoothstep(0.45, 0.68, n);
        float falloff = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float alpha = clouds * falloff * opacity;
        if (alpha < 0.01) discard;
        vec3 cloudColor = mix(vec3(1.0), vec3(1.0, 0.97, 0.92), clamp(1.0 - dir.y, 0.0, 1.0) * 0.4);
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
  });

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

export class DynamicSky {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.timeOfDayHours = 12;
    this.azimuthOffset = MathUtils.degToRad(options.azimuthOffsetDeg ?? 0);
    this.sunDistance = options.sunDistance ?? 600;
    this.sunTarget = options.sunTarget || new Vector3(0, 0, 0);
    this.manualSunDirection = null;

    this.sky = new Sky();
    this.sky.material.side = BackSide;
    this.sky.material.depthWrite = false;
    this.sky.scale.setScalar(options.radius ?? 4500);

    this.sunDirection = new Vector3(0.3, 0.9, 0.2).normalize();
    this.moonDirection = new Vector3();

    this.sunLight = new DirectionalLight(0xffffff, 3.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0002;
    this.sunLight.shadow.radius = 2.8;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(this.sunDistance);
    this.sunLight.target.position.copy(this.sunTarget);

    this.stars = createStarField(options.radius ?? 4500, 3200);
    this.clouds = createCloudLayer(options.radius ? options.radius * 0.95 : 4300);

    this.settings = {
      horizon: SKY_PRESETS.high_noon.horizon,
      zenith: SKY_PRESETS.high_noon.zenith,
    };

    if (scene) {
      scene.add(this.sky);
      scene.add(this.sunLight);
      scene.add(this.sunLight.target);
      scene.add(this.clouds);
      scene.add(this.stars);
      scene.userData = scene.userData || {};
      scene.userData.sky = { settings: this.settings };
    }

    this.applyPreset("high_noon");
    this.setTimeOfDay(this.timeOfDayHours);
  }

  setAzimuthOffsetDegrees(deg) {
    this.azimuthOffset = MathUtils.degToRad(deg ?? 0);
  }

  applyPreset(key) {
    const preset = SKY_PRESETS[key] || SKY_PRESETS.high_noon;
    const uniforms = this.sky.material.uniforms;
    uniforms.turbidity.value = preset.turbidity;
    uniforms.rayleigh.value = preset.rayleigh;
    uniforms.mieCoefficient.value = preset.mieCoefficient;
    uniforms.mieDirectionalG.value = preset.mieDirectionalG;
    uniforms.sunPosition.value.copy(this.sunDirection);
    this.sky.material.needsUpdate = true;
    this.settings.horizon = preset.horizon;
    this.settings.zenith = preset.zenith;
  }

  setSunDirection(direction) {
    if (!direction) return;
    this.manualSunDirection = direction.clone().normalize();
    const phase = this._phaseFromDirection(this.manualSunDirection);
    this.timeOfDayHours = phase * 24;
    this._applySunDirection(this.manualSunDirection);
  }

  clearManualSunDirection() {
    this.manualSunDirection = null;
  }

  setTimeOfDay(hours) {
    const clamped = MathUtils.clamp(hours ?? 0, 0, 24);
    this.timeOfDayHours = clamped;
    this.manualSunDirection = null;
    this._updateSunAndMoon();
  }

  getSunDirection(target = new Vector3()) {
    return target.copy(this.sunDirection);
  }

  getMoonDirection(target = new Vector3()) {
    return target.copy(this.moonDirection);
  }

  update(deltaTime = 0) {
    const uniforms = this.sky.material.uniforms;
    if (uniforms.sunPosition) {
      uniforms.sunPosition.value.copy(this.sunDirection).multiplyScalar(1000);
    }

    const dayFactor = MathUtils.clamp(
      MathUtils.smoothstep(this.sunDirection.y, -0.25, 0.2),
      0,
      1,
    );
    const nightFactor = 1 - dayFactor;
    const cloudUniforms = this.clouds.material.uniforms;
    if (cloudUniforms?.time) cloudUniforms.time.value += deltaTime;
    if (cloudUniforms?.opacity) {
      cloudUniforms.opacity.value = MathUtils.lerp(0.03, 0.12, dayFactor);
    }

    if (this.stars.material) {
      const fadeIn = MathUtils.smoothstep(0.02, -0.1, this.sunDirection.y);
      const overrideOpacity = this.stars.userData?.overrideOpacity;
      if (overrideOpacity != null) {
        this.stars.material.opacity = overrideOpacity;
      } else {
        this.stars.material.opacity = fadeIn * 0.85;
      }
    }

    const turbidityDay = this.sky.material.uniforms.turbidity.value;
    this.sky.material.uniforms.turbidity.value = MathUtils.lerp(
      3.0,
      turbidityDay,
      dayFactor,
    );
    this.sky.material.uniforms.rayleigh.value = MathUtils.lerp(2.5, 1.1, dayFactor);

    if (!this.manualSunDirection) {
      this.sunLight.intensity = MathUtils.lerp(0.08, 4.2, dayFactor);
      const sunriseColor = new Color("#ffd8a6");
      const noonColor = new Color("#ffffff");
      const duskColor = new Color("#ffb07a");
      const sunColor = sunriseColor
        .lerp(noonColor, dayFactor)
        .lerp(duskColor, nightFactor * 0.65);
      this.sunLight.color.copy(sunColor);

      const moonTint = new Color("#b8c8ff");
      this.sunLight.visible = true;
      if (nightFactor > 0.8) {
        this.sunLight.color.lerp(moonTint, nightFactor * 0.6);
        this.sunLight.intensity = MathUtils.lerp(0.08, 0.28, nightFactor);
      }
    }
  }

  _phaseFromDirection(direction) {
    const dir = direction.clone().normalize();
    const theta = Math.atan2(dir.y, dir.x);
    const phase = theta / (Math.PI * 2) + 0.25;
    return ((phase % 1) + 1) % 1;
  }

  _updateSunAndMoon() {
    const phase = (this.timeOfDayHours % 24) / 24;
    const theta = (phase - 0.25) * Math.PI * 2;
    const baseDir = new Vector3(Math.cos(theta), Math.sin(theta), 0);
    baseDir.applyAxisAngle(UP, this.azimuthOffset);
    this._applySunDirection(baseDir.normalize());
  }

  _applySunDirection(direction) {
    this.sunDirection.copy(direction).normalize();
    this.moonDirection.copy(direction).multiplyScalar(-1).normalize();
    const uniforms = this.sky.material.uniforms;
    if (uniforms?.sunPosition?.value) {
      uniforms.sunPosition.value.copy(this.sunDirection);
    }
    this.sky.material.needsUpdate = true;
    const scaled = this.sunDirection.clone().multiplyScalar(this.sunDistance);
    this.sunLight.position.copy(this.sunTarget).add(scaled);
    this.sunLight.target.position.copy(this.sunTarget);
    this.sunLight.target.updateMatrixWorld();
  }
}
