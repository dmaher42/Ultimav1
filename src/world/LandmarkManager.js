// src/world/LandmarkManager.js
// -----------------------------------------------------------------------------
// NEUTRALIZED: Landmark system has been permanently disabled.
// This class is now a hollow shell to satisfy any lingering imports without
// executing any logic.
// -----------------------------------------------------------------------------

export class LandmarkManager {
  constructor(options = {}) {
    throw new Error("Landmarks are disabled in this project");
  }

  setTerrain(terrain) {}
  setHeightSampler(sampler) {}
  setParent(parent) {}
  setSpawnPlaceholder(spawnPlaceholder) {}
  setActiveScenes(scenes) {}
  addActiveScene(scene) {}
  isGroupActive(group) { return false; }

  resolveSurfaceOffset(spec = {}) { return 0; }
  resolveSnapOptions(spec = {}) { return {}; }
  resolvePosition(spec = {}) { return null; }
  prepareTransform(spec = {}) { return {}; }
  resolveUrls(files = []) { return []; }
  applyCollisionSettings(object, shouldCollide) {}
  resolveProceduralBuilder(name) { return null; }
  applyTransformToObject(object, transformInfo) {}

  async spawnProcedural(spec = {}, transformInfo = {}, overrides = {}) {
    return null;
  }

  async spawnProceduralFallback(spec = {}, transformInfo = {}, context = {}) {
    return null;
  }

  snapObject(object, transformInfo) {}
  reparent(object) {}
  logMessage(level, message) {}
  spawnFallbackPlaceholder(spec, transformInfo) { return null; }
  async attemptLoad(urls, spec, transformInfo, label) { return null; }

  async placeLandmark(spec = {}) {
    return null;
  }

  async loadConfig(config) {
    return [];
  }
}

export default LandmarkManager;
