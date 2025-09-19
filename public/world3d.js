import * as THREE from 'https://esm.sh/three@0.160';
import { EffectComposer } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'https://esm.sh/three@0.160/examples/jsm/postprocessing/ShaderPass.js';

// Expose tweakable graphics knobs so the host game can tune the look without
// cracking open this module.
export const Graphics = {
  toneLevels: [0.0, 0.55, 1.0],
  outlineThickness: 1.5,
  grainIntensity: 0.035,
  vignetteStrength: 0.65,
  chromaticOffset: 0.001,
  saturationBoost: 0.18
};

const PARALLAX_FACTORS = {
  background: 0.2,
  mid: 0.5,
  near: 0.8
};

const PARALLAX_BACKGROUNDS = [
  {
    basePath: 'assets/backgrounds/bakery',
    layers: [
      { file: 'sky.png', target: 'background', z: 0 },
      { file: 'walls.png', target: 'mid', z: 0 },
      { file: 'details.png', target: 'near', z: 0 }
    ]
  },
  {
    basePath: 'assets/backgrounds/plaza',
    layers: [
      { file: 'stars.png', target: 'background', z: 0 },
      { file: 'treeline.png', target: 'mid', z: 0 },
      { file: 'market.png', target: 'near', z: 0 }
    ]
  }
];

const world = {
  canvas: null,
  renderer: null,
  scene: null,
  camera: null,
  composer: null,
  renderPass: null,
  outlinePass: null,
  bloomPass: null,
  tonePass: null,
  layers: {},
  lightGroup: null,
  resizeHandler: null,
  lastFrameTime: performance.now(),
  cameraTarget: new THREE.Vector2(),
  parallaxEnabled: true,
  pixelArtMode: false,
  anisotropy: 1,
  initialized: false,
  config: {},
  api: null
};

const textureCache = new Map();
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

const LIGHT_GEOMETRY = new THREE.PlaneGeometry(1, 1, 1, 1);
const TEMP_OBJECT = new THREE.Object3D();
const TEMP_VEC2 = new THREE.Vector2();
let gaussianTexture = null;

function getTexture(url) {
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  const texture = loader.load(
    url,
    () => {
      texture.userData.failed = false;
    },
    undefined,
    () => {
      console.warn(`[world3d] Missing texture at ${url}`);
      texture.userData.failed = true;
      texture.needsUpdate = true;
      texture.dispatchEvent({ type: 'update' });
    }
  );

  texture.userData = texture.userData || {};
  texture.userData.failed = false;
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = world.anisotropy;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  applyTextureFiltering(texture);

  textureCache.set(url, texture);
  return texture;
}

function applyTextureFiltering(texture) {
  if (!texture) return;
  if (world.pixelArtMode) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  } else {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
  }
  texture.needsUpdate = true;
}

function whenTextureReady(texture, onLoad, onError) {
  if (!texture) return;
  if (texture.userData.failed) {
    if (onError) onError();
    return;
  }
  const image = texture.image;
  if (image && image.width && image.height) {
    onLoad(texture);
    return;
  }
  const handler = () => {
    if (!texture.image || !texture.image.width) {
      if (texture.userData.failed) {
        texture.removeEventListener('update', handler);
        if (onError) onError();
      }
      return;
    }
    texture.removeEventListener('update', handler);
    if (texture.userData.failed) {
      if (onError) onError();
      return;
    }
    onLoad(texture);
  };
  texture.addEventListener('update', handler);
}

function loadSpritePlane(url, opts = {}) {
  const texture = getTexture(url);
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture.userData.failed ? null : texture,
    transparent: true,
    depthWrite: false,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = opts.name || url;
  mesh.userData.layer = opts.layer || 'mid';
  mesh.frustumCulled = false;
  mesh.renderOrder = opts.renderOrder ?? 0;

  const applyDimensions = () => {
    const width = opts.width || texture.image.width || 1;
    const height = opts.height || texture.image.height || 1;
    mesh.scale.set(width, height, 1);
    mesh.userData.size = { width, height };
  };

  if (texture && texture.image && texture.image.width) {
    applyDimensions();
  } else {
    whenTextureReady(
      texture,
      applyDimensions,
      () => {
        mesh.visible = false;
      }
    );
  }

  if (texture.userData.failed) {
    mesh.visible = false;
  }

  return mesh;
}

