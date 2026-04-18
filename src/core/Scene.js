import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { createColorGradePass } from "../world/colorGradingPass.js";
import { CameraManager } from "./CameraManager.js";

export const WORLD_ROOT_NAME = "WorldRoot";

function isAutomationCaptureSession() {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const forced = params.get("automationPreview");
      if (forced === "1" || forced === "true") return true;
    } catch {}
  }

  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const isHeadlessBrowser = /HeadlessChrome|Playwright/i.test(userAgent);
  return navigator.webdriver === true && isHeadlessBrowser;
}

function isBloomEnabledByDefault() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const forced = params.get("bloom");
    return forced === "1" || forced === "true";
  } catch {}
  return true;
}

function createAutomationPreviewMaterial(material) {
  if (!material) return material;
  if (material.userData?.automationPreviewConverted) {
    return material;
  }
  if (
    !material.isMeshStandardMaterial &&
    !material.isMeshPhysicalMaterial &&
    !material.isMeshPhongMaterial &&
    !material.isMeshLambertMaterial
  ) {
    return material;
  }

  const previewMaterial = new THREE.MeshLambertMaterial({
    color: material.color?.clone?.() ?? new THREE.Color(0xffffff),
    map: material.map || null,
    alphaMap: material.alphaMap || null,
    emissive: material.emissive?.clone?.() ?? new THREE.Color(0x000000),
    emissiveIntensity: material.emissiveIntensity ?? 0,
    transparent: !!material.transparent,
    opacity: Number.isFinite(material.opacity) ? material.opacity : 1,
    side: material.side,
    alphaTest: material.alphaTest ?? 0,
    vertexColors: !!material.vertexColors,
    fog: material.fog !== false,
    depthWrite: material.depthWrite !== false,
    depthTest: material.depthTest !== false,
  });
  previewMaterial.userData = {
    ...material.userData,
    automationPreviewConverted: true,
  };
  return previewMaterial;
}

function ensureAutomationPreviewReadability(scene, renderer) {
  if (!scene || !renderer) return;
  const state = scene.userData.automationPreviewState || {};
  scene.userData.automationPreviewState = state;

  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = false;
  }
  renderer.toneMappingExposure = Math.max(1.0, renderer.toneMappingExposure ?? 1.0);

  if (!state.previewAmbientLight) {
    const ambient = new THREE.AmbientLight(0xffffff, 1.15);
    ambient.name = "AutomationPreviewAmbient";
    scene.add(ambient);
    state.previewAmbientLight = ambient;
  }

  if (!state.previewHemisphereLight) {
    const hemisphere = new THREE.HemisphereLight(0xf4f8ff, 0xcab28d, 1.35);
    hemisphere.name = "AutomationPreviewHemisphere";
    scene.add(hemisphere);
    state.previewHemisphereLight = hemisphere;
  }

  scene.traverse((obj) => {
    if (!obj?.isMesh || !obj.material) return;
    if (obj.userData?.isWater) return;
    if (obj.name === "AegeanOcean") return;

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((material) =>
        createAutomationPreviewMaterial(material),
      );
      return;
    }

    obj.material = createAutomationPreviewMaterial(obj.material);
  });
}

