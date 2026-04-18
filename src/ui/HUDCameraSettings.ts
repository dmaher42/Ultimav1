// HUDCameraSettings: lightweight HUD panel for camera tuning
import {
  defaultCameraSettings,
  loadSettings,
  saveSettings,
  subscribe,
} from "../state/settingsStore";
import type {
  CameraSettings,
  CameraSettingsUpdate,
} from "../state/settingsStore";
import "./hudTheme.css";

type RangeKey = Extract<
  keyof CameraSettings,
  | "yawSpeed"
  | "pitchSpeed"
  | "zoomSpeed"
  | "minPitch"
  | "maxPitch"
  | "minDist"
  | "maxDist"
>;

interface RangeConfig {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly label: string;
  readonly suffix: string;
}

const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  yawSpeed: { min: 0.1, max: 2.0, step: 0.05, label: "Yaw Speed", suffix: "rad/s" },
  pitchSpeed: { min: 0.1, max: 2.0, step: 0.05, label: "Pitch Speed", suffix: "rad/s" },
  zoomSpeed: { min: 0.5, max: 8.0, step: 0.1, label: "Zoom Speed", suffix: "u/s" },
  minPitch: { min: -1.0, max: 0.0, step: 0.01, label: "Min Pitch", suffix: "rad" },
  maxPitch: { min: 0.0, max: 1.0, step: 0.01, label: "Max Pitch", suffix: "rad" },
  minDist: { min: 1.5, max: 6.0, step: 0.1, label: "Min Distance", suffix: "m" },
  maxDist: { min: 4.0, max: 12.0, step: 0.1, label: "Max Distance", suffix: "m" },
};

interface SliderControl {
  readonly wrapper: HTMLDivElement;
  readonly slider: HTMLInputElement;
  readonly valueEl: HTMLSpanElement;
}

interface CheckboxControl {
  readonly wrapper: HTMLLabelElement;
  readonly checkbox: HTMLInputElement;
}

export interface HUDCameraSettingsHandle {
  dispose(): void;
}

const SLIDER_KEYS: RangeKey[] = [
  "yawSpeed",
  "pitchSpeed",
  "zoomSpeed",
  "minPitch",
  "maxPitch",
  "minDist",
  "maxDist",
];

const formatValue = (value: number, suffix = ""): string => {
  if (!Number.isFinite(value)) return `0${suffix ? " " + suffix : ""}`;
  const abs = Math.abs(value);
  const decimals = abs >= 10 ? 1 : 2;
  const text = value.toFixed(decimals);
  return suffix ? `${text} ${suffix}` : text;
};

function createSlider(
  key: RangeKey,
  config: RangeConfig,
  onInput: (key: RangeKey, value: number) => void,
): SliderControl {
  const wrapper = document.createElement("div");
  wrapper.className = "hud-camera-settings__slider";

  const labelRow = document.createElement("div");
  labelRow.className = "hud-camera-settings__label-row";

  const label = document.createElement("span");
  label.textContent = config.label;
  labelRow.appendChild(label);

  const valueEl = document.createElement("span");
  valueEl.className = "hud-camera-settings__value";
  labelRow.appendChild(valueEl);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(config.min);
  slider.max = String(config.max);
  slider.step = String(config.step);
  slider.name = key;
  slider.setAttribute("aria-label", config.label);
  slider.className = "hud-camera-settings__range";

  slider.addEventListener("input", () => {
    const value = Number.parseFloat(slider.value);
    valueEl.textContent = formatValue(value, config.suffix);
    onInput(key, value);
  });

  wrapper.appendChild(labelRow);
  wrapper.appendChild(slider);

  return { wrapper, slider, valueEl };
}

function createCheckbox(
  labelText: string,
  key: keyof CameraSettings,
  onChange: (key: keyof CameraSettings, checked: boolean) => void,
): CheckboxControl {
  const wrapper = document.createElement("label");
  wrapper.className = "hud-camera-settings__checkbox";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = key;
  checkbox.addEventListener("change", () => {
    onChange(key, checkbox.checked);
  });

  const text = document.createElement("span");
  text.textContent = labelText;

  wrapper.appendChild(checkbox);
  wrapper.appendChild(text);

  return { wrapper: wrapper as HTMLLabelElement, checkbox };
}

