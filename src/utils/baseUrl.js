// src/utils/baseUrl.js

// This constant is preserved for compatibility if other files import it,
// but it is no longer used for base URL resolution logic.
export const REPO_SEGMENT = "athens-game-starter";

function normalizeAbsoluteBaseUrl(value) {
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

function normalizeRelativeBaseUrl(value) {
  if (typeof value !== "string") return value;
  if (/^(?:[a-z]+:)?\/\//i.test(value)) return value;
  return value.replace(
    new RegExp(`/${REPO_SEGMENT}(?:/${REPO_SEGMENT})+`, "gi"),
    `/${REPO_SEGMENT}`,
  );
}

export function resolveBaseUrl() {
  let base = "/";
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === "string"
  ) {
    base = import.meta.env.BASE_URL;
  }

  // If it's a full URL (http/https), return as is
  if (/^(?:[a-z]+:)?\/\//i.test(base)) {
    return normalizeAbsoluteBaseUrl(base);
  }

  // Ensure it starts with a slash
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }

  return normalizeRelativeBaseUrl(base);
}

export function normalizeBaseUrl(base) {
  const b = base || resolveBaseUrl();
  const normalized = /^(?:[a-z]+:)?\/\//i.test(b)
    ? normalizeAbsoluteBaseUrl(b)
    : b;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export function joinPath(base, rel) {
  const effectiveBase = base || resolveBaseUrl();
  if (!rel) return effectiveBase;

  // If rel is absolute URL, return it
  if (/^(?:[a-z]+:)?\/\//i.test(rel)) {
    return rel;
  }

  // Ensure base ends with slash
  const baseSlash = effectiveBase.endsWith("/")
    ? effectiveBase
    : `${effectiveBase}/`;

  // Remove leading slash from rel to avoid breaking out of base
  const relClean = rel.replace(/^\/+/, "");

  return `${baseSlash}${relClean}`;
}
