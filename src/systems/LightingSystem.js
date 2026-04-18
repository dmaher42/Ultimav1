import * as THREE from "three";
import { DynamicSky } from "../world/sky/DynamicSky.js";
import { createLighting, updateLighting } from "../world/lighting.js";
import { azElToDirection } from "../world/lighting/sunAlignment.js";
import { setTimeOfDayPhase } from "../world/sky.js";
import { LIGHTING_PRESETS as LOOK_PROFILES } from "../config/LookProfiles.js";
import { lightingConfig } from "../config/LightingConfig.js";
import { skyboxLightingConfig } from "../config/skyboxLightingConfig.js";
import { loadHdriEnvironment } from "../world/env/loadHdriEnvironment.js";
import { joinPath } from "../utils/baseUrl.js";
// EnvironmentManager stubs removed, using EnvironmentManager.js central class.
import { updateOcean } from "../world/ocean.js";
import { updateHarborLighting } from "../world/harbor.js";
import { updateMainHillRoadLighting } from "../world/roads_hillcity.js";
import { setNightFactor as setGrassNightFactor } from "../world/grass.js";

const LIGHTING_PRESETS = LOOK_PROFILES;
const SUN_AZIMUTH_STORAGE_KEY = "skybox.sunAzimuthDeg";
const SUN_ELEVATION_STORAGE_KEY = "skybox.sunElevationDeg";

function startTimeOfDayCycle(options = {}) {
    const minutesPerDayRaw = options.minutesPerDay ?? 20;
    const minutesPerDay = Number.isFinite(minutesPerDayRaw)
      ? Math.max(0, minutesPerDayRaw)
      : 0;
    const secondsPerDay = minutesPerDay * 60;

    return {
      secondsPerDay,
      phaseAt(elapsedSeconds = 0) {
        if (!Number.isFinite(elapsedSeconds) || secondsPerDay <= 0) {
          return 0;
        }
        const wrapped =
          ((elapsedSeconds % secondsPerDay) + secondsPerDay) % secondsPerDay;
        return wrapped / secondsPerDay;
      },
    };
  }

function syncFogToSky(scene, radius) {
    if (!scene) return;
    const getFogOptions = scene.userData?.getFogOptions;
    const setFogOptions = scene.userData?.setFogOptions;
    if (typeof setFogOptions !== "function") return;

    const fogState = typeof getFogOptions === "function" ? getFogOptions() : null;
    const skySettings = scene.userData?.sky?.settings;
    const horizonColor = skySettings?.horizon
      ? new THREE.Color(skySettings.horizon)
      : fogState?.color ?? new THREE.Color(0xbfd5ff);

    const fogNear = Math.max(200, Math.min(fogState?.near ?? 230, 260));
    const fogFar = Math.max(
      fogNear + 520,
      Math.min(radius * 0.78, fogState?.far ?? radius * 0.78),
    );

    setFogOptions({
      color: horizonColor,
      near: fogNear,
      far: fogFar,
    });
  }

function createDefaultSky(scene, skyInstance = null) {
    if (!scene) return null;

    const fallbackSky = skyInstance || new DynamicSky(scene);
    const defaultDirection = azElToDirection(90, 45);

    if (typeof fallbackSky.setSunDirection === "function") {
      fallbackSky.setSunDirection(defaultDirection);
    } else if (fallbackSky.sunLight) {
      fallbackSky.sunLight.position.copy(defaultDirection).multiplyScalar(320);
    }

    if (!scene.background || scene.background === null) {
      scene.background = fallbackSky.sky ?? new THREE.Color(0xbfd5ff);
    } else {
      scene.background = fallbackSky.sky ?? fallbackSky;
    }

    let sunLight = fallbackSky.sunLight;
    if (!sunLight) {
      sunLight = new THREE.DirectionalLight(0xffffff, 2);
      sunLight.position.set(1, 1, 0).normalize();
      scene.add(sunLight);
    } else if (!sunLight.parent) {
      scene.add(sunLight);
    }

    const horizonColor = fallbackSky.settings?.horizon
      ? new THREE.Color(fallbackSky.settings.horizon)
      : scene.userData?.sky?.settings?.horizon
        ? new THREE.Color(scene.userData.sky.settings.horizon)
        : null;

    if (scene.userData?.setFogOptions) {
      scene.userData.setFogOptions({
        color: horizonColor ?? new THREE.Color(0xbfd5ff),
        near: 40,
        far: 300,
      });
    }

    syncFogToSky(scene, 320);

    return { sky: fallbackSky, sunLight };
  }

