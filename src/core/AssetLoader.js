import * as THREE from "three";

import {
  joinPath,
  resolveBaseUrl,
} from "../utils/baseUrl.js";
import { IS_DEV } from "../utils/env.js";
import {
  getManifestProbes,
  getGlbProbeCandidates,
  getQuickChecks,
  getAssetCandidates,
} from "../config/AssetConfig.js";

const HTML_CONTENT_TYPE = /text\/html/i;
// Kept for backward compat in regex if needed, but not imported
const REPO_SEGMENT = "athens-game-starter";

const TRUE_JSON_PROBE = /audio\/manifest\.json|config\/districts\.json|docs\/config\/districts\.json/i;
const GLB_EXTENSION = /\.glb(?:$|[?#])/i;
const GLB_MODELS_PATH = /models\/(?:landmarks|buildings)\/.+\.glb(?:$|[?#])/i;

export let ARISTOTLE_CANDIDATES = getAssetCandidates("aristotle");
export let POSEIDON_CANDIDATES = getAssetCandidates("poseidon");
export let AKROPOL_CANDIDATES = getAssetCandidates("akropol");

function isHtmlResponse(res) {
  return HTML_CONTENT_TYPE.test(res.headers.get("content-type") || "");
}

function sanitizeRelativePath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^docs\//i, "")
    .replace(/^athens-game-starter\//i, "")
    .replace(/^\.\//, "");
}

function normalizeRepoRelativeCandidate(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutLeading = trimmed.replace(/^\/+/, "");
  const repoPrefix = new RegExp(`^(?:${REPO_SEGMENT}/)+`, "i");
  return withoutLeading.replace(repoPrefix, "");
}

function normalizeRepoPrefixedPath(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("/")) return trimmed;
  const withoutLeading = trimmed.replace(/^\/+/, "");
  const repoPrefix = new RegExp(`^(?:${REPO_SEGMENT}/)+`, "i");
  if (!repoPrefix.test(withoutLeading)) {
    return trimmed;
  }
  const stripped = withoutLeading.replace(repoPrefix, "");
  return `/${REPO_SEGMENT}/${stripped}`;
}

function normalizeAbsoluteRepoUrl(value) {
  if (typeof value !== "string") return value;
  if (!/^(?:[a-z]+:)?\/\//i.test(value)) return value;
  try {
    const parsed = new URL(value);
    parsed.pathname = parsed.pathname.replace(
      new RegExp(`/${REPO_SEGMENT}(?:/${REPO_SEGMENT})+`, "gi"),
      `/${REPO_SEGMENT}`,
    );
    return parsed.toString();
  } catch {
    return value;
  }
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^(?:[a-z]+:)?\/\//i.test(trimmed)) {
    return normalizeAbsoluteRepoUrl(trimmed);
  }
  if (trimmed.startsWith("/")) {
    return normalizeRepoPrefixedPath(trimmed);
  }
  return normalizeRepoPrefixedPath(`/${trimmed}`);
}

export class AssetLoader {
  constructor({
    baseUrl = resolveBaseUrl(),
    forceProcedural = false,
    districtRuleCandidates = [],
    enableGlbMode = true,
  } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.forceProcedural = Boolean(forceProcedural);
    this.districtRuleCandidates = districtRuleCandidates;
    this.enableGlbMode = Boolean(enableGlbMode);
  }

  async probeInitialAssets({
    additionalProbes = [],
    glbCandidates = [],
    includeGlbCandidates = !this.forceProcedural,
  } = {}) {
    const ENABLE_GLB_MODE = this.enableGlbMode;
    if (!ENABLE_GLB_MODE) return;

    const base = this.baseUrl ?? resolveBaseUrl();
    if (IS_DEV) console.log("[base:resolved]", base);

    const manifestProbes = getManifestProbes();
    const probes = [
      ...manifestProbes,
      ...this.districtRuleCandidates,
      ...additionalProbes,
    ];
    if (includeGlbCandidates) {
      const candidatesToUse =
        glbCandidates && glbCandidates.length > 0
          ? glbCandidates
          : getGlbProbeCandidates();
      probes.push(...candidatesToUse);
    }

    const probeTasks = probes.map(async (relativePath) => {
      let url;
      if (
        relativePath.startsWith(base) ||
        /^(?:[a-z]+:)?\/\//i.test(relativePath)
      ) {
        url = relativePath;
      } else {
        url = joinPath(base, relativePath);
      }

      try {
        const method = url.endsWith(".json") ? "GET" : "HEAD";
        const response = await fetch(url, { method, cache: "no-cache" });
        if (IS_DEV)
          console.log(
            "[probe]",
            relativePath,
            response.status,
            response.ok,
            url,
          );
      } catch (error) {
        if (IS_DEV) console.warn("[probe-failed]", relativePath, url, error);
      }
    });

    await Promise.all(probeTasks);

    if (IS_DEV) console.log("[base]", base);
  }

  async headOk(url) {
    const rawTarget = typeof url === "string" ? url : String(url ?? "");
    const target = normalizeAbsoluteRepoUrl(rawTarget);
    const isJsonProbe = TRUE_JSON_PROBE.test(target);
    const isGlbProbe = GLB_EXTENSION.test(target);
    const fallbackStatuses = new Set([403, 405, 501]);
    const ENABLE_GLB_MODE = this.enableGlbMode;

    if (this.forceProcedural && isGlbProbe) {
      return false;
    }

    if (!ENABLE_GLB_MODE && isGlbProbe) {
      return false;
    }

    const options = isJsonProbe
      ? { method: "GET", cache: "no-cache" }
      : { method: "HEAD" };

    try {
      const res = await fetch(url, options);
      if (!isJsonProbe && !res.ok && fallbackStatuses.has(res.status)) {
        if (IS_DEV) console.warn(
          "[asset-check:head-denied]",
          res.status,
          "retrying GET",
          url,
        );
        const getRes = await fetch(url, { method: "GET", cache: "no-cache" });
        const ok = getRes.ok && !isHtmlResponse(getRes);
        if (IS_DEV) console.log(
          "[asset-check:get-fallback]",
          getRes.status,
          ok,
          url,
        );
        return ok;
      }
      return res.ok && !isHtmlResponse(res);
    } catch (error) {
      return false;
    }
  }

  async resolveFirstAvailableAsset(candidates = []) {
    const ENABLE_GLB_MODE = this.enableGlbMode;
    if (this.forceProcedural) {
      return null;
    }

    const seen = new Set();
    for (const url of candidates) {
      if (typeof url !== "string") continue;
      const trimmed = url.trim();
      if (!trimmed) continue;
      if (!ENABLE_GLB_MODE && GLB_MODELS_PATH.test(trimmed)) {
        return null;
      }

      if (/^(?:[a-z]+:)?\/\//i.test(trimmed)) {
        if (!seen.has(trimmed) && (await this.headOk(trimmed))) {
          return trimmed;
        }
        seen.add(trimmed);
        continue;
      }

      const relative = sanitizeRelativePath(trimmed);
      if (!relative) {
        continue;
      }

      const candidatesToTry = Array.from(
        new Set(
          [joinPath(this.baseUrl, relative), relative],
        ),
      );

      for (const candidate of candidatesToTry) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        if (await this.headOk(candidate)) {
          return candidate;
        }
      }
    }

    throw new Error("No candidate asset reachable: " + candidates.join(", "));
  }

  async runAssetQuickChecks() {
    const baseUrl = this.baseUrl ?? resolveBaseUrl();
    const districtCandidates = [];
    for (const candidate of this.districtRuleCandidates) {
      if (typeof candidate !== "string") continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith("/")) {
        const normalized = normalizeAbsoluteRepoUrl(trimmed);
        districtCandidates.push(normalizeRepoPrefixedPath(normalized));
        continue;
      }
      const normalized = normalizeRepoRelativeCandidate(trimmed);
      if (!normalized) continue;
      const joined = joinPath(baseUrl, normalized);
      districtCandidates.push(normalizeAbsoluteRepoUrl(joined));
    }
    let resolvedDistrictPath = null;
    for (const candidate of districtCandidates) {
      if (await this.headOk(candidate)) {
        resolvedDistrictPath = candidate;
        break;
      }
    }

    const quickChecks = getQuickChecks();

    const results = [];
    const missingChecks = [];
    const missingCriticalChecks = [];
    const isCriticalCheck = (entry) => {
      const label = entry?.label?.toLowerCase?.() ?? "";
      const path = entry?.path?.toLowerCase?.() ?? "";
      return label.includes("district") || path.includes("config/districts.json");
    };
    await Promise.all(
      quickChecks.map(async (entry) => {
        const label = entry.label || "Unnamed Check";
        const targets = [];
        const critical = isCriticalCheck(entry);

        if (typeof entry.path === "string" && entry.path.trim()) {
          const pathValue = entry.path.trim();
          if (/config\/districts\.json$/i.test(pathValue)) {
            if (resolvedDistrictPath) {
              targets.push(normalizeAbsoluteRepoUrl(resolvedDistrictPath));
            }
            for (const candidate of districtCandidates) {
              targets.push(normalizeAbsoluteRepoUrl(candidate));
            }
          } else if (/^(?:[a-z]+:)?\/\//i.test(pathValue)) {
            targets.push(normalizeAbsoluteRepoUrl(pathValue));
          } else {
            const normalizedPath = /athens-game-starter\//i.test(pathValue)
              ? normalizeRepoRelativeCandidate(pathValue)
              : pathValue;
            targets.push(joinPath(baseUrl, normalizedPath));
          }
        }

        if (
          typeof entry.candidateKey === "string" &&
          entry.candidateKey.trim()
        ) {
          const candidateList = getAssetCandidates(entry.candidateKey.trim());
          for (const rel of candidateList) {
            targets.push(joinPath(baseUrl, rel));
          }
        }

        const uniqueTargets = Array.from(new Set(targets.filter(Boolean)));
        if (uniqueTargets.length === 0) {
          results.push({ label, path: "", status: "missing" });
          missingChecks.push({ label, path: "", status: "missing", critical });
          if (critical) {
            missingCriticalChecks.push({ label, path: "", status: "missing" });
          }
          return;
        }

        let status = "missing";
        let usedPath = uniqueTargets[0];
        for (const candidate of uniqueTargets) {
          usedPath = candidate;
          const enableGlbMode = this.enableGlbMode;
          if (!enableGlbMode && GLB_MODELS_PATH.test(candidate)) {
            status = "skipped";
            break;
          }
          if (this.forceProcedural && GLB_EXTENSION.test(candidate)) {
            status = "skipped";
            break;
          }
          const exists = await this.headOk(candidate);
          if (exists) {
            status = "ok";
            break;
          }
        }

        results.push({ label, path: usedPath, status });
        if (status === "missing") {
          missingChecks.push({ label, path: usedPath, status, critical });
          if (critical) {
            missingCriticalChecks.push({ label, path: usedPath, status });
          }
        }
      }),
    );

    if (IS_DEV) {
      if (typeof console?.table === "function") {
        console.table(results, ["label", "path", "status"]);
      } else {
        console.log("Asset QuickChecks", results);
      }
    }

    return {
      results,
      missingChecks,
      missingCriticalChecks,
      missingCount: missingChecks.length,
      hasMissingCritical: missingCriticalChecks.length > 0,
      hasRepeatedFailures: missingChecks.length >= 2,
    };
  }
}

if (import.meta.hot) {
  import.meta.hot.accept("../config/AssetConfig.js", (mod) => {
    const getter = mod?.getAssetCandidates ?? getAssetCandidates;
    ARISTOTLE_CANDIDATES = getter("aristotle");
    POSEIDON_CANDIDATES = getter("poseidon");
    AKROPOL_CANDIDATES = getter("akropol");
  });
}

function hashNoise(x, y, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;

  const n00 = hashNoise(x0, y0, seed);
  const n10 = hashNoise(x0 + 1, y0, seed);
  const n01 = hashNoise(x0, y0 + 1, seed);
  const n11 = hashNoise(x0 + 1, y0 + 1, seed);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const nx0 = THREE.MathUtils.lerp(n00, n10, u);
  const nx1 = THREE.MathUtils.lerp(n01, n11, u);
  return THREE.MathUtils.lerp(nx0, nx1, v);
}

function fbm(
  x,
  y,
  { seed = 0, octaves = 5, persistence = 0.5, lacunarity = 2 } = {},
) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;

  for (let i = 0; i < octaves; i += 1) {
    value +=
      amplitude * smoothNoise(x * frequency, y * frequency, seed + i * 19.19);
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value;
}

function createSolidDataTexture(
  color,
  { colorSpace = THREE.SRGBColorSpace } = {},
) {
  const data = new Uint8Array(4);
  data[0] = (color >> 16) & 0xff;
  data[1] = (color >> 8) & 0xff;
  data[2] = color & 0xff;
  data[3] = 0xff;
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

let cachedMonumentTextures = null;

export function createProceduralMarbleTextures() {
  if (cachedMonumentTextures) {
    return cachedMonumentTextures;
  }

  if (typeof document === "undefined" || !document.createElement) {
    cachedMonumentTextures = {
      map: createSolidDataTexture(0xefecea, {
        colorSpace: THREE.SRGBColorSpace,
      }),
      normalMap: createSolidDataTexture(0x8080ff, {
        colorSpace: THREE.LinearSRGBColorSpace,
      }),
      roughnessMap: createSolidDataTexture(0xb3b3b3, {
        colorSpace: THREE.LinearSRGBColorSpace,
      }),
      aoMap: createSolidDataTexture(0xe0e0e0, {
        colorSpace: THREE.LinearSRGBColorSpace,
      }),
    };
    return cachedMonumentTextures;
  }

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const colorData = ctx.createImageData(size, size);
  const roughnessData = ctx.createImageData(size, size);
  const aoData = ctx.createImageData(size, size);
  const normalData = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);

  const baseScale = 6;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const nx = (x / size) * baseScale;
      const ny = (y / size) * baseScale;

      const structure = fbm(nx * 0.85, ny * 0.9, { seed: 11, octaves: 4 });
      const turbulence = fbm(nx * 2.3, ny * 2.4, {
        seed: 37,
        octaves: 5,
        persistence: 0.55,
        lacunarity: 2.15,
      });
      const swirl = nx * 1.12 + ny * 1.27 + turbulence * 4.2;
      const wave = Math.sin(swirl + structure * 2.6);
      const fineDetail = fbm(nx * 5.2, ny * 5.4, {
        seed: 73,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.8,
      });
      const height = 0.5 + 0.5 * wave * 0.8 + fineDetail * 0.2;
      const veins = Math.pow(
        Math.abs(Math.sin(swirl * 0.6 + fineDetail * 3.4)),
        1.4,
      );

      heights[y * size + x] = height;

      const warmTint = 0.04 + structure * 0.03;
      const baseTone = THREE.MathUtils.clamp(
        0.78 + height * 0.18 + structure * 0.05,
        0,
        1,
      );
      let r = baseTone + warmTint;
      let g = baseTone + warmTint * 0.6;
      let b = baseTone + warmTint * 0.2;
      r = THREE.MathUtils.clamp(r - veins * 0.09, 0, 1);
      g = THREE.MathUtils.clamp(g - veins * 0.07, 0, 1);
      b = THREE.MathUtils.clamp(b - veins * 0.05, 0, 1);

      colorData.data[idx + 0] = Math.round(r * 255);
      colorData.data[idx + 1] = Math.round(g * 255);
      colorData.data[idx + 2] = Math.round(b * 255);
      colorData.data[idx + 3] = 255;

      const rough = THREE.MathUtils.clamp(
        0.42 + veins * 0.32 + fineDetail * 0.12,
        0.18,
        0.88,
      );
      const roughByte = Math.round(rough * 255);
      roughnessData.data[idx + 0] = roughByte;
      roughnessData.data[idx + 1] = roughByte;
      roughnessData.data[idx + 2] = roughByte;
      roughnessData.data[idx + 3] = 255;

      const ao = THREE.MathUtils.clamp(
        0.93 - veins * 0.35 - fineDetail * 0.18,
        0.45,
        1,
      );
      const aoByte = Math.round(ao * 255);
      aoData.data[idx + 0] = aoByte;
      aoData.data[idx + 1] = aoByte;
      aoData.data[idx + 2] = aoByte;
      aoData.data[idx + 3] = 255;
    }
  }

  const sampleHeight = (x, y) => {
    const sx = (x + size) % size;
    const sy = (y + size) % size;
    return heights[sy * size + sx];
  };

  const normalStrength = 2.1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const heightL = sampleHeight(x - 1, y);
      const heightR = sampleHeight(x + 1, y);
      const heightD = sampleHeight(x, y - 1);
      const heightU = sampleHeight(x, y + 1);

      const dx = (heightR - heightL) * normalStrength;
      const dy = (heightU - heightD) * normalStrength;
      const dz = 1;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      normalData.data[idx + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData.data[idx + 3] = 255;
    }
  }

  const textureFromImageData = (imageData, colorSpace) => {
    const texture = new THREE.DataTexture(
      imageData.data,
      imageData.width,
      imageData.height,
      THREE.RGBAFormat,
    );
    texture.needsUpdate = true;
    texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  };

  cachedMonumentTextures = {
    map: textureFromImageData(colorData, THREE.SRGBColorSpace),
    normalMap: textureFromImageData(normalData, THREE.LinearSRGBColorSpace),
    roughnessMap: textureFromImageData(
      roughnessData,
      THREE.LinearSRGBColorSpace,
    ),
    aoMap: textureFromImageData(aoData, THREE.LinearSRGBColorSpace),
  };

  return cachedMonumentTextures;
}
