// src/materials/materialRegistry.js

function resolveBaseUrl() {
  const base =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === "string"
      ? import.meta.env.BASE_URL
      : "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function joinBase(base, relativePath) {
  const safeBase = base.endsWith("/") ? base : `${base}/`;
  const safePath = relativePath.replace(/^\/+/, "");
  return `${safeBase}${safePath}`;
}

const BASE_URL = resolveBaseUrl();

export const MATERIALS = {
  sand: {
    albedo: joinBase(BASE_URL, "textures/sand/albedo.jpg"),
    normal: joinBase(BASE_URL, "textures/sand/normal_gl.jpg"),
    arm: joinBase(BASE_URL, "textures/sand/arm.jpg"),
  },
  grass: {
    albedo: joinBase(BASE_URL, "textures/grass/albedo.jpg"),
    normal: joinBase(BASE_URL, "textures/grass/normal_dx.jpg"),
    roughness: joinBase(BASE_URL, "textures/grass/roughness.jpg"),
    metallic: joinBase(BASE_URL, "textures/grass/metallic.jpg"),
    ao: joinBase(BASE_URL, "textures/grass/ao.jpg"),
    height: joinBase(BASE_URL, "textures/grass/height.jpg"),
  },
  stoneFallback: {
    albedo: joinBase(BASE_URL, "textures/marble_base.jpg"),
  },
  dirt: {
    albedo: joinBase(BASE_URL, "textures/ground/dirt-albedo.jpg"),
  },
};
