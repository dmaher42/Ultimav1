// src/world/seaLevelState.js

// Default sea level Y coordinate
export const DEFAULT_SEA_LEVEL_Y = -1.0; // Default water height
export const SEA_LEVEL_Y = DEFAULT_SEA_LEVEL_Y;

let currentSeaLevelY = DEFAULT_SEA_LEVEL_Y;
const subscribers = new Set();

/**
 * Get the current sea level Y coordinate.
 */
export function getSeaLevelY() {
  return currentSeaLevelY;
}

/**
 * Update the global sea level and notify listeners.
 * Returns true if the value actually changed.
 */
export function setSeaLevelY(y, source = "unknown") {
  if (!Number.isFinite(y)) {
    console.warn(`[SeaLevel] Invalid Y: ${y} from ${source}`);
    return false;
  }
  
  if (Math.abs(currentSeaLevelY - y) < 1e-4) {
    return false;
  }

  const oldY = currentSeaLevelY;
  currentSeaLevelY = y;
  
  // Notify subscribers
  for (const callback of subscribers) {
    try {
      callback(currentSeaLevelY, oldY);
    } catch (err) {
      console.error("[SeaLevel] Subscriber error:", err);
    }
  }
  
  return true;
}

/**
 * Subscribe to sea level changes.
 * The callback receives (newY, oldY).
 */
export function subscribeSeaLevelChange(callback) {
  if (typeof callback === "function") {
    subscribers.add(callback);
    // Immediately call with current value so they sync up
    callback(currentSeaLevelY, currentSeaLevelY);
  }
  return () => subscribers.delete(callback);
}