export class LightingSystem {
    constructor({ scene, renderer, sceneContext, baseUrl, onFogChange, devHud }) {
        this.scene = scene;
        this.renderer = renderer;
        this.sceneContext = sceneContext;
        this.baseUrl = baseUrl;
        this.onFogChange = onFogChange;
        this.devHud = devHud;

        this.sunTargetVector = new THREE.Vector3(
            skyboxLightingConfig.sunTarget?.x ?? 0,
            skyboxLightingConfig.sunTarget?.y ?? 0,
            skyboxLightingConfig.sunTarget?.z ?? 0,
        );
        this.sunDistance = Number.isFinite(skyboxLightingConfig.sunDistance)
            ? skyboxLightingConfig.sunDistance
            : 1000;

        this.sunAlignmentState = {
            azimuthDeg: this._wrapAzimuth(
                this._readStoredNumber(
                    SUN_AZIMUTH_STORAGE_KEY,
                    skyboxLightingConfig.sunAzimuthDeg,
                ),
            ),
            elevationDeg: this._clampElevation(
                this._readStoredNumber(
                    SUN_ELEVATION_STORAGE_KEY,
                    skyboxLightingConfig.sunElevationDeg,
                ),
            ),
        };

        this.moonState = {
            azimuthDeg: this._wrapAzimuth(skyboxLightingConfig.sunAzimuthDeg + 180),
            elevationDeg: -10,
            intensity: 0.0,
            visible: false,
        };

        this.dayCycle = startTimeOfDayCycle(lightingConfig.cycle || {});
        this.timeOfDayState = { timeOfDayPhase: 0 };
        setTimeOfDayPhase(this.timeOfDayState, 0.4);

        this.LIGHTING_PHASE_WINDOWS = [
            { name: "Blue Hour", start: 0.0, end: 0.12 },
            { name: "Golden Hour", start: 0.12, end: 0.25 },
            { name: "Bright Noon", start: 0.25, end: 0.7 },
            { name: "Golden Hour", start: 0.7, end: 0.85 },
            { name: "Blue Hour", start: 0.85, end: 0.95 },
            { name: "Night", start: 0.95, end: 1.0 },
        ];

        this.currentLookProfile = null;
        this.lastAppliedLightingPreset = null;
        this.userPresetActive = false;
        this.activeLightingTransition = null;
    }

