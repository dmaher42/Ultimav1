import { joinPath } from "../utils/baseUrl.js";
import {
  assert,
  deepFreeze,
  ensureArrayOfStrings,
  getRuntimeEnvironment,
  mergeDeep,
} from "./utils.js";

const DEFAULT_ASSET_CONFIG = {
  manifestProbes: ["audio/manifest.json", "models/npcs/manifest.json"],
  probeGlbCandidates: [],
  quickChecks: [
    { label: "Audio Manifest", path: "audio/manifest.json" },
    { label: "Aristotle Tomb", candidateKey: "aristotle" },
    { label: "District Rules", path: "config/districts.json" },
    { label: "Ground Dirt Albedo", path: "textures/ground/dirt-albedo.jpg" },
    { label: "Ground Grass Albedo", path: "textures/grass/albedo.jpg" },
    { label: "Water Normals", path: "textures/water/normals.png" },
  ],
  candidates: {
    aristotle: [
      "models/buildings/aristotle_tomb_in_macedonia_greece.glb",
    ],
  },
};

const ENVIRONMENT_OVERRIDES = {
  development: {
    quickChecks: [
      { label: "Audio Manifest", path: "audio/manifest.json" },
      { label: "Aristotle Tomb", candidateKey: "aristotle" },
      { label: "District Rules", path: "config/districts.json" },
      { label: "Ground Dirt Albedo", path: "textures/ground/dirt-albedo.jpg" },
      { label: "Ground Grass Albedo", path: "textures/grass/albedo.jpg" },
      { label: "Water Normals", path: "textures/water/normals.png" },
    ],
  },
};

function sanitizeCandidatePath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^athens-game-starter\//i, "")
    .replace(/^\.\//, "");
}

function sanitizeQuickCheckPath(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^\/+/, "")
    .replace(/^athens-game-starter\//i, "")
    .replace(/^\.\//, "");
}

function validateQuickChecks(config) {
  assert(Array.isArray(config.quickChecks), "quickChecks must be an array");
  for (const entry of config.quickChecks) {
    assert(entry && typeof entry === "object", "quick check entry must be object");
    assert(typeof entry.label === "string" && entry.label.trim() !== "", "quick check label required");
    assert(
      typeof entry.path === "string" || typeof entry.candidateKey === "string",
      "quick check must specify path or candidateKey",
    );
  }
}

function validateCandidates(map) {
  assert(map && typeof map === "object", "candidates must be an object map");
  for (const [key, list] of Object.entries(map)) {
    ensureArrayOfStrings(list, { allowEmpty: false, label: `candidates.${key}` });
  }
}

export function createAssetConfig(environment = getRuntimeEnvironment(), overrides = {}) {
  const envOverrides = ENVIRONMENT_OVERRIDES[environment] || {};
  const merged = mergeDeep({}, DEFAULT_ASSET_CONFIG, envOverrides, overrides);
  if (Array.isArray(merged.quickChecks)) {
    merged.quickChecks = merged.quickChecks.map((entry) => {
      if (!entry || typeof entry !== "object" || typeof entry.path !== "string") {
        return entry;
      }
      return {
        ...entry,
        path: sanitizeQuickCheckPath(entry.path),
      };
    });
  }
  validateCandidates(merged.candidates);
  validateQuickChecks(merged);
  const frozen = deepFreeze(merged);
  return frozen;
}

export let assetConfig = createAssetConfig();

export function getAssetCandidates(key) {
  const list = assetConfig?.candidates?.[key];
  if (!Array.isArray(list)) return [];
  return list.map((item) => sanitizeCandidatePath(item)).filter(Boolean);
}

export function resolveAssetCandidates(key, { baseUrl, includeRelative = true } = {}) {
  const sanitized = getAssetCandidates(key);
  if (!baseUrl) {
    return includeRelative ? [...sanitized] : [];
  }
  const resolved = [];
  const seen = new Set();
  for (const entry of sanitized) {
    if (includeRelative && !seen.has(entry)) {
      seen.add(entry);
      resolved.push(entry);
    }
    const joined = joinPath(baseUrl, entry);
    if (!seen.has(joined)) {
      seen.add(joined);
      resolved.push(joined);
    }
  }
  return resolved;
}

export function resolveAssetPath(path, baseUrl) {
  const sanitized = sanitizeCandidatePath(path);
  if (!sanitized) return "";
  if (!baseUrl) return sanitized;
  return joinPath(baseUrl, sanitized);
}

export function getManifestProbes() {
  return [...(assetConfig.manifestProbes || [])];
}

export function getGlbProbeCandidates() {
  return [...(assetConfig.probeGlbCandidates || [])];
}

export function getQuickChecks() {
  return [...(assetConfig.quickChecks || [])];
}

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    assetConfig = mod?.createAssetConfig
      ? mod.createAssetConfig(getRuntimeEnvironment())
      : createAssetConfig(getRuntimeEnvironment());
  });
}
