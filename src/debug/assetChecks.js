// src/debug/assetChecks.js

function resolveBaseUrl() {
  const base =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === "string"
      ? import.meta.env.BASE_URL
      : "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function joinBase(base, path) {
  const safeBase = base.endsWith("/") ? base : `${base}/`;
  return `${safeBase}${path.replace(/^\/+/, "")}`;
}

const TEXTURE_CHECKS = [
  "textures/sand/albedo.jpg",
  "textures/sand/arm.jpg",
  "textures/sand/normal_gl.jpg",
  "textures/grass/albedo.jpg",
  "textures/grass/normal_dx.jpg",
  "textures/water/normals.jpg",
  "textures/water/normals.png",
];

export async function runTextureAssetCheck({ debugAssets = false } = {}) {
  if (!debugAssets || typeof window === "undefined") return;

  const baseUrl = resolveBaseUrl();
  const results = await Promise.all(
    TEXTURE_CHECKS.map(async (relativePath) => {
      const url = joinBase(baseUrl, relativePath);
      try {
        const response = await fetch(url, { method: "GET", cache: "no-cache" });
        return {
          texture: relativePath,
          ok: response.ok,
          status: response.status,
        };
      } catch {
        return {
          texture: relativePath,
          ok: false,
          status: "error",
        };
      }
    }),
  );

  const table = results.map((entry) => ({
    texture: entry.texture,
    status: entry.ok ? "PASS" : "FAIL",
    http: entry.status,
  }));

  console.info("[assets] texture availability check");
  console.table(table);
}
