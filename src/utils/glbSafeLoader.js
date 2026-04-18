import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createKTX2Loader } from "./ktx2.js";
import { createDracoLoader } from "./draco.js";
import { applyTextureBudgetToObject } from "./textureBudget.js";
import { joinPath, resolveBaseUrl } from "./baseUrl.js";

const ENABLE_GLB_MODE = true;

function sanitizeRelativePath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    // strip leading slashes FIRST so repo-folder stripping matches
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^docs\//i, "")
    .replace(/^athens-game-starter\//i, "")
    .replace(/^\.\//, "");
}

class GLTFMeshStandardSGMaterial extends THREE.MeshStandardMaterial {
  constructor(params) {
    if (params instanceof THREE.MeshStandardMaterial) {
      return params;
    }
    if (params && params.isMeshStandardMaterial) {
      return params;
    }
    super();

    this.isGLTFSpecularGlossinessMaterial = true;

    const specularMapParsFragmentChunk = [
      "#ifdef USE_SPECULARMAP",
      "	uniform sampler2D specularMap;",
      "#endif",
    ].join("\n");

    const glossinessMapParsFragmentChunk = [
      "#ifdef USE_GLOSSINESSMAP",
      "	uniform sampler2D glossinessMap;",
      "#endif",
    ].join("\n");

    const specularMapFragmentChunk = [
      "vec3 specularFactor = specular;",
      "#ifdef USE_SPECULARMAP",
      "	vec4 texelSpecular = texture2D( specularMap, vUv );",
      "	texelSpecular = sRGBToLinear( texelSpecular );",
      "	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture",
      "	specularFactor *= texelSpecular.rgb;",
      "#endif",
    ].join("\n");

    const glossinessMapFragmentChunk = [
      "float glossinessFactor = glossiness;",
      "#ifdef USE_GLOSSINESSMAP",
      "	vec4 texelGlossiness = texture2D( glossinessMap, vUv );",
      "	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture",
      "	glossinessFactor *= texelGlossiness.a;",
      "#endif",
    ].join("\n");

    const lightPhysicalFragmentChunk = [
      "PhysicalMaterial material;",
      "material.diffuseColor = diffuseColor.rgb * ( 1. - max( specularFactor.r, max( specularFactor.g, specularFactor.b ) ) );",
      "vec3 dxy = max( abs( dFdx( vNormal ) ), abs( dFdy( vNormal ) ) );",
      "float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );",
      "material.roughness = max( 1.0 - glossinessFactor, 0.0525 );",
      "material.roughness += geometryRoughness;",
      "material.roughness = min( material.roughness, 1.0 );",
      "material.specularColor = specularFactor;",
    ].join("\n");

    const uniforms = {
      specular: { value: new THREE.Color().setHex(0xffffff) },
      glossiness: { value: 1 },
      specularMap: { value: null },
      glossinessMap: { value: null },
    };

    this._extraUniforms = uniforms;

    this.onBeforeCompile = (shader) => {
      for (const uniformName of Object.keys(uniforms)) {
        shader.uniforms[uniformName] = uniforms[uniformName];
      }

      shader.fragmentShader = shader.fragmentShader
        .replace("uniform float roughness;", "uniform vec3 specular;")
        .replace("uniform float metalness;", "uniform float glossiness;")
        .replace(
          "#include <roughnessmap_pars_fragment>",
          specularMapParsFragmentChunk
        )
        .replace(
          "#include <metalnessmap_pars_fragment>",
          glossinessMapParsFragmentChunk
        )
        .replace("#include <roughnessmap_fragment>", specularMapFragmentChunk)
        .replace("#include <metalnessmap_fragment>", glossinessMapFragmentChunk)
        .replace(
          "#include <lights_physical_fragment>",
          lightPhysicalFragmentChunk
        );
    };

    Object.defineProperties(this, {
      specular: {
        get() {
          return uniforms.specular.value;
        },
        set(value) {
          uniforms.specular.value = value;
        },
      },
      specularMap: {
        get() {
          return uniforms.specularMap.value;
        },
        set(value) {
          uniforms.specularMap.value = value;

          if (value) {
            this.defines.USE_SPECULARMAP = "";
          } else {
            delete this.defines.USE_SPECULARMAP;
          }
        },
      },
      glossiness: {
        get() {
          return uniforms.glossiness.value;
        },
        set(value) {
          uniforms.glossiness.value = value;
        },
      },
      glossinessMap: {
        get() {
          return uniforms.glossinessMap.value;
        },
        set(value) {
          uniforms.glossinessMap.value = value;

          if (value) {
            this.defines.USE_GLOSSINESSMAP = "";
            this.defines.USE_UV = "";
          } else {
            delete this.defines.USE_GLOSSINESSMAP;
            delete this.defines.USE_UV;
          }
        },
      },
    });

    delete this.metalness;
    delete this.roughness;
    delete this.metalnessMap;
    delete this.roughnessMap;

    const {
      metalness,
      roughness,
      metalnessMap,
      roughnessMap,
      ...safeParams
    } = params || {};
    this.setValues(safeParams);
  }

  setValues(values) {
    if (values && typeof values === "object") {
      const {
        metalness,
        roughness,
        metalnessMap,
        roughnessMap,
        ...safeValues
      } = values;
      return THREE.MeshStandardMaterial.prototype.setValues.call(
        this,
        safeValues
      );
    }
    return THREE.MeshStandardMaterial.prototype.setValues.call(this, values);
  }

  copy(source) {
    super.copy(source);
    this.specularMap = source.specularMap;
    this.specular.copy(source.specular);
    this.glossinessMap = source.glossinessMap;
    this.glossiness = source.glossiness;
    delete this.metalness;
    delete this.roughness;
    delete this.metalnessMap;
    delete this.roughnessMap;
    return this;
  }
}

class GLTFMaterialsPbrSpecularGlossinessExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = "KHR_materials_pbrSpecularGlossiness";
  }

  getMaterialType() {
    return GLTFMeshStandardSGMaterial;
  }

  extendParams(materialParams, materialDef, parser) {
    const pbrSpecularGlossiness = materialDef.extensions[this.name];

    materialParams.color = new THREE.Color(1.0, 1.0, 1.0);
    materialParams.opacity = 1.0;

    const pending = [];

    if (Array.isArray(pbrSpecularGlossiness.diffuseFactor)) {
      const array = pbrSpecularGlossiness.diffuseFactor;

      materialParams.color.fromArray(array);
      materialParams.opacity = array[3];
    }

    if (pbrSpecularGlossiness.diffuseTexture !== undefined) {
      pending.push(
        parser.assignTexture(
          materialParams,
          "map",
          pbrSpecularGlossiness.diffuseTexture,
          THREE.SRGBColorSpace
        )
      );
    }

    materialParams.emissive = new THREE.Color(0.0, 0.0, 0.0);
    materialParams.glossiness =
      pbrSpecularGlossiness.glossinessFactor !== undefined
        ? pbrSpecularGlossiness.glossinessFactor
        : 1.0;
    materialParams.specular = new THREE.Color(1.0, 1.0, 1.0);

    if (Array.isArray(pbrSpecularGlossiness.specularFactor)) {
      materialParams.specular.fromArray(pbrSpecularGlossiness.specularFactor);
    }

    if (pbrSpecularGlossiness.specularGlossinessTexture !== undefined) {
      const specGlossMapDef = pbrSpecularGlossiness.specularGlossinessTexture;
      pending.push(
        parser.assignTexture(materialParams, "glossinessMap", specGlossMapDef)
      );
      pending.push(
        parser.assignTexture(
          materialParams,
          "specularMap",
          specGlossMapDef,
          THREE.SRGBColorSpace
        )
      );
    }

    return Promise.all(pending);
  }

  createMaterial(materialParams) {
    if (materialParams instanceof THREE.MeshStandardMaterial) {
      return materialParams;
    }
    if (materialParams?.isMeshStandardMaterial) {
      return materialParams;
    }
    const material = new GLTFMeshStandardSGMaterial(materialParams);
    material.fog = true;

    material.color = materialParams.color;

    material.map = materialParams.map === undefined ? null : materialParams.map;

    material.lightMap = null;
    material.lightMapIntensity = 1.0;

    material.aoMap =
      materialParams.aoMap === undefined ? null : materialParams.aoMap;
    material.aoMapIntensity = 1.0;

    material.emissive = materialParams.emissive;
    material.emissiveIntensity = 1.0;
    material.emissiveMap =
      materialParams.emissiveMap === undefined
        ? null
        : materialParams.emissiveMap;

    material.bumpMap =
      materialParams.bumpMap === undefined ? null : materialParams.bumpMap;
    material.bumpScale = 1;

    material.normalMap =
      materialParams.normalMap === undefined ? null : materialParams.normalMap;
    material.normalMapType = THREE.TangentSpaceNormalMap;

    if (materialParams.normalScale) {
      material.normalScale = materialParams.normalScale;
    }

    material.displacementMap = null;
    material.displacementScale = 1;
    material.displacementBias = 0;

    material.specularMap =
      materialParams.specularMap === undefined
        ? null
        : materialParams.specularMap;
    material.specular = materialParams.specular;

    material.glossinessMap =
      materialParams.glossinessMap === undefined
        ? null
        : materialParams.glossinessMap;
    material.glossiness = materialParams.glossiness;

    material.alphaMap = null;

    material.envMap =
      materialParams.envMap === undefined ? null : materialParams.envMap;
    material.envMapIntensity = 1.0;

    material.refractionRatio = 0.98;

    return material;
  }
}

