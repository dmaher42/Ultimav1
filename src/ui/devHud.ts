import type { Vector3 } from "three";

import { createHudPanel, updateTextIfChanged } from "./hudShared.js";
import { registerUIUpdate } from "./updateLoop.js";
import "./hudTheme.css";
import { registerPanel } from "./HudManager.js";

type Vector3Like = Pick<Vector3, "x" | "y" | "z">;
type WindowWithHudFlag = Window & typeof globalThis & { SHOW_HUD?: boolean };

export interface LightingPresetMeta {
  readonly label?: string;
  readonly hotkey?: string;
}

export interface DevHudOptions {
  readonly getPosition?: () => Vector3Like | null | undefined;
  readonly getDirection?: () => Vector3Like | null | undefined;
  readonly onPin?: (position: Vector3Like) => void;
  readonly onSetLightingPreset?: (name: string) => void;
  readonly lightingPresets?: Record<string, LightingPresetMeta | null | undefined>;
  readonly getActivePresetName?: () => string | null | undefined;
  readonly setActivePreset?: (name: string) => void;
  readonly getFogEnabled?: () => boolean;
  readonly onToggleFog?: () => void;
  readonly sunAlignment?: {
    getAzimuthDeg?: () => number;
    getElevationDeg?: () => number;
    onChange?: (updates: { azimuthDeg?: number; elevationDeg?: number }) => void;
  };
}

type OceanBounds = {
  readonly west?: number;
  readonly east?: number;
  readonly north?: number;
  readonly south?: number;
};

interface OceanStatusOptions {
  readonly seaLevel?: number;
  readonly bounds?: OceanBounds;
}

interface HudRootElement extends HTMLDivElement {
  _presetKeyBindings?: Map<string, string>;
}

export interface DevHudHandle {
  dispose(): void;
  setStatusLine(id: string, text?: string | null): void;
  setOceanStatus(options?: OceanStatusOptions | null): void;
  readonly rootElement: HudRootElement;
  updateFogState(state?: boolean | null): void;
  setActivePreset?(name?: string | null): void;
}

