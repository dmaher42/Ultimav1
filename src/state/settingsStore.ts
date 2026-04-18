// CameraSettingsStore: lightweight settings store with persistence

const STORAGE_KEY = "athens.settings.camera";
const PERSIST_DELAY_MS = 150;

export type CameraSettings = {
  enableArrowOrbit: boolean;
  yawSpeed: number;
  pitchSpeed: number;
  zoomSpeed: number;
  minPitch: number;
  maxPitch: number;
  minDist: number;
  maxDist: number;
  invertPitch: boolean;
};

export type CameraSettingsUpdate = Partial<CameraSettings>;
export type CameraSettingsListener = (settings: CameraSettings) => void;

// Shape with defaults
export const defaultCameraSettings: CameraSettings = {
  enableArrowOrbit: true,
  yawSpeed: 1.5, // rad/s
  pitchSpeed: 1.5, // rad/s
  zoomSpeed: 3.0, // units/s for PageUp/Down
  minPitch: -1.4, // radians
  maxPitch: 1.0, // radians
  minDist: 2.5, // meters
  maxDist: 16, // meters
  invertPitch: false,
};

type NumericSettingKey =
  | "yawSpeed"
  | "pitchSpeed"
  | "zoomSpeed"
  | "minPitch"
  | "maxPitch"
  | "minDist"
  | "maxDist";

type NumericSettingRange = { min: number; max: number };

const CAMERA_RANGES: Record<NumericSettingKey, NumericSettingRange> = {
  yawSpeed: { min: 0.1, max: 2.0 },
  pitchSpeed: { min: 0.1, max: 2.0 },
  zoomSpeed: { min: 0.5, max: 8.0 },
  minPitch: { min: -1.0, max: 0.0 },
  maxPitch: { min: 0.0, max: 1.0 },
  minDist: { min: 1.5, max: 6.0 },
  maxDist: { min: 4.0, max: 20.0 },
};

const listeners: Set<CameraSettingsListener> = new Set();
let currentSettings: CameraSettings = { ...defaultCameraSettings };
let loaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toNumber(value: unknown, fallback: number): number {
  const num =
    typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cloneSettings(settings: CameraSettings): CameraSettings {
  return { ...settings };
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readStoredSettings(): CameraSettingsUpdate | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CameraSettingsUpdate;
  } catch {
    return null;
  }
}

function writeStoredSettings(settings: CameraSettings): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota/security errors.
  }
}

function normalizeSettings(partial: CameraSettingsUpdate = {}): CameraSettings {
  const merged: CameraSettings = { ...defaultCameraSettings, ...partial };

  const normalized: CameraSettings = {
    enableArrowOrbit: Boolean(merged.enableArrowOrbit),
    yawSpeed: clamp(
      toNumber(merged.yawSpeed, defaultCameraSettings.yawSpeed),
      CAMERA_RANGES.yawSpeed.min,
      CAMERA_RANGES.yawSpeed.max
    ),
    pitchSpeed: clamp(
      toNumber(merged.pitchSpeed, defaultCameraSettings.pitchSpeed),
      CAMERA_RANGES.pitchSpeed.min,
      CAMERA_RANGES.pitchSpeed.max
    ),
    zoomSpeed: clamp(
      toNumber(merged.zoomSpeed, defaultCameraSettings.zoomSpeed),
      CAMERA_RANGES.zoomSpeed.min,
      CAMERA_RANGES.zoomSpeed.max
    ),
    minPitch: clamp(
      toNumber(merged.minPitch, defaultCameraSettings.minPitch),
      CAMERA_RANGES.minPitch.min,
      CAMERA_RANGES.minPitch.max
    ),
    maxPitch: clamp(
      toNumber(merged.maxPitch, defaultCameraSettings.maxPitch),
      CAMERA_RANGES.maxPitch.min,
      CAMERA_RANGES.maxPitch.max
    ),
    minDist: clamp(
      toNumber(merged.minDist, defaultCameraSettings.minDist),
      CAMERA_RANGES.minDist.min,
      CAMERA_RANGES.minDist.max
    ),
    maxDist: clamp(
      toNumber(merged.maxDist, defaultCameraSettings.maxDist),
      CAMERA_RANGES.maxDist.min,
      CAMERA_RANGES.maxDist.max
    ),
    invertPitch: Boolean(merged.invertPitch),
  };

  if (normalized.minPitch > normalized.maxPitch) {
    const temp = normalized.minPitch;
    normalized.minPitch = normalized.maxPitch;
    normalized.maxPitch = temp;
  }

  if (normalized.minDist > normalized.maxDist) {
    const temp = normalized.minDist;
    normalized.minDist = normalized.maxDist;
    normalized.maxDist = temp;
  }

  if (normalized.minDist === normalized.maxDist) {
    if (normalized.maxDist < CAMERA_RANGES.maxDist.max) {
      normalized.maxDist = Math.min(
        CAMERA_RANGES.maxDist.max,
        normalized.maxDist + 0.1
      );
    } else {
      normalized.minDist = Math.max(
        CAMERA_RANGES.minDist.min,
        normalized.minDist - 0.1
      );
    }
  }

  normalized.minPitch = Number(normalized.minPitch.toFixed(4));
  normalized.maxPitch = Number(normalized.maxPitch.toFixed(4));
  normalized.minDist = Number(normalized.minDist.toFixed(4));
  normalized.maxDist = Number(normalized.maxDist.toFixed(4));
  normalized.yawSpeed = Number(normalized.yawSpeed.toFixed(4));
  normalized.pitchSpeed = Number(normalized.pitchSpeed.toFixed(4));
  normalized.zoomSpeed = Number(normalized.zoomSpeed.toFixed(4));

  return normalized;
}

function ensureLoaded(): void {
  if (loaded) return;
  const stored = readStoredSettings();
  if (stored) {
    currentSettings = normalizeSettings(stored);
  } else {
    currentSettings = cloneSettings(defaultCameraSettings);
  }
  loaded = true;
}

function schedulePersist(): void {
  if (!hasStorage()) return;
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeStoredSettings(currentSettings);
  }, PERSIST_DELAY_MS);
}

function notifyListeners(): void {
  const snapshot = cloneSettings(currentSettings);
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error("[CameraSettingsStore] listener error", err);
    }
  });
}

function settingsEqual(a: CameraSettings | null, b: CameraSettings | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(defaultCameraSettings) as (keyof CameraSettings)[];
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function loadSettings(): CameraSettings {
  ensureLoaded();
  return cloneSettings(currentSettings);
}

export function getSettings(): CameraSettings {
  return loadSettings();
}

export function saveSettings(partial?: CameraSettingsUpdate | null): CameraSettings {
  ensureLoaded();
  if (!partial || typeof partial !== "object") {
    return cloneSettings(currentSettings);
  }

  const next = normalizeSettings({ ...currentSettings, ...partial });
  if (settingsEqual(next, currentSettings)) {
    return cloneSettings(currentSettings);
  }

  currentSettings = next;
  schedulePersist();
  notifyListeners();
  return cloneSettings(currentSettings);
}

export function subscribe(listener: CameraSettingsListener): () => void {
  if (typeof listener !== "function") {
    return () => {};
  }
  ensureLoaded();
  listeners.add(listener);
  try {
    listener(cloneSettings(currentSettings));
  } catch (err) {
    console.error("[CameraSettingsStore] listener error", err);
  }
  return () => {
    listeners.delete(listener);
  };
}

export default {
  loadSettings,
  saveSettings,
  subscribe,
  getSettings,
  defaultCameraSettings,
};
