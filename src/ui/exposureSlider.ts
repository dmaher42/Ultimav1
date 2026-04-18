import type { ExposureSliderOptions } from "@app/types";

import { registerPanel, unregisterPanel } from "./HudManager.js";
import "./hudTheme.css";

export interface ExposureSliderTarget {
  toneMappingExposure: number;
}

export interface ExposureSliderHandle {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  get value(): number;
  set value(v: number);
  dispose(): void;
}

const DEFAULT_MIN = 0.2;
const DEFAULT_MAX = 2.0;
const DEFAULT_STEP = 0.01;
const DEFAULT_KEY = "F9" as const;
const DEFAULT_STORAGE_KEY = "toneMappingExposure" as const;

// Minimal UI overlay for tone mapping exposure (F9 toggles). No deps.
export function mountExposureSlider(
  renderer: ExposureSliderTarget | null | undefined,
  opts: ExposureSliderOptions = {},
): ExposureSliderHandle | null {
  if (!renderer || typeof document === "undefined") {
    return null;
  }

  const min = Number.isFinite(opts.min) ? Number(opts.min) : DEFAULT_MIN;
  const max = Number.isFinite(opts.max) ? Number(opts.max) : DEFAULT_MAX;
  const step = Number.isFinite(opts.step) ? Number(opts.step) : DEFAULT_STEP;
  const keyToggle = typeof opts.key === "string" && opts.key.trim().length > 0 ? opts.key : DEFAULT_KEY;
  const storageKey = typeof opts.storageKey === "string" && opts.storageKey.trim().length > 0
    ? opts.storageKey
    : DEFAULT_STORAGE_KEY;

  const wrap = document.createElement("div");
  wrap.id = "tmx-wrap";
  Object.assign(wrap.style, {
    padding: "10px 12px",
    background: "var(--hud-bg)",
    backdropFilter: "blur(6px)",
    borderRadius: "var(--hud-radius-md)",
    font: "var(--hud-font)",
    color: "var(--hud-text)",
    userSelect: "none",
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement("div");
  label.textContent = "Exposure";
  label.style.marginBottom = "6px";
  label.style.opacity = "0.9";

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.style.width = "140px";

  const value = document.createElement("span");
  value.style.marginLeft = "8px";
  value.style.opacity = "0.8";

  const stored = typeof window !== "undefined" ? Number(window.localStorage?.getItem(storageKey)) : NaN;
  const initial = Number.isFinite(stored) ? stored : renderer.toneMappingExposure ?? 1.0;

  const clamp = (x: number): number => Math.min(max, Math.max(min, x));
  const setExposure = (x: number | string): void => {
    const v = clamp(Number(x));
    renderer.toneMappingExposure = v;
    input.value = String(v);
    value.textContent = v.toFixed(2);
  };

  setExposure(initial);

  input.addEventListener("input", (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (target) {
      setExposure(target.value);
    }
  });

  input.addEventListener("change", () => {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      window.localStorage.setItem(storageKey, input.value);
    }
  });

  row.appendChild(input);
  row.appendChild(value);
  wrap.appendChild(label);
  wrap.appendChild(row);
  registerPanel("exposureSlider", wrap, 1);

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === keyToggle) {
      wrap.style.display = wrap.style.display !== "none" ? "none" : "block";
      event.preventDefault();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeydown);
  }

  return {
    element: wrap,
    input,
    get value(): number {
      return Number(input.value);
    },
    set value(v: number) {
      setExposure(v);
    },
    dispose() {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeydown);
      }
      unregisterPanel("exposureSlider");
      wrap.remove();
    },
  };
}
