// src/world/landmarks.js
// -----------------------------------------------------------------------------
// NEUTRALIZED: Landmark system has been permanently disabled.
// -----------------------------------------------------------------------------

/**
 * @param {THREE.Scene} scene
 * @param {Object} config - { type, x, y, z, ... }
 */
export async function loadLandmark(scene, config) {
  throw new Error("loadLandmark called but landmarks are disabled");
}
