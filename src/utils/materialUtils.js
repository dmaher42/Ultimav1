export function applyForegroundFogPolicy(object) {
  // Originally disabled fog on foreground objects.
  // We now leave fog enabled to support depth fading and atmospheric perspective.
  // This function is kept for API compatibility but performs no operations.

  /*
  if (!object || typeof object.traverse !== 'function') return;
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => {
          if (m) m.fog = false;
        });
      } else {
        child.material.fog = false;
      }
    }
  });
  */
}

// Alias for backward compatibility
export const disableFog = applyForegroundFogPolicy;
