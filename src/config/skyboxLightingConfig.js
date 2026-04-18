import { joinPath, resolveBaseUrl } from "../utils/baseUrl.js";

const baseUrl = resolveBaseUrl();

export const skyboxLightingConfig = {
  // Load the custom Athens sunset skybox shipped in public/assets/skyboxes.
  skyboxUrl: joinPath(baseUrl, "assets/skyboxes/athens_sunset_360.png"),
  sunAzimuthDeg: 205,
  sunElevationDeg: 40,
  sunDistance: 2000,
  sunTarget: { x: 0, y: 0, z: 0 },
};