    async initialize() {
        const { scene, renderer, sunDistance, sunTargetVector, sunAlignmentState } = this;

        this.dynamicSky = new DynamicSky(scene, {
            sunDistance,
            sunTarget: sunTargetVector,
            azimuthOffsetDeg: sunAlignmentState.azimuthDeg,
        });
        this.hdriEnvMap = null;

        const moonGeometry = new THREE.SphereGeometry(10, 32, 32);
        const moonMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.4,
        });
        this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.moonMesh.name = "moonMesh";
        this.moonMesh.visible = false;

        this.moonLight = new THREE.DirectionalLight(0xaadfff, 0.4);
        this.moonLight.name = "moonLight";
        this.moonLight.castShadow = false;
        this.moonLight.visible = false;

        scene.background = this.dynamicSky.sky;
        scene.add(this.moonMesh);
        scene.add(this.moonLight);
        scene.add(this.moonLight.target);

        this.lights = createLighting(scene, this.dynamicSky.sunLight);
        this.lights.moonLight = this.moonLight;

        // Don't block startup on the HDR environment map. The fallback sky and
        // base lighting are good enough for the first interactive frame.
        createDefaultSky(scene, this.dynamicSky);
        this.environmentLoadPromise = this._loadEnvironmentWithFallback()
            .catch(() => null)
            .then((env) => {
                if (this.lastAppliedLightingPreset) {
                    this._applyEnvironmentFallbackForProfile(this.lastAppliedLightingPreset);
                }
                return env;
            });

        try {
            initEnvStubs({
                scene,
                renderer,
                hemisphereLight: scene?.userData?.fallbackHemisphere || null,
                dynamicSky: this.dynamicSky || null,
            });

            const bn = LOOK_PROFILES?.["Bright Noon"] || null;
            if (bn) {
                applyBasicLightingProfile({
                    hemisphere: bn?.ambient?.intensity ?? 0.28,
                    exposure: bn?.renderer?.toneMappingExposure ?? 1.0,
                    fogColor: bn?.fog?.color ?? "#e2ecf7",
                    fogNear: bn?.fog?.near ?? 3200,
                    fogFar: bn?.fog?.far ?? 12000,
                });

                if (Number.isFinite(bn?.env?.envMapIntensity)) {
                    setEnvironmentMapIntensity(bn.env.envMapIntensity);
                }
            }
        } catch { }

        this._setMoonState({
            azimuthDeg: this._mirroredMoonAzimuth(),
            elevationDeg: this.moonState.elevationDeg,
            intensity: this.moonLight.intensity,
            visible: this.moonState.visible,
        });

        this._alignSunLight();

        if (typeof window !== "undefined") {
            const debugWindow = window;
            debugWindow.setLightingPreset = (name) => {
                this.applyLookProfile(name, { forceReapply: true, source: "debug" });
            };
            debugWindow.cycleLightingPreset = () => {
                this.cycleLightingPreset();
            };
        }

        const initialPreset = "Bright Noon";
        this.applyLookProfile(initialPreset, {
            immediate: true,
            forceReapply: true,
            source: "auto",
        });
    }

    update(deltaTime, elapsed, { harbor, roadGroup, ocean, grassRoot }) {
        const { dayCycle, timeOfDayState, currentLookProfile, dynamicSky, sunAlignmentState, lights } = this;
        if (dayCycle.secondsPerDay > 0) {
            const deltaPhase = deltaTime / dayCycle.secondsPerDay;
            const nextPhase = (timeOfDayState.timeOfDayPhase ?? 0) + deltaPhase;
            const wrappedPhase = nextPhase - Math.floor(nextPhase);
            setTimeOfDayPhase(timeOfDayState, wrappedPhase);
        }

        const phase = timeOfDayState.timeOfDayPhase ?? 0;
        try { setTimeOfDay(phase); } catch { }
        timeOfDayState.elapsedSeconds = elapsed;

        const activePresetForPhase = this._getPresetForPhase(phase);
        if (
            activePresetForPhase &&
            activePresetForPhase !== this.lastAppliedLightingPreset &&
            !this.userPresetActive
        ) {
            this.applyLookProfile(activePresetForPhase, { source: "auto" });
        }

        let alignedSunDir;
        if (currentLookProfile) {
            alignedSunDir = this._getAlignedSunDirection();
            if (dynamicSky) {
                dynamicSky.setSunDirection(alignedSunDir);
            }
            const profile = currentLookProfile;

            const sunColor = profile.sun?.color ? new THREE.Color(profile.sun.color) : null;
            const sunIntensity = profile.sun?.intensity;
            const ambColor = profile.ambient?.color ? new THREE.Color(profile.ambient.color) : null;
            const gndColor = profile.ambient?.groundColor ? new THREE.Color(profile.ambient.groundColor) : null;
            const ambIntensity = profile.ambient?.intensity;

            updateLighting(lights, alignedSunDir, {
                applyPosition: false,
                overrideSunColor: sunColor,
                overrideSunIntensity: sunIntensity,
                overrideAmbientColor: ambColor,
                overrideGroundColor: gndColor,
                overrideAmbientIntensity: ambIntensity,
                sunDistance: this.sunDistance,
                sunTarget: this.sunTargetVector
            });
        } else {
            if (dynamicSky) {
                dynamicSky.setAzimuthOffsetDegrees(sunAlignmentState.azimuthDeg);
                dynamicSky.setTimeOfDay(phase * 24);
                alignedSunDir = dynamicSky.getSunDirection();
            }
            alignedSunDir = alignedSunDir || this._getAlignedSunDirection();
            this._syncSunLighting(alignedSunDir?.y, alignedSunDir);
            this._updateMoonForPhase(phase);
        }

        if (dynamicSky) {
            dynamicSky.update(deltaTime);
        }

        if (harbor && roadGroup) {
            updateHarborLighting(harbor, lights.nightFactor);
            updateMainHillRoadLighting(roadGroup, lights.nightFactor);
        }

        if (grassRoot) {
            setGrassNightFactor(lights.nightFactor);
        }
        if (ocean) {
            updateOcean(ocean, deltaTime, alignedSunDir, lights.nightFactor, lights.sunLight.color);
        }
    }

    _readStoredNumber = (key, fallback) => {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const value = Number(window.localStorage.getItem(key));
                if (Number.isFinite(value)) return value;
            }
        } catch { }
        return fallback;
    };

    _writeStoredNumber = (key, value) => {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem(key, String(value));
            }
        } catch { }
    };

    _clampElevation = (deg) => Math.max(0, Math.min(90, Number(deg) || 0));
    _wrapAzimuth = (deg) => {
        const value = Number(deg) || 0;
        const wrapped = value % 360;
        return wrapped < 0 ? wrapped + 360 : wrapped;
    };

    _lerpAzimuthDeg = (start, end, t) => {
        const delta = THREE.MathUtils.euclideanModulo((end - start) + 540, 360) - 180;
        return this._wrapAzimuth(start + delta * t);
    };

    _updateMoonObjects = (updates = {}) => {
        const { moonMesh, moonLight } = this;
        if (!moonMesh || !moonLight) {
            return;
        }

        const { azimuthDeg, elevationDeg, intensity, visible } = updates;
        const azRad = THREE.MathUtils.degToRad(azimuthDeg ?? 0);
        const elRad = THREE.MathUtils.degToRad(elevationDeg ?? 0);
        const radius = 500;

        const x = radius * Math.cos(azRad) * Math.cos(elRad);
        const y = radius * Math.sin(elRad);
        const z = radius * Math.sin(azRad) * Math.cos(elRad);
        moonMesh.position.set(x, y, z);
        moonLight.position.copy(moonMesh.position);
        moonLight.target.position.set(0, 0, 0);
        moonLight.target.updateMatrixWorld();

        if (Number.isFinite(intensity)) {
            moonLight.intensity = intensity;
        }
        if (visible != null) {
            moonLight.visible = !!visible && moonLight.intensity > 0;
            moonMesh.visible = !!visible;
        }
    };

    _setMoonState = (updates = {}) => {
        this.moonState.azimuthDeg = this._wrapAzimuth(
            updates.azimuthDeg ?? this.moonState.azimuthDeg,
        );
        this.moonState.elevationDeg = updates.elevationDeg ?? this.moonState.elevationDeg;
        this.moonState.intensity =
            updates.intensity != null ? updates.intensity : this.moonState.intensity;
        this.moonState.visible =
            updates.visible != null ? updates.visible : this.moonState.visible;

        this._updateMoonObjects({
            azimuthDeg: this.moonState.azimuthDeg,
            elevationDeg: this.moonState.elevationDeg,
            intensity: this.moonState.intensity,
            visible: this.moonState.visible,
        });
    };

    _applyEnvironmentFallbackForProfile = (profileName = "Bright Noon") => {
        const { scene, dynamicSky, hdriEnvMap } = this;
        const profile = LOOK_PROFILES[profileName] || LOOK_PROFILES["Bright Noon"];
        const skyColor = profile?.ambient?.color || "#dbe9ff";
        const groundColor = profile?.ambient?.groundColor || "#9ba8b5";
        const hemiIntensity = profile?.ambient?.intensity ?? 0.28;

        let hemi = scene.userData?.fallbackHemisphere;
        if (!hemi) {
            hemi = new THREE.HemisphereLight(skyColor, groundColor, hemiIntensity);
            hemi.name = "envFallbackLight";
            scene.userData.fallbackHemisphere = hemi;
            scene.add(hemi);
        }

        hemi.color.set(skyColor);
        hemi.groundColor.set(groundColor);
        hemi.intensity = hemiIntensity;
        hemi.visible = true;

        const currentBackground = scene.background;

        if (hdriEnvMap) {
            scene.background = hdriEnvMap;
            scene.environment = hdriEnvMap;
            if (dynamicSky?.sky) dynamicSky.sky.visible = false;
        } else {
            const fallbackBackground = dynamicSky?.sky || new THREE.Color(skyColor);
            scene.background = currentBackground || fallbackBackground;
            scene.environment = null;
        }
    };

    _loadEnvironmentWithFallback = async () => {
        const { renderer, scene, dynamicSky } = this;
        const hdriPath = joinPath(this.baseUrl, "hdr/clear_noon_1k.exr");
        const onFallback = () => {
            this.hdriEnvMap = null;
            createDefaultSky(scene, dynamicSky);
            this._applyEnvironmentFallbackForProfile();
        };

        const env = await loadHdriEnvironment({ renderer, scene, path: hdriPath, onFallback });
        if (env) {
            this.hdriEnvMap = env;
            scene.environment = env;
            scene.background = env;
            if (renderer && Number.isFinite(renderer.toneMappingExposure)) {
                renderer.toneMappingExposure = Math.max(0.25, renderer.toneMappingExposure * 0.45);
            }
            if (dynamicSky?.sky) dynamicSky.sky.visible = false;
            return env;
        }

        onFallback();
        return null;
    };

    _alignSunLight = () => {
        const direction = azElToDirection(
            this.sunAlignmentState.azimuthDeg,
            this.sunAlignmentState.elevationDeg,
        );
        this.dynamicSky.setSunDirection(direction);
        try { setSunPosition(direction); } catch { }
        return direction;
    };

    _mirroredMoonAzimuth = () => this._wrapAzimuth(this.sunAlignmentState.azimuthDeg + 180);

    _persistSunAlignment = () => {
        this._writeStoredNumber(SUN_AZIMUTH_STORAGE_KEY, this.sunAlignmentState.azimuthDeg);
        this._writeStoredNumber(
            SUN_ELEVATION_STORAGE_KEY,
            this.sunAlignmentState.elevationDeg,
        );
    };

    _getAlignedSunDirection = () => azElToDirection(this.sunAlignmentState.azimuthDeg, this.sunAlignmentState.elevationDeg);

    _getPresetForPhase = (phase) => {
        for (const window of this.LIGHTING_PHASE_WINDOWS) {
            const within =
                phase >= window.start && (phase < window.end || window.end === 1.0);
            if (within) return window.name;
        }
        return null;
    };

    _syncSunLighting = (sunHeightOverride, directionOverride) => {
        const { dynamicSky, lights, sunDistance, sunTargetVector } = this;
        const direction = directionOverride || dynamicSky.getSunDirection();
        const height = Number.isFinite(sunHeightOverride)
            ? sunHeightOverride
            : direction.y;
        updateLighting(lights, direction, {
            applyPosition: false,
            sunHeightOverride: height,
            sunDistance,
            sunTarget: sunTargetVector,
        });
        return direction;
    };

    _updateMoonForPhase = (phase) => {
        const normalized = THREE.MathUtils.euclideanModulo(phase - 0.75, 1);
        const arc = Math.cos(normalized * Math.PI * 2);
        const visibility = Math.max(0, arc);
        const elevation = THREE.MathUtils.lerp(-15, 55, visibility);
        const intensity = THREE.MathUtils.lerp(0.0, 0.6, visibility);

        this._setMoonState({
            azimuthDeg: this._mirroredMoonAzimuth(),
            elevationDeg: elevation,
            intensity,
            visible: visibility > 0.05,
        });
    };

    setSunAlignment = (updates = {}) => {
        let changed = false;
        if (updates.azimuthDeg != null && Number.isFinite(Number(updates.azimuthDeg))) {
            this.sunAlignmentState.azimuthDeg = this._wrapAzimuth(updates.azimuthDeg);
            changed = true;
        }
        if (
            updates.elevationDeg != null &&
            Number.isFinite(Number(updates.elevationDeg))
        ) {
            this.sunAlignmentState.elevationDeg = this._clampElevation(updates.elevationDeg);
            changed = true;
        }

        if (changed) {
            this._persistSunAlignment();
            this.dynamicSky.setAzimuthOffsetDegrees(this.sunAlignmentState.azimuthDeg);
            const cycleDir = this.dynamicSky.getSunDirection();
            this.dynamicSky.setSunDirection(this._getAlignedSunDirection());
            this._syncSunLighting(cycleDir?.y, cycleDir);
            this._setMoonState({ azimuthDeg: this._mirroredMoonAzimuth() });
            this.sceneContext.renderFrame();
        }
    };

    cycleLightingPreset = () => {
        const presets = ["Bright Noon", "Golden Hour", "Blue Hour", "Night"].filter(
            (preset) => !!LOOK_PROFILES[preset],
        );
        if (!presets.length) return;
        const currentIndex = presets.indexOf(this.lastAppliedLightingPreset ?? "");
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % presets.length : 0;
        const nextPreset = presets[nextIndex];
        this.applyLookProfile(nextPreset, { forceReapply: true, source: "debug" });
    };

    applyLookProfile = (profileName, options = {}) => {
        const { immediate = false, forceReapply = false, source = "manual" } = options;
        const resolvedProfileName = profileName || "Bright Noon";
        const profile = LOOK_PROFILES[resolvedProfileName] || LOOK_PROFILES["Bright Noon"];
        if (!profile) {
            return;
        }

        this._applyEnvironmentFallbackForProfile(resolvedProfileName);

        if (!this.scene.background || this.scene.background === null) {
            this.scene.background = this.dynamicSky?.sky || new THREE.Color(profile.ambient?.color || "#dbe9ff");
        }

        if (!forceReapply && this.lastAppliedLightingPreset === resolvedProfileName) {
            return;
        }

        this.currentLookProfile = profile;
        this.lastAppliedLightingPreset = resolvedProfileName;
        this.userPresetActive = source !== "auto";
        this.devHud?.setActivePreset?.(resolvedProfileName);

        // Manual/debug preset changes should take effect right away so
        // hotkeys and HUD buttons visibly update the scene in the same frame.
        if (immediate || source !== "auto") {
            this.applyLookProfileImmediate(resolvedProfileName);
        }
    };

    applyLookProfileImmediate = (profileName) => {
        const resolvedProfileName = profileName || "Bright Noon";
        const profile = LOOK_PROFILES[resolvedProfileName] || LOOK_PROFILES["Bright Noon"];
        if (!profile) {
            return;
        }

        this._applyEnvironmentFallbackForProfile(resolvedProfileName);

        if (!this.scene.background || this.scene.background === null) {
            this.scene.background = this.dynamicSky?.sky || new THREE.Color(profile.ambient?.color || "#dbe9ff");
        }

        this.currentLookProfile = profile;
        this.lastAppliedLightingPreset = resolvedProfileName;
        this.devHud?.setActivePreset?.(resolvedProfileName);

        if (profile.renderer) {
            if (Number.isFinite(profile.renderer.toneMappingExposure)) {
                this.renderer.toneMappingExposure = profile.renderer.toneMappingExposure;
            }
        }

        if (profile.sun) {
            if (Number.isFinite(profile.sun.azimuth)) {
                this.sunAlignmentState.azimuthDeg = this._wrapAzimuth(profile.sun.azimuth);
            }
            if (Number.isFinite(profile.sun.elevation)) {
                this.sunAlignmentState.elevationDeg = this._clampElevation(profile.sun.elevation);
            }
            this._persistSunAlignment();
        }

        this._setMoonState(this._resolveMoonSettingsFromProfile(profile));

        if (profile.skybox?.skyKey && this.dynamicSky) {
            this.dynamicSky.applyPreset(profile.skybox.skyKey);
        }

        if (profile.fog) {
            const { enabled, color, near, far } = profile.fog;
            this.onFogChange(!!enabled);
            if (enabled && color && Number.isFinite(near) && Number.isFinite(far)) {
                const fogColor = new THREE.Color(color);
                this._updateFogState(fogColor, near, far);
            }
        }

        if (profile.grade) {
            this._applyColorGradeSettings(profile.grade);
        }

        if (profile.env && Number.isFinite(profile.env.envMapIntensity)) {
            this._applyEnvironmentIntensity(profile.env.envMapIntensity);
        }

        const sunDir = this._getAlignedSunDirection();
        const el = profile.sun?.elevation ?? this.sunAlignmentState.elevationDeg;
        if (typeof el === "number" && el <= 0) {
            setTimeOfDayPhase(this.timeOfDayState, 0.0);
        } else {
            setTimeOfDayPhase(this.timeOfDayState, 0.5);
        }

        const sunColor = profile.sun?.color ? new THREE.Color(profile.sun.color) : null;
        const sunIntensity = profile.sun?.intensity;
        const ambColor = profile.ambient?.color ? new THREE.Color(profile.ambient.color) : null;
        const gndColor = profile.ambient?.groundColor ? new THREE.Color(profile.ambient.groundColor) : null;
        const ambIntensity = profile.ambient?.intensity;

        updateLighting(this.lights, sunDir, {
            applyPosition: true,
            sunDistance: this.sunDistance,
            sunTarget: this.sunTargetVector,
            overrideSunColor: sunColor,
            overrideSunIntensity: sunIntensity,
            overrideAmbientColor: ambColor,
            overrideGroundColor: gndColor,
            overrideAmbientIntensity: ambIntensity,
        });

        if (this.dynamicSky) {
            this.dynamicSky.setAzimuthOffsetDegrees(this.sunAlignmentState.azimuthDeg);
            this.dynamicSky.setSunDirection(sunDir);
        }
    };

    _resolveMoonSettingsFromProfile = (profile) => {
        const moonConfig = profile?.moon || {};
        const azimuthDeg = Number.isFinite(moonConfig.azimuth)
          ? this._wrapAzimuth(moonConfig.azimuth)
          : this._mirroredMoonAzimuth();
        const elevationDeg =
          moonConfig.elevation != null ? moonConfig.elevation : this.moonState.elevationDeg;
        const intensity = Number.isFinite(moonConfig.intensity)
          ? moonConfig.intensity
          : this.moonState.intensity;
        const visible =
          moonConfig.visible != null ? moonConfig.visible : intensity > 0.05;

        return { azimuthDeg, elevationDeg, intensity, visible };
      };

      _updateFogState = (color, near, far) => {
        const { scene } = this;
        const setFogOptions = scene?.userData?.setFogOptions;
        if (typeof setFogOptions === "function") {
          setFogOptions({ color, near, far });
        } else if (scene?.fog && scene.fog.isFog) {
          scene.fog.color.copy(color);
          scene.fog.near = near;
          scene.fog.far = far;
        } else if (scene) {
          scene.fog = new THREE.Fog(color, near, far);
        }
      };

      _applyColorGradeSettings = (overrides = {}) => {
        const { colorGradePass } = this.sceneContext;
        const colorGradeUniforms = colorGradePass?.material?.uniforms || null;
        if (!colorGradeUniforms) return;

        const defaultColorGradeSettings = {
            contrastStrength: colorGradeUniforms.contrastStrength.value,
            saturationBoost: colorGradeUniforms.saturationBoost.value,
            shadowTint: colorGradeUniforms.shadowTint.value.clone(),
            midTint: colorGradeUniforms.midTint.value.clone(),
            highlightTint: colorGradeUniforms.highlightTint.value.clone(),
          };

        const merged = { ...defaultColorGradeSettings, ...overrides };
        const setTint = (key, value) => {
          if (!value || !colorGradeUniforms[key]?.value) return;
          const color = value instanceof THREE.Color ? value : new THREE.Color(value);
          colorGradeUniforms[key].value.set(color.r, color.g, color.b);
        };

        if (Number.isFinite(merged.contrastStrength)) {
          colorGradeUniforms.contrastStrength.value = merged.contrastStrength;
        }
        if (Number.isFinite(merged.saturationBoost)) {
          colorGradeUniforms.saturationBoost.value = merged.saturationBoost;
        }

        setTint("shadowTint", merged.shadowTint);
        setTint("midTint", merged.midTint);
        setTint("highlightTint", merged.highlightTint);
      };

      _applyEnvironmentIntensity = (intensity) => {
        const target = Number.isFinite(intensity) ? Math.max(0, intensity) : 1;

        const applyToMaterial = (material) => {
          if (!material || typeof material !== "object") return;
          if (Array.isArray(material)) {
            material.forEach(applyToMaterial);
            return;
          }

          if ("envMapIntensity" in material) {
            const cappedTarget = Number.isFinite(material.userData?.envMapIntensityCap)
              ? Math.min(target, material.userData.envMapIntensityCap)
              : target;
            material.envMapIntensity = cappedTarget;
            material.needsUpdate = true;
          }
        };

        this.scene?.traverse((child) => {
          if (!child?.isMesh) return;
          applyToMaterial(child.material);
        });

        this.scene.userData.environmentIntensity = target;
      };
}
