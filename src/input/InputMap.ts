import {
  loadSettings,
  subscribe,
  defaultCameraSettings,
  type CameraSettings,
} from "../state/settingsStore";
import {
  MOVEMENT_ONLY_KEYS,
  ALL_LOOK_KEYS,
  ACTION_KEYS,
  flattenKeyGroups,
} from "./keyBindings";

const LOOK_KEY_LIST = flattenKeyGroups(ALL_LOOK_KEYS);
const MOVEMENT_KEY_LIST = flattenKeyGroups(MOVEMENT_ONLY_KEYS);
const ACTION_KEY_LIST = flattenKeyGroups(ACTION_KEYS);

const CONTROL_KEYS = new Set<string>([
  ...MOVEMENT_KEY_LIST,
  ...LOOK_KEY_LIST,
  ...ACTION_KEY_LIST,
  "ControlLeft",
  "ControlRight",
]);

const NON_TYPING_INPUT_TYPES = new Set<string>([
  "button",
  "checkbox",
  "radio",
  "range",
  "submit",
  "reset",
  "file",
  "color",
  "image",
]);

function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!target || typeof target !== "object") {
    return false;
  }

  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (typeof HTMLInputElement !== "undefined" && target instanceof HTMLInputElement) {
    const type = target.type?.toLowerCase?.() ?? "";
    return !NON_TYPING_INPUT_TYPES.has(type);
  }

  if (typeof HTMLTextAreaElement !== "undefined" && target instanceof HTMLTextAreaElement) {
    return true;
  }

  return false;
}

export interface LookDelta {
  yaw: number;
  pitch: number;
}

type KeyHandler = (event: KeyboardEvent) => void;
type FocusHandler = (event: FocusEvent) => void;

export class InputMap {
  private readonly keys: Set<string> = new Set();
  private readonly canvas: HTMLCanvasElement | null;
  private flyToggleQueued = false;
  private interactQueued = false;
  private cameraSettings: CameraSettings | null;
  private unsubscribeCameraSettings: (() => void) | null = null;

  private readonly keyDownHandler: KeyHandler;
  private readonly keyUpHandler: KeyHandler;
  private readonly blurHandler: FocusHandler;

  constructor(canvas: HTMLCanvasElement | null = null) {
    this.canvas = canvas;

    // CameraSettingsStore: sync arrow-key look speeds
    this.cameraSettings = loadSettings();
    this.unsubscribeCameraSettings = subscribe((settings) => {
      this.cameraSettings = settings;
    });

    this.keyDownHandler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      this.keys.add(event.code);
      if (event.code === "KeyF" && !event.repeat) {
        this.flyToggleQueued = true;
      }
      if (event.code === "KeyE" && !event.repeat) {
        this.interactQueued = true;
      }
      if (CONTROL_KEYS.has(event.code)) {
        event.preventDefault();
      }
    };

    this.keyUpHandler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      this.keys.delete(event.code);
      if (CONTROL_KEYS.has(event.code)) {
        event.preventDefault();
      }
    };

    this.blurHandler = () => {
      this.resetKeys();
      this.flyToggleQueued = false;
      this.interactQueued = false;
    };

    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    window.addEventListener("blur", this.blurHandler);
    window.addEventListener("focus", this.blurHandler);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    window.removeEventListener("blur", this.blurHandler);
    window.removeEventListener("focus", this.blurHandler);

    this.unsubscribeCameraSettings?.();
    this.unsubscribeCameraSettings = null;
  }

  consumeLookDelta(dt = 0): LookDelta {
    const settings = this.cameraSettings || defaultCameraSettings;

    // Keyboard Input
    const yawInput = (this.lookRight ? 1 : 0) - (this.lookLeft ? 1 : 0);
    const pitchInput = (this.lookDown ? 1 : 0) - (this.lookUp ? 1 : 0);
    const yawSpeed = Number.isFinite(settings.yawSpeed)
      ? settings.yawSpeed
      : defaultCameraSettings.yawSpeed;
    const pitchSpeed = Number.isFinite(settings.pitchSpeed)
      ? settings.pitchSpeed
      : defaultCameraSettings.pitchSpeed;
    const invert = settings.invertPitch ? -1 : 1;
    const dtSafe = Number.isFinite(dt) ? Math.max(0, dt) : 0;

    // 1. Calculate Key Look (scaled by dt)
    const yawKeyDelta = yawInput * yawSpeed * dtSafe;
    const pitchKeyDelta = pitchInput * pitchSpeed * dtSafe * invert;

    // 2. Return Combined
    return {
      yaw: yawKeyDelta,
      pitch: pitchKeyDelta,
    };
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  isAnyDown(codes: readonly string[] = []): boolean {
    if (!Array.isArray(codes) || codes.length === 0) {
      return false;
    }
    for (const code of codes) {
      if (this.keys.has(code)) {
        return true;
      }
    }
    return false;
  }

  get forward(): boolean {
    return this.isAnyDown(MOVEMENT_ONLY_KEYS.forward);
  }

  get back(): boolean {
    return this.isAnyDown(MOVEMENT_ONLY_KEYS.back);
  }

  get left(): boolean {
    return this.isAnyDown(MOVEMENT_ONLY_KEYS.left);
  }

  get right(): boolean {
    return this.isAnyDown(MOVEMENT_ONLY_KEYS.right);
  }

  get sprint(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }

  get jump(): boolean {
    return this.isDown("Space");
  }

  get flyUp(): boolean {
    return this.isDown("Space");
  }

  get flyDown(): boolean {
    return this.isDown("ControlLeft") || this.isDown("ControlRight");
  }

  get lookLeft(): boolean {
    return this.isAnyDown(ALL_LOOK_KEYS.left);
  }

  get lookRight(): boolean {
    return this.isAnyDown(ALL_LOOK_KEYS.right);
  }

  get lookUp(): boolean {
    return this.isAnyDown(ALL_LOOK_KEYS.up);
  }

  get lookDown(): boolean {
    return this.isAnyDown(ALL_LOOK_KEYS.down);
  }

  consumeFlyToggle(): boolean {
    if (!this.flyToggleQueued) return false;
    this.flyToggleQueued = false;
    return true;
  }

  consumeInteract(): boolean {
    if (!this.interactQueued) return false;
    this.interactQueued = false;
    return true;
  }

  private resetKeys(): void {
    this.keys.clear();
  }
}

export default InputMap;