function createInstancedSpritePlane(url, count, opts = {}) {
  const texture = getTexture(url);
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture.userData.failed ? null : texture,
    transparent: true,
    depthWrite: false
  });

  const instanced = new THREE.InstancedMesh(geometry, material, count);
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instanced.frustumCulled = false;
  instanced.name = opts.name || `instanced:${url}`;
  instanced.userData.layer = opts.layer || 'mid';

  const layout = () => {
    if (texture.userData.failed) {
      instanced.visible = false;
      return;
    }
    const width = opts.width || texture.image.width || 1;
    const height = opts.height || texture.image.height || 1;
    const spacing = opts.spacing || width + 16;
    const originX = opts.startX || 0;
    const originY = opts.startY || 0;
    const z = opts.z || 0;

    for (let i = 0; i < count; i += 1) {
      TEMP_OBJECT.position.set(originX + i * spacing, originY, z);
      TEMP_OBJECT.scale.set(width, height, 1);
      TEMP_OBJECT.rotation.set(0, 0, 0);
      TEMP_OBJECT.updateMatrix();
      instanced.setMatrixAt(i, TEMP_OBJECT.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  };

  if (texture.image && texture.image.width) {
    layout();
  } else {
    whenTextureReady(
      texture,
      layout,
      () => {
        instanced.visible = false;
      }
    );
  }

  return instanced;
}

function ensureGaussianTexture() {
  if (gaussianTexture) return gaussianTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  gaussianTexture = new THREE.CanvasTexture(canvas);
  gaussianTexture.magFilter = THREE.LinearFilter;
  gaussianTexture.minFilter = THREE.LinearFilter;
  gaussianTexture.wrapS = THREE.ClampToEdgeWrapping;
  gaussianTexture.wrapT = THREE.ClampToEdgeWrapping;
  gaussianTexture.needsUpdate = true;
  return gaussianTexture;
}

function buildSceneGraph() {
  world.scene = new THREE.Scene();

  world.layers.background = new THREE.Group();
  world.layers.background.name = 'background-layer';
  world.layers.background.position.z = -15;
  world.layers.background.userData.basePosition = new THREE.Vector2(0, 0);

  world.layers.mid = new THREE.Group();
  world.layers.mid.name = 'mid-layer';
  world.layers.mid.position.z = 0;
  world.layers.mid.userData.basePosition = new THREE.Vector2(0, 0);

  world.layers.near = new THREE.Group();
  world.layers.near.name = 'near-layer';
  world.layers.near.position.z = 15;
  world.layers.near.userData.basePosition = new THREE.Vector2(0, 0);

  world.lightGroup = new THREE.Group();
  world.lightGroup.name = 'emissive-lights';
  world.layers.near.add(world.lightGroup);

  world.scene.add(world.layers.background);
  world.scene.add(world.layers.mid);
  world.scene.add(world.layers.near);
}

function createRenderer(canvas) {
  world.renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: false
  });
  world.renderer.setClearColor(0x000000, 0);
  world.renderer.outputEncoding = THREE.sRGBEncoding;
  world.renderer.autoClear = true;
  world.renderer.sortObjects = true;
  world.anisotropy = world.renderer.capabilities.getMaxAnisotropy();
  textureCache.forEach((texture) => {
    texture.anisotropy = world.anisotropy;
  });
}

function createCamera() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  world.camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    -1000,
    1000
  );
  world.camera.position.set(0, 0, 500);
  world.camera.lookAt(0, 0, 0);
  world.cameraTarget.set(0, 0);
}

