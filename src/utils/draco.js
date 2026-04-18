import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export const DEFAULT_DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/";

const LOCAL_DECODER_SUBPATH = "draco/";
const ABSOLUTE_PROTOCOL_REGEX = /^[a-z]+:\/\//i;
const PROTOCOL_RELATIVE_REGEX = /^\/\//;

function ensureTrailingSlash(value) {
  if (typeof value !== "string" || value.length === 0) {
    return value;
  }
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveBaseUrl() {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === "string"
  ) {
    return ensureTrailingSlash(import.meta.env.BASE_URL);
  }
  return "/";
}

function resolveProtocol() {
  if (typeof window !== "undefined" && window.location?.protocol) {
    return window.location.protocol;
  }
  return "https:";
}

function normaliseCandidate(candidate, baseUrl) {
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (PROTOCOL_RELATIVE_REGEX.test(trimmed)) {
    const protocol = resolveProtocol();
    return ensureTrailingSlash(`${protocol}${trimmed}`);
  }

  const safeBase = `https://example.com${baseUrl}`;

  try {
    const resolved = new URL(trimmed, safeBase);

    if (ABSOLUTE_PROTOCOL_REGEX.test(trimmed)) {
      return ensureTrailingSlash(resolved.href);
    }

    if (resolved.origin !== "https://example.com") {
      return ensureTrailingSlash(resolved.href);
    }

    return ensureTrailingSlash(resolved.pathname);
  } catch {
    return ensureTrailingSlash(trimmed);
  }
}

export function resolveDracoDecoderPath() {
  const baseUrl = resolveBaseUrl();

  const candidates = [];

  const meta = typeof import.meta !== "undefined" ? import.meta : null;
  const env = meta && meta.env ? meta.env : null;
  if (env && typeof env.VITE_DRACO_DECODER_PATH === "string") {
    candidates.push(env.VITE_DRACO_DECODER_PATH);
  }

  if (typeof window !== "undefined" && typeof window.__DRACO_DECODER_PATH__ === "string") {
    candidates.push(window.__DRACO_DECODER_PATH__);
  }

  candidates.push(LOCAL_DECODER_SUBPATH);
  candidates.push(DEFAULT_DRACO_DECODER_PATH);

  for (const candidate of candidates) {
    const normalised = normaliseCandidate(candidate, baseUrl);
    if (normalised) {
      return normalised;
    }
  }

  return DEFAULT_DRACO_DECODER_PATH;
}

let sharedDracoLoader = null;
let currentDecoderPath = null;

export function createDracoLoader() {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
  }

  const decoderPath = resolveDracoDecoderPath();
  if (decoderPath && decoderPath !== currentDecoderPath) {
    sharedDracoLoader.setDecoderPath(decoderPath);
    try {
      sharedDracoLoader.preload();
    } catch (error) {
      console.warn("DRACOLoader.preload failed; continuing with lazy decoding", error);
    }
    currentDecoderPath = decoderPath;
  }

  return sharedDracoLoader;
}