export function configureRendererShadows(renderer) {
  if (!renderer) return;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  if (renderer.shadowMap) {
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
}

export function createRenderer({ antialias = true } = {}) {
  // Automated browser captures can produce blank WebGL screenshots unless the
  // back buffer is preserved for the snapshot step.
  const preserveDrawingBuffer = isAutomationCaptureSession();
  const renderer = new THREE.WebGLRenderer({
    antialias,
    preserveDrawingBuffer,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9; // Look presets assume ACES with ~1.0 as the baseline exposure
  renderer.useLegacyLights = false;
  renderer.localClippingEnabled = true;
  renderer.info.autoReset = false;
  configureRendererShadows(renderer);
  return renderer;
}

export function createSceneContext({
  renderer,
  baseUrl,
  worldRootName = WORLD_ROOT_NAME,
  onFogChange,
} = {}) {
  const isAutomationCapture = isAutomationCaptureSession();
  const scene = new THREE.Scene();
  scene.userData = scene.userData || {};
  scene.userData.renderer = renderer;
  scene.userData.baseUrl = baseUrl;

  const fogState = {
    color: new THREE.Color(0xbfd5ff),
    near: 300,
    far: 1950,
    density: 0.0002,
  };

  const createSceneFog = () => {
    // Distance-weighted fog keeps the town readable while still blending the horizon.
    return new THREE.Fog(fogState.color.clone(), fogState.near, fogState.far);
  };

  let fogEnabled = false;

  const syncFogState = () => {
    if (typeof onFogChange === "function") {
      onFogChange(fogEnabled, scene);
    }
  };

  const setFogOptions = ({ color, density, near, far } = {}) => {
    if (color) {
      fogState.color.copy(color instanceof THREE.Color ? color : new THREE.Color(color));
    }
    if (Number.isFinite(near)) {
      fogState.near = Math.max(0, near);
    }
    if (Number.isFinite(far)) {
      fogState.far = Math.max(fogState.near + 10, far);
    }

    // Allow legacy density-driven calls by converting to a distant falloff.
    if (Number.isFinite(density)) {
      fogState.density = Math.max(0, density);
      const suggestedFar = THREE.MathUtils.clamp(1 / Math.max(density, 1e-6), 400, 2600);
      fogState.far = Math.max(fogState.near + 80, suggestedFar);
    }

    if (scene.fog) {
      scene.fog.color.copy(fogState.color);
      if (scene.fog.isFog) {
        scene.fog.near = fogState.near;
        scene.fog.far = fogState.far;
      } else if (scene.fog.isFogExp2) {
        scene.fog.density = fogState.density;
      }
    }
  };

  const setFogEnabled = (enabled = true) => {
    const next = Boolean(enabled);
    if (fogEnabled === next && !!scene.fog === next) {
      syncFogState();
      return;
    }
    fogEnabled = next;
    scene.fog = fogEnabled ? createSceneFog() : null;
    syncFogState();
  };

  const toggleFog = () => {
    setFogEnabled(!fogEnabled);
  };

  scene.userData.setFogOptions = setFogOptions;
  scene.userData.getFogOptions = () => ({
    color: fogState.color.clone(),
    density: fogState.density,
    near: fogState.near,
    far: fogState.far,
  });

  const disposeMaterial = (material) => {
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (value && value.isTexture && typeof value.dispose === "function") {
          value.dispose();
        }
      }
      if (typeof mat.dispose === "function") {
        mat.dispose();
      }
    }
  };

  const disposeObject = (object) => {
    if (!object) return;
    object.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry && typeof child.geometry.dispose === "function") {
          child.geometry.dispose();
        }
        disposeMaterial(child.material);
      }
    });
  };

  const disposeGroupChildren = (group) => {
    if (!group) return;
    const children = [...group.children];
    for (const child of children) {
      disposeObject(child);
      group.remove(child);
    }
  };

  const refreshWorldRoot = () => {
    const existing =
      scene.userData?.worldRoot ?? scene.getObjectByName(worldRootName);
    if (existing) {
      disposeGroupChildren(existing);
      existing.parent?.remove(existing);
    }

    const root = new THREE.Group();
    root.name = worldRootName;
    root.userData = root.userData || {};
    root.userData.renderer = scene.userData?.renderer || null;
    if (typeof scene.userData?.baseUrl === "string") {
      root.userData.baseUrl = scene.userData.baseUrl;
    } else {
      delete root.userData.baseUrl;
    }
    scene.add(root);
    scene.userData.worldRoot = root;
    return root;
  };

  // Create camera using CameraManager for consistency
  const camera = CameraManager.createCamera(75, window.innerWidth / window.innerHeight, 0.1, 1200);

  const composer = isAutomationCapture ? null : new EffectComposer(renderer);
  let bloomPass = null;
  let colorGradePass = null;

  if (composer) {
    const composerPixelRatio = Math.min(
      renderer?.getPixelRatio?.() ?? window.devicePixelRatio ?? 1,
      1,
    );
    composer.setPixelRatio(composerPixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,
      0.6,
      0.85,
    );
    // Bloom is visually nice, but it is one of the most expensive always-on
    // post effects in the current scene. Keep it opt-in for normal play.
    bloomPass.enabled = isBloomEnabledByDefault();
    composer.addPass(bloomPass);
    colorGradePass = createColorGradePass();
    composer.addPass(colorGradePass);
  }

  const renderFrame = () => {
    if (isAutomationCapture) {
      ensureAutomationPreviewReadability(scene, renderer);
    }

    renderer.info?.reset?.();

    // DEV: detect textures that are flagged for update but have no image data
    // Throttled to avoid per-frame traversal of 1700+ meshes
    if (import.meta.env?.DEV) {
      if (!renderFrame._debugFrameCount) renderFrame._debugFrameCount = 0;
      renderFrame._debugFrameCount++;
      if (renderFrame._debugFrameCount % 120 === 0) {
      try {
        scene.traverse((obj) => {
          if (!obj || !obj.material) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (!m) continue;
            for (const v of Object.values(m)) {
              if (v && v.isTexture) {
                // DataTexture has its own data buffer; skip those
                const isDataTex = typeof THREE.DataTexture !== 'undefined' && v instanceof THREE.DataTexture;
                if (v.needsUpdate && !isDataTex && !v.image) {
                  console.warn('[debug] Texture needsUpdate with no image:', v, { material: m, object: obj });
                  // Avoid spamming the renderer each frame — clear the flag so the renderer won't repeatedly warn.
                  v.needsUpdate = false;
                }
              }
            }
          }
        });
      } catch (e) {
        // swallow any debug-time exceptions
        // eslint-disable-next-line no-console
        console.warn('[debug] texture scan failed', e);
      }
      }
    }

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  };

  camera.near = 0.1;
  camera.far = 1200;
  camera.updateProjectionMatrix();
  camera.position.set(0, 5, 10);

  setFogEnabled(true);

  return {
    scene,
    camera,
    composer,
    bloomPass,
    colorGradePass,
    renderFrame,
    refreshWorldRoot,
    setFogEnabled,
    toggleFog,
  };
}