function createPostProcessing() {
  world.composer = new EffectComposer(world.renderer);
  world.renderPass = new RenderPass(world.scene, world.camera);

  const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
  world.outlinePass = new OutlinePass(size, world.scene, world.camera);
  world.outlinePass.edgeStrength = 2.5;
  world.outlinePass.edgeGlow = 0.0;
  world.outlinePass.edgeThickness = Graphics.outlineThickness;
  world.outlinePass.visibleEdgeColor.set(0x05070b);
  world.outlinePass.hiddenEdgeColor.set(0x000000);
  world.outlinePass.pulsePeriod = 0;
  world.outlinePass.selectedObjects = [world.layers.mid, world.layers.near];

  world.bloomPass = new UnrealBloomPass(size, 0.35, 0.75, 0.85);
  world.bloomPass.threshold = 0.2;
  world.bloomPass.strength = 0.5;
  world.bloomPass.radius = 0.55;

  const toneUniforms = {
    tDiffuse: { value: null },
    toneLevels: {
      value: new THREE.Vector3(
        Graphics.toneLevels[0],
        Graphics.toneLevels[1],
        Graphics.toneLevels[2]
      )
    },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    time: { value: 0 },
    grainIntensity: { value: Graphics.grainIntensity ?? 0.03 },
    vignetteStrength: { value: Graphics.vignetteStrength ?? 0.6 },
    chromaticOffset: { value: Graphics.chromaticOffset ?? 0.001 },
    saturationBoost: { value: Graphics.saturationBoost ?? 0.18 }
  };

  world.tonePass = new ShaderPass({
    uniforms: toneUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec3 toneLevels;
      uniform vec2 resolution;
      uniform float time;
      uniform float grainIntensity;
      uniform float vignetteStrength;
      uniform float chromaticOffset;
      uniform float saturationBoost;
      varying vec2 vUv;

      float luminance(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      vec3 applyTone(vec3 color, float targetLuma) {
        float luma = luminance(color);
        float scale = luma > 0.0001 ? targetLuma / luma : 0.0;
        return color * scale;
      }

      void main() {
        vec2 center = vec2(0.5);
        vec2 toCenter = vUv - center;
        float dist = length(toCenter);
        vec2 offsetDir = dist > 0.0001 ? toCenter / dist : vec2(0.0);
        vec2 offset = offsetDir * chromaticOffset * dist;

        vec3 sampled;
        sampled.r = texture2D(tDiffuse, vUv + offset).r;
        sampled.g = texture2D(tDiffuse, vUv).g;
        sampled.b = texture2D(tDiffuse, vUv - offset).b;

        float luma = luminance(sampled);
        float target = toneLevels.x;
        if (luma >= toneLevels.y && luma < toneLevels.z) {
          target = toneLevels.y;
        } else if (luma >= toneLevels.z) {
          target = toneLevels.z;
        }
        vec3 toneMapped = applyTone(sampled, target);

        float saturation = clamp(1.0 + saturationBoost, 0.0, 3.0);
        vec3 balanced = mix(vec3(luminance(toneMapped)), toneMapped, saturation);

        float vignette = smoothstep(vignetteStrength, vignetteStrength - 0.35, dist);
        balanced *= mix(1.0, vignette, clamp(vignetteStrength, 0.0, 1.0));

        float grain = hash(vUv * resolution + time * 60.0);
        grain = grain * 2.0 - 1.0;
        balanced += grain * grainIntensity;

        gl_FragColor = vec4(clamp(balanced, 0.0, 1.5), 1.0);
      }
    `
  });

  world.composer.addPass(world.renderPass);
  world.composer.addPass(world.outlinePass);
  world.composer.addPass(world.bloomPass);
  world.composer.addPass(world.tonePass);
  world.tonePass.renderToScreen = true;
}

function updateComposerSize(width, height, dpr) {
  if (!world.composer) return;
  world.composer.setPixelRatio(dpr);
  world.composer.setSize(width * dpr, height * dpr);
  world.outlinePass.setSize(width * dpr, height * dpr);
  world.bloomPass.setSize(width * dpr, height * dpr);
}

function handleResize() {
  if (!world.renderer || !world.camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  world.renderer.setPixelRatio(dpr);
  world.renderer.setSize(width, height, false);

  world.canvas.style.width = `${width}px`;
  world.canvas.style.height = `${height}px`;

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  world.camera.left = -halfWidth;
  world.camera.right = halfWidth;
  world.camera.top = halfHeight;
  world.camera.bottom = -halfHeight;
  world.camera.updateProjectionMatrix();

  updateComposerSize(width, height, dpr);

  if (world.tonePass && world.tonePass.material?.uniforms?.resolution) {
    world.tonePass.material.uniforms.resolution.value.set(width, height);
  }
}

function addBackgroundPlanes() {
  let offsetX = 0;
  PARALLAX_BACKGROUNDS.forEach((set, index) => {
    set.layers.forEach((layerDef) => {
      const url = `${set.basePath}/${layerDef.file}`;
      const mesh = loadSpritePlane(url, { layer: layerDef.target });
      mesh.position.set(offsetX, 0, layerDef.z || 0);
      const layerGroup = world.layers[layerDef.target];
      if (!layerGroup) return;
      layerGroup.add(mesh);
      whenTextureReady(
        mesh.material.map,
        (texture) => {
          // Place the plane so its center stays anchored even as we resize.
          const width = texture.image.width || 1;
          const height = texture.image.height || 1;
          mesh.position.set(offsetX, 0, layerDef.z || 0);
          mesh.userData.size = { width, height };
        },
        () => {
          mesh.visible = false;
        }
      );
    });
    offsetX += 1600 * (index + 1);
  });
}

function addDemoBarrels() {
  const barrels = createInstancedSpritePlane('assets/props/barrel.png', 20, {
    layer: 'near',
    startX: -480,
    startY: -220,
    spacing: 96,
    z: 2
  });
  world.layers.near.add(barrels);
}

function refreshPostEffectsConfig() {
  if (!world.outlinePass || !world.tonePass) return;
  world.outlinePass.edgeThickness = Graphics.outlineThickness;
  const uniforms = world.tonePass.material.uniforms;
  const tone = uniforms.toneLevels.value;
  if (Array.isArray(Graphics.toneLevels) && Graphics.toneLevels.length >= 3) {
    tone.set(Graphics.toneLevels[0], Graphics.toneLevels[1], Graphics.toneLevels[2]);
  }
  if (uniforms.grainIntensity) {
    uniforms.grainIntensity.value = Graphics.grainIntensity ?? uniforms.grainIntensity.value;
  }
  if (uniforms.vignetteStrength) {
    uniforms.vignetteStrength.value = Graphics.vignetteStrength ?? uniforms.vignetteStrength.value;
  }
  if (uniforms.chromaticOffset) {
    uniforms.chromaticOffset.value = Graphics.chromaticOffset ?? uniforms.chromaticOffset.value;
  }
  if (uniforms.saturationBoost) {
    uniforms.saturationBoost.value = Graphics.saturationBoost ?? uniforms.saturationBoost.value;
  }
}

function applyParallax(cameraPos = world.cameraTarget) {
  if (!world.parallaxEnabled) {
    Object.values(world.layers).forEach((group) => {
      if (!group || !group.userData.basePosition) return;
      group.position.x = group.userData.basePosition.x;
      group.position.y = group.userData.basePosition.y;
    });
    return;
  }

  Object.entries(PARALLAX_FACTORS).forEach(([key, factor]) => {
    const group = world.layers[key];
    if (!group || !group.userData.basePosition) return;
    const base = group.userData.basePosition;
    group.position.x = base.x - cameraPos.x * (1 - factor);
    group.position.y = base.y - cameraPos.y * (1 - factor);
  });
}

function setCameraPosition(x = 0, y = 0) {
  if (!world.camera) return;
  world.camera.position.set(x, y, world.camera.position.z);
  world.camera.lookAt(x, y, 0);
  world.cameraTarget.set(x, y);
  applyParallax(world.cameraTarget);
}

export function initThreeWorld(canvas, config = {}) {
  if (!canvas) {
    throw new Error('initThreeWorld requires a canvas element.');
  }
  if (world.initialized) {
    return world.api;
  }

  world.canvas = canvas;
  world.config = config;
  world.pixelArtMode = Boolean(config.pixelArtMode);
  world.parallaxEnabled = config.parallax !== undefined ? Boolean(config.parallax) : true;

  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '0';

  buildSceneGraph();
  createRenderer(canvas);
  createCamera();
  createPostProcessing();
  handleResize();

  addBackgroundPlanes();
  addDemoBarrels();

  world.resizeHandler = () => handleResize();
  window.addEventListener('resize', world.resizeHandler);

  setPixelArtMode(world.pixelArtMode);
  refreshPostEffectsConfig();

  world.initialized = true;

  const api = {
    addSprite(name, mesh, layerName = mesh?.userData?.layer || 'mid') {
      if (!mesh) return null;
      const targetLayer = world.layers[layerName] || world.layers.mid;
      mesh.name = name || mesh.name;
      targetLayer.add(mesh);
      if (mesh.material && mesh.material.map) {
        applyTextureFiltering(mesh.material.map);
        mesh.material.map.anisotropy = world.anisotropy;
      }
      return mesh;
    },
    setCamera(x = 0, y = 0) {
      setCameraPosition(x, y);
    },
    setParallaxEnabled(enabled) {
      world.parallaxEnabled = Boolean(enabled);
      applyParallax(world.cameraTarget);
    }
  };

  world.api = api;
  return api;
}

export function renderThreeWorld(state = {}) {
  if (!world.initialized || !world.renderer) return;

  const now = performance.now();
  const elapsed = (now - world.lastFrameTime) / 1000;
  const dt = Math.min(elapsed, 1 / 24);
  world.lastFrameTime = now;

  if (world.tonePass && world.tonePass.material?.uniforms) {
    const uniforms = world.tonePass.material.uniforms;
    if (uniforms.time) {
      uniforms.time.value = now * 0.001;
    }
    if (uniforms.resolution) {
      world.renderer.getSize(TEMP_VEC2);
      uniforms.resolution.value.set(TEMP_VEC2.x, TEMP_VEC2.y);
    }
  }

  if (typeof state.pixelArtMode === 'boolean' && state.pixelArtMode !== world.pixelArtMode) {
    setPixelArtMode(state.pixelArtMode);
  }

  if (state.camera) {
    const x = Number.isFinite(state.camera.x) ? state.camera.x : world.cameraTarget.x;
    const y = Number.isFinite(state.camera.y) ? state.camera.y : world.cameraTarget.y;
    setCameraPosition(x, y);
  } else {
    applyParallax(world.cameraTarget);
  }

  refreshPostEffectsConfig();

  if (world.composer) {
    world.composer.render(dt);
  } else {
    world.renderer.render(world.scene, world.camera);
  }
}

export function setLights(lights = []) {
  if (!world.lightGroup) return;

  while (world.lightGroup.children.length) {
    const child = world.lightGroup.children[0];
    if (child.material) {
      child.material.dispose();
    }
    world.lightGroup.remove(child);
  }

  if (!Array.isArray(lights) || lights.length === 0) {
    return;
  }

  const texture = ensureGaussianTexture();
  lights.forEach((light, index) => {
    const radius = Math.max(1, light.radius || 120);
    const intensity = light.intensity !== undefined ? light.intensity : 1;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: intensity
    });
    material.toneMapped = false;
    if (light.color) {
      try {
        material.color.set(light.color);
      } catch (err) {
        if (material.color && material.color.setStyle) {
          material.color.setStyle(light.color);
        }
      }
    }

    const sprite = new THREE.Mesh(LIGHT_GEOMETRY, material);
    sprite.name = light.name || `light-${index}`;
    sprite.scale.set(radius * 2, radius * 2, 1);
    sprite.position.set(light.x || 0, light.y || 0, 5);
    world.lightGroup.add(sprite);
  });
}

export function setPixelArtMode(enabled) {
  world.pixelArtMode = Boolean(enabled);
  textureCache.forEach((texture) => {
    applyTextureFiltering(texture);
  });
  if (world.renderer && world.renderer.domElement) {
    world.renderer.domElement.style.imageRendering = world.pixelArtMode ? 'pixelated' : 'auto';
  }
}

