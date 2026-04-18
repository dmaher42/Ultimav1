// KTX2Loader will be dynamically imported only if needed

export const DEFAULT_BASIS_TRANSCODER_PATH =
  "https://unpkg.com/three@0.180.0/examples/jsm/libs/basis/";

const LOCAL_TRANSCODER_SUBPATH = "basis/";
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

export function resolveKTX2TranscoderPath() {
  const baseUrl = resolveBaseUrl();

  const candidates = [];

  const meta = typeof import.meta !== "undefined" ? import.meta : null;
  const env = meta && meta.env ? meta.env : null;
  if (env && typeof env.VITE_BASIS_TRANSCODER_PATH === "string") {
    candidates.push(env.VITE_BASIS_TRANSCODER_PATH);
  }

  if (typeof window !== "undefined" && typeof window.__BASIS_TRANSCODER_PATH__ === "string") {
    candidates.push(window.__BASIS_TRANSCODER_PATH__);
  }

  candidates.push(LOCAL_TRANSCODER_SUBPATH);
  candidates.push(DEFAULT_BASIS_TRANSCODER_PATH);

  for (const candidate of candidates) {
    const normalised = normaliseCandidate(candidate, baseUrl);
    if (normalised) {
      return normalised;
    }
  }

  return DEFAULT_BASIS_TRANSCODER_PATH;
}

export async function createKTX2Loader(renderer) {
  const { KTX2Loader } = await import("three/examples/jsm/loaders/KTX2Loader.js");
  const loader = new KTX2Loader();
  const path = resolveKTX2TranscoderPath();
  loader.setTranscoderPath(path);

  if (renderer) {
    try {
      loader.detectSupport(renderer);
    } catch (error) {
      console.warn("KTX2Loader.detectSupport failed; continuing without GPU compression", error);
    }
  }

  return loader;
}