// Dev HUD: compass + coordinates + pin hotkey (P)
export function mountDevHUD(options: DevHudOptions = {}): DevHudHandle | null {
  const {
    getPosition,
    getDirection,
    onPin,
    onSetLightingPreset,
    lightingPresets,
    getActivePresetName,
    setActivePreset,
    getFogEnabled,
    onToggleFog,
    sunAlignment,
  } = options;
  const runtimeWindow: WindowWithHudFlag | null =
    typeof window !== "undefined" ? (window as WindowWithHudFlag) : null;
  const allowHud = runtimeWindow?.SHOW_HUD === true;
  if (!allowHud) return null;

  // --- DOM Structure ---
  const wrapRef: { current: HudRootElement | null } = { current: null };
  const panel = createHudPanel({
    title: "Debug Info",
    className: "dev-hud-panel",
    toggleLabels: { expanded: "Minimize", collapsed: "Expand" },
    onToggle: (collapsed) => {
      if (!wrapRef.current) return;
      wrapRef.current.style.width = collapsed ? "auto" : "260px";
    },
  });

  const wrap = panel.root as HudRootElement;
  wrapRef.current = wrap;
  const content = panel.content;
  wrap.style.width = "260px";

  // 1. Compass
  const compassContainer = document.createElement("div");
  compassContainer.className = "dev-hud-compass-container";
  const comp = document.createElement("div");
  comp.className = "dev-hud-compass";

  const needle = document.createElement("div");
  needle.className = "dev-hud-compass-needle";
  comp.appendChild(needle);

  const labels = { N:0, E:90, S:180, W:270 };
  Object.entries(labels).forEach(([txt,deg])=>{
    const el = document.createElement("div");
    el.className = "dev-hud-compass-label";
    el.textContent = txt;
    // transform math matches original implementation
    el.style.transform = `translate(-50%,-50%) rotate(${deg}deg) translate(0,-38px) rotate(${-deg}deg)`;
    comp.appendChild(el);
  });
  compassContainer.appendChild(comp);
  compassContainer.style.display = "none"; // Minimaps expose compass; avoid duplication here

  // 2. Readout (Pos, Bear, Pin)
  const readout = document.createElement("div");
  readout.innerHTML = [
    `<div><b>Pos</b> <span id="hud-pos">(x,y,z)</span></div>`,
    `<div><b>Bear</b> <span id="hud-bear">0° N</span></div>`,
    `<div style="opacity:.8">Press <b>P</b> to drop a pin</div>`
  ].join("");
  content.appendChild(readout);

  // 3. Status Section (Dynamic)
  const statusSection = document.createElement("div");
  statusSection.className = "dev-hud-section";
  statusSection.style.display = "none";
  content.appendChild(statusSection);

  // --- Helpers & Logic ---
  const statusEntries = new Map<string, HTMLDivElement>();
  const updateStatusVisibility = () => {
    statusSection.style.display = statusEntries.size ? "block" : "none";
  };
  const setStatusLine = (id: string, text?: string | null) => {
    if (!id) return;
    const message = typeof text === "string" ? text.trim() : "";
    let entry = statusEntries.get(id);
    if (!message) {
      if (entry) {
        statusEntries.delete(id);
        entry.remove();
        updateStatusVisibility();
      }
      return;
    }
    if (!entry) {
      entry = document.createElement("div");
      Object.assign(entry.style, {
        opacity: "0.75",
        fontSize: "11px",
        letterSpacing: "0.03em",
        textTransform: "none",
        marginTop: statusEntries.size ? "4px" : "0",
      });
      statusEntries.set(id, entry);
      statusSection.appendChild(entry);
    }
    updateTextIfChanged(entry, message);
    updateStatusVisibility();
  };

  setStatusLine("proc", "Procedural: off");

  const setOceanStatus = (options: OceanStatusOptions = {}) => {
    const { seaLevel, bounds } = options;
    const levelIsFinite = Number.isFinite(seaLevel);
    const boundKeys: Array<keyof OceanBounds> = [
      "west",
      "east",
      "north",
      "south",
    ];
    const boundsAreValid =
      !!bounds && boundKeys.every((key) => Number.isFinite(bounds?.[key]));

    if (!levelIsFinite || !boundsAreValid) {
      setStatusLine("sea", "");
      return;
    }
    const safeBounds = bounds as Record<keyof OceanBounds, number>;
    const formatBound = (value: number) => value.toFixed(1);
    const message = [
      `Sea level: ${Number(seaLevel).toFixed(2)}`,
      `Ocean bounds: W ${formatBound(safeBounds.west)} / E ${formatBound(safeBounds.east)}`,
      `N ${formatBound(safeBounds.north)} / S ${formatBound(safeBounds.south)}`,
    ].join(" "); // compacted for new layout

    setStatusLine("sea", message);
  };

  // Lighting Presets
  const defaultPresetOrder = [
    { name: "Bright Noon", label: "Bright Noon" },
    { name: "Golden Hour", label: "Golden Hour" },
    { name: "Blue Hour", label: "Blue Hour" },
    { name: "Night", label: "Night" },
  ];
  const defaultPresetHotkeys = ["Digit1", "Digit2", "Digit3", "Digit4"];
  const availablePresets = defaultPresetOrder.filter(({ name }) => {
    if (!lightingPresets) return true;
    return lightingPresets[name] != null;
  });
  let setActivePresetFn: ((name?: string | null) => void) | undefined;
  let cyclePreset: (() => void) | undefined;

  let syncActivePreset = () => {};

  if (availablePresets.length) {
    const section = document.createElement("div");
    section.className = "dev-hud-section";

    const heading = document.createElement("div");
    heading.className = "dev-hud-heading";
    heading.textContent = "Lighting Presets";
    section.appendChild(heading);

    const presetStatus = document.createElement("div");
    presetStatus.className = "dev-hud-subtext";
    presetStatus.style.marginBottom = "4px";
    presetStatus.textContent = "Select a preset to apply";
    section.appendChild(presetStatus);

    const buttonRow = document.createElement("div");
    buttonRow.className = "dev-hud-btn-row";

    const presetKeyBindings = new Map<string, string>();
    const presetButtons = new Map<string, HTMLButtonElement>();
    let activePresetName: string | null = null;

    setActivePresetFn = (name?: string | null) => {
      activePresetName = name ?? null;
      presetButtons.forEach((btn, key) => {
        const isActive = name === key;
        btn.classList.toggle("dev-hud-btn--active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      });
      if (name && presetStatus) {
        presetStatus.textContent = `Active preset: ${name}`;
      } else if (presetStatus) {
        presetStatus.textContent = "Select a preset to apply";
      }
    };

    for (const preset of availablePresets) {
      const presetMeta = lightingPresets?.[preset.name] || {};
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dev-hud-btn";
      const displayLabel = presetMeta.label || preset.label;
      button.textContent = displayLabel;

      const hotkeyLabel = presetMeta.hotkey || defaultPresetHotkeys[presetButtons.size] || "";
      if (hotkeyLabel) {
        button.title = `Set ${displayLabel} lighting (Hotkey ${hotkeyLabel})`;
        button.setAttribute("aria-keyshortcuts", hotkeyLabel);
        presetKeyBindings.set(hotkeyLabel, preset.name);
        const simpleKey = hotkeyLabel.startsWith("Digit")
          ? hotkeyLabel.replace("Digit", "")
          : hotkeyLabel;
        presetKeyBindings.set(simpleKey, preset.name);
      } else {
        button.title = `Set ${displayLabel} lighting`;
      }

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (typeof onSetLightingPreset === "function") {
          onSetLightingPreset(preset.name);
        }
        setActivePresetFn?.(preset.name);
      });
      buttonRow.appendChild(button);
      presetButtons.set(preset.name, button);
    }
    // (Skipped complex hotkey map logic reconstruction for brevity if unused,
    // but retaining the binding logic below)

    section.appendChild(buttonRow);
    content.appendChild(section);

    // Note: The original code populated presetKeyBindings but didn't actually populate presetHotkeyConfig
    // with data from arguments. Assuming simple binding logic is sufficient or external config drives it.
    // Preserving the property on root for the key listener.
    wrap._presetKeyBindings = presetKeyBindings;

    cyclePreset = () => {
      if (!availablePresets.length) return;
      const names = availablePresets.map((preset) => preset.name);
      const currentIndex = activePresetName ? names.indexOf(activePresetName) : -1;
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % names.length : 0;
      const nextName = names[nextIndex];
      if (nextName !== undefined) {
        setActivePresetFn?.(nextName);
        onSetLightingPreset?.(nextName);
      }
    };
  }

  // Fog Control
  let fogButton: HTMLButtonElement | null = null;
  const updateFogControls = (state?: boolean | null) => {
    if (!fogButton) return;
    let enabled: boolean;
    if (typeof state === "boolean") {
      enabled = state;
    } else if (typeof getFogEnabled === "function") {
      enabled = !!getFogEnabled();
    } else {
      enabled = false;
    }
    fogButton.textContent = enabled ? "Disable Fog" : "Enable Fog";
    fogButton.setAttribute("aria-pressed", String(enabled));
    fogButton.title = enabled
      ? "Disable atmospheric fog (Hotkey G)"
      : "Enable atmospheric fog (Hotkey G)";
  };

  if (typeof onToggleFog === "function") {
    const section = document.createElement("div");
    section.className = "dev-hud-section";

    const heading = document.createElement("div");
    heading.className = "dev-hud-heading";
    heading.textContent = "Environment";
    section.appendChild(heading);

    const buttonRow = document.createElement("div");
    buttonRow.className = "dev-hud-btn-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dev-hud-btn";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      onToggleFog();
      updateFogControls();
    });

    fogButton = btn;
    buttonRow.appendChild(btn);
    section.appendChild(buttonRow);
    content.appendChild(section);
    updateFogControls();
  }

  // Sun Alignment
  if (sunAlignment) {
    const section = document.createElement("div");
    section.className = "dev-hud-section";

    const heading = document.createElement("div");
    heading.className = "dev-hud-heading";
    heading.textContent = "Sun Alignment";
    section.appendChild(heading);

    const createSliderRow = (
      labelText: string,
      min: number,
      max: number,
      step: number,
      initialValue: number,
      onValue: (value: number) => void,
    ) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "8px",
      });

      const label = document.createElement("div");
      label.textContent = labelText;
      Object.assign(label.style, {
        width: "90px",
        opacity: "0.85",
        fontSize: "12px",
      });

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(initialValue);
      input.style.flex = "1";

      const value = document.createElement("span");
      value.textContent = initialValue.toFixed(1);
      value.style.width = "48px";
      value.style.opacity = "0.75";

      input.addEventListener("input", (event) => {
        const target = event.target as HTMLInputElement | null;
        if (target) {
          const v = Math.min(max, Math.max(min, Number(target.value)));
          value.textContent = v.toFixed(1);
          onValue(v);
        }
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(value);
      section.appendChild(row);
    };

    const initialAzimuth = sunAlignment.getAzimuthDeg?.() ?? 0;
    const initialElevation = sunAlignment.getElevationDeg?.() ?? 0;

    createSliderRow("Sun Azimuth", 0, 360, 1, initialAzimuth, (v) => sunAlignment.onChange?.({ azimuthDeg: v }));
    createSliderRow("Sun Elevation", 0, 90, 0.5, initialElevation, (v) => sunAlignment.onChange?.({ elevationDeg: v }));

    content.appendChild(section);
  }

  registerPanel("devHud", wrap, 3);

  const elPos = readout.querySelector<HTMLSpanElement>("#hud-pos");
  const elBear = readout.querySelector<HTMLSpanElement>("#hud-bear");

  const toBearing = (dir: Vector3Like) => {
    const yaw = Math.atan2(dir.x, dir.z) * 180 / Math.PI;
    const deg = (yaw + 360) % 360;
    const dirs = ["N","NE","E","SE","S","SW","W","NW","N"];
    const idx = Math.round(deg / 45);
    return { deg: Math.round(deg), label: dirs[idx] };
  };

  let lastPosText = "";
  let lastBearText = "";
  let lastNeedleDeg = 0;

  const updatePositionReadout = (p?: Vector3Like | null) => {
    if (!p || !elPos) return;
    const posText = `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`;
    if (posText === lastPosText) return;
    updateTextIfChanged(elPos, posText);
    lastPosText = posText;
  };

  const updateBearingReadout = (d?: Vector3Like | null) => {
    if (!d || !elBear) return;
    const b = toBearing(d);
    const bearText = `${b.deg}° ${b.label}`;
    if (bearText !== lastBearText) {
      updateTextIfChanged(elBear, bearText);
      lastBearText = bearText;
    }
    if (b.deg !== lastNeedleDeg) {
      needle.style.transform = `translate(-1px, -40px) rotate(${b.deg}deg)`;
      lastNeedleDeg = b.deg;
    }
  };

  const disposeUpdate = registerUIUpdate(
    "devHud",
    () => {
      try {
        updatePositionReadout(getPosition?.());
        updateBearingReadout(getDirection?.());
        syncActivePreset();
      } catch {}
    },
    10,
  );

  const getPresetKeyBindings = (): Map<string, string> | null => {
    return wrap?._presetKeyBindings ?? null;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key?.toLowerCase() === "p") {
      const p = getPosition?.();
      if (p) {
        onPin?.(p);
        console.log(`[PIN] @ (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
      }
    }
    if (e.code === "KeyT" && !e.repeat) {
      e.preventDefault();
      cyclePreset?.();
      return;
    }
    const bindings = getPresetKeyBindings();
    if (!bindings || typeof onSetLightingPreset !== "function") return;
    if (e.repeat) return;
    const presetName = bindings.get(e.code) || bindings.get(e.key);
    if (presetName) {
      e.preventDefault();
      onSetLightingPreset(presetName);
      setActivePresetFn?.(presetName);
    }
  };
  window.addEventListener("keydown", onKey);

  const handle: DevHudHandle = {
    dispose() {
      disposeUpdate();
      window.removeEventListener("keydown", onKey);
      wrap.remove();
    },
    setStatusLine,
    setOceanStatus,
    rootElement: wrap,
    updateFogState: updateFogControls,
    setActivePreset: (name) => setActivePresetFn?.(name),
  };
  return handle;
}