export function mount(rootEl: HTMLElement | null): HUDCameraSettingsHandle {
  if (!(rootEl instanceof HTMLElement)) {
    return { dispose() {} };
  }

  const state: { settings: CameraSettings; disposed: boolean } = {
    settings: loadSettings(),
    disposed: false,
  };

  const section = document.createElement("section");
  section.className = "hud-camera-settings";

  const header = document.createElement("div");
  header.className = "hud-camera-settings__header";

  const title = document.createElement("span");
  title.textContent = "Camera";
  title.className = "hud-camera-settings__title";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.title = "Camera settings";
  toggleButton.setAttribute("aria-label", "Camera settings");
  toggleButton.textContent = "⚙";
  toggleButton.className = "hud-camera-settings__toggle";

  const panel = document.createElement("div");
  panel.id = "hud-camera-settings-panel";
  panel.className = "hud-camera-settings__panel";
  panel.style.display = "none";
  panel.setAttribute("aria-hidden", "true");
  toggleButton.setAttribute("aria-controls", panel.id);

  const controls: Partial<Record<RangeKey, SliderControl>> = {};
  const slidersContainer = document.createElement("div");
  slidersContainer.className = "hud-camera-settings__slider-group";

  const onSliderInput = (key: RangeKey, value: number) => {
    if (state.disposed) return;
    const update = { [key]: value } as CameraSettingsUpdate;
    saveSettings(update);
  };

  for (const key of SLIDER_KEYS) {
    const config = RANGE_CONFIG[key];
    const slider = createSlider(key, config, onSliderInput);
    controls[key] = slider;
    slidersContainer.appendChild(slider.wrapper);
  }

  const toggles = document.createElement("div");
  toggles.className = "hud-camera-settings__toggles";

  const enableCheckbox = createCheckbox(
    "Enable Arrow Orbit",
    "enableArrowOrbit",
    (key, checked) => {
      if (state.disposed) return;
      const update = { [key]: checked } as CameraSettingsUpdate;
      saveSettings(update);
    },
  );
  const invertCheckbox = createCheckbox(
    "Invert Pitch",
    "invertPitch",
    (key, checked) => {
      if (state.disposed) return;
      const update = { [key]: checked } as CameraSettingsUpdate;
      saveSettings(update);
    },
  );

  toggles.appendChild(enableCheckbox.wrapper);
  toggles.appendChild(invertCheckbox.wrapper);

  panel.appendChild(toggles);
  panel.appendChild(slidersContainer);

  header.appendChild(title);
  header.appendChild(toggleButton);

  section.appendChild(header);
  section.appendChild(panel);

  const applySettingsToUI = (settings: CameraSettings) => {
    state.settings = settings;
    enableCheckbox.checkbox.checked = settings.enableArrowOrbit;
    invertCheckbox.checkbox.checked = settings.invertPitch;

    for (const key of SLIDER_KEYS) {
      const control = controls[key];
      if (!control) continue;
      const value = settings[key] ?? defaultCameraSettings[key];
      control.slider.value = String(value);
      control.valueEl.textContent = formatValue(value, RANGE_CONFIG[key].suffix);
    }
  };

  const togglePanel = () => {
    const isVisible = panel.style.display !== "none";
    if (isVisible) {
      panel.style.display = "none";
      toggleButton.setAttribute("aria-expanded", "false");
    } else {
      panel.style.display = "block";
      toggleButton.setAttribute("aria-expanded", "true");
    }
    panel.setAttribute("aria-hidden", String(isVisible));
  };

  const onToggleClick = (event: MouseEvent) => {
    event.preventDefault();
    togglePanel();
  };
  toggleButton.addEventListener("click", onToggleClick);

  const unsubscribe = subscribe((next) => {
    if (state.disposed) return;
    applySettingsToUI(next);
  });

  applySettingsToUI(state.settings);

  rootEl.appendChild(section);

  const handle: HUDCameraSettingsHandle = {
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      unsubscribe?.();
      toggleButton.removeEventListener("click", onToggleClick);
      section.remove();
    },
  };
  return handle;
}

export default { mount };
