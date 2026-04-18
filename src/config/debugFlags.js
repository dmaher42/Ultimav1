// Runtime debug rendering flag utilities
// Controls whether debug visualizations are allowed to be added to the scene.
// Default: disabled unless explicitly enabled by URL param, localStorage, or window override.

export function isDebugRenderEnabled() {
  // Must be running in a browser and in development environment
  const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
  if (!isDev) return false;

  // Explicit URL param ?debugRender=1 takes precedence
  try {
    if (typeof window !== "undefined" && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.has("debugRender")) {
        const v = params.get("debugRender");
        return v === null || String(v) === "1" || String(v).toLowerCase() === "true";
      }
    }
  } catch {}

  // LocalStorage toggle (persisted per-dev machine)
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem("debugRender");
      if (stored != null) {
        return stored === "1" || String(stored).toLowerCase() === "true";
      }
    }
  } catch {}

  // Optional global override (for quick debug enabling from console)
  try {
    if (typeof window !== "undefined" && typeof window.DEBUG_RENDER === "boolean") {
      return window.DEBUG_RENDER;
    }
  } catch {}

  return false;
}

export function enableDebugRenderPersistent(value = true) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("debugRender", value ? "1" : "0");
    }
  } catch {}
}
