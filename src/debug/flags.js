// src/debug/flags.js

// We force these to FALSE to remove the green/blue overlays
export const DEBUG_FLAGS = {
  harbor: false,        // Hides Harbor District debug planes
  drawZones: false,     // Hides general zoning heatmaps
  showDistricts: false, // Hides district boundaries
  
  // Keep the logic below commented out in case you need it later
  /*
  harbor: (typeof import.meta !== "undefined" && import.meta.env?.DEBUG_HARBOR === "1") ||
          (typeof process !== "undefined" && process.env?.DEBUG_HARBOR === "1") ||
          (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("DEBUG_HARBOR") === "1"),
  */
};