export async function createGLTFLoader(renderer) {
  // Lazy-load GLTFLoader only when actually needed
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  loader.register((parser) => new GLTFMaterialsPbrSpecularGlossinessExtension(parser));

  if (renderer) {
    try {
      const ktx2 = await createKTX2Loader(renderer);
      if (ktx2) {
        loader.setKTX2Loader(ktx2);
      }
    } catch {
      // Silent fallback: KTX2 loader remains unset.
    }
  }

  try {
    const draco = createDracoLoader();
    if (draco) {
      loader.setDRACOLoader(draco);
    }
  } catch {
    // Silent fallback: DRACO loader remains unset.
  }

  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

async function headOk(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) {
      if (res.status === 405 || res.status === 501) {
        return await probeWithGet(url);
      }
      return false;
    }
    const contentType = res.headers?.get?.("content-type") || "";
    return !contentType.toLowerCase().includes("text/html");
  } catch {
    return await probeWithGet(url);
  }
}

async function probeWithGet(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    if (!res.ok) return false;
    const contentType = res.headers?.get?.("content-type") || "";
    return !contentType.toLowerCase().includes("text/html");
  } catch {
    return false;
  }
}

export async function loadGLBWithFallbacks(loader, urls, options = {}) {
  if (!loader || typeof loader.loadAsync !== "function") {
    return null;
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    return null;
  }

  const {
    targetHeight = null,
    renderer = null,
    onLoaded = null,
    forceProcedural = false,
  } = options;

  if (forceProcedural) {
    return null;
  }

  if (!ENABLE_GLB_MODE && !options.allowSingleModel) {
    return null;
  }

  const baseUrl = resolveBaseUrl();
  const seen = new Set();
  const originalWarn = console.warn;
  const originalError = console.error;

  try {
    console.warn = () => {};
    console.error = () => {};
    for (const candidate of urls) {
    const raw = typeof candidate === "string" ? candidate.trim() : "";
    if (!raw) {
      continue;
    }

    const isAbsolute = /^(?:[a-zA-Z][a-zA-Z\d+.-]*:)?\/\//.test(raw) ||
      /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw);

    const relative = sanitizeRelativePath(raw);
    if (!relative && !isAbsolute) {
      continue;
    }

    const candidatesToTry = Array.from(
      new Set(
        isAbsolute
          ? [raw]
          : [joinPath(baseUrl, relative), relative]
      )
    );

      for (const url of candidatesToTry) {
        if (!url) continue;
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);

        if (!(await headOk(url))) {
          continue;
        }
        try {
          const gltf = await loader.loadAsync(url);
          const { scene, scenes } = gltf || {};
          const bufferScene = scene || (Array.isArray(scenes) ? scenes[0] : null);
          const root = bufferScene || null;
          if (!root) throw new Error(`No scene in GLB: ${url}`);

          if (targetHeight && targetHeight > 0) {
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const currentH = size.y || 1;
            const scaleFactor = currentH !== 0 ? targetHeight / currentH : 1;
            if (Number.isFinite(scaleFactor) && scaleFactor > 0) {
              root.scale.multiplyScalar(scaleFactor);
            }
          }

          applyTextureBudgetToObject(root, { renderer });

          if (typeof onLoaded === "function") {
            try {
              onLoaded({ url, gltf, root });
            } catch {
              // Silent fallback: ignore onLoaded hook errors.
            }
          }

          return { url, gltf, root };
        } catch {
        }
      }
    }
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }

  return null;
}
