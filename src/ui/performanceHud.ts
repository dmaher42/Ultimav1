import { createHudPanel, updateTextIfChanged } from "./hudShared.js";
import { registerUIUpdate } from "./updateLoop.js";
import { registerPanel, unregisterPanel, updateLayout } from "./HudManager.js";
import "./hudTheme.css";

type PerformanceHudMetrics = {
  fps?: number;
  frameTimeMs?: number;
  averageFrameTimeMs?: number;
  worstFrameMs?: number;
  drawCalls?: number;
  triangles?: number;
  textures?: number;
  geometries?: number;
  jsHeapMb?: number | null;
};

interface PerformanceHudOptions {
  readonly getMetrics?: () => PerformanceHudMetrics | null | undefined;
  readonly toggleKey?: string;
}

type WindowWithPerfHudFlag = Window &
  typeof globalThis & { SHOW_PERF_HUD?: boolean };

export interface PerformanceHudHandle {
  dispose(): void;
  setVisible(visible: boolean): void;
}

function formatMetric(
  value?: number | null,
  digits = 0,
  fallback = "--",
): string {
  if (!Number.isFinite(value)) return fallback;
  return Number(value).toFixed(digits);
}

export function mountPerformanceHud(
  options: PerformanceHudOptions = {},
): PerformanceHudHandle | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const runtimeWindow = window as WindowWithPerfHudFlag;
  let visible = runtimeWindow.SHOW_PERF_HUD === true;
  const toggleKey = options.toggleKey ?? "F10";

  const panel = createHudPanel({
    title: "Performance",
    className: "perf-hud-panel",
    toggleLabels: { expanded: "Minimize", collapsed: "Expand" },
    onToggle: () => updateLayout(),
  });

  const wrap = panel.root;
  const content = panel.content;
  wrap.style.width = "208px";

  const hint = document.createElement("div");
  hint.className = "perf-hud-hint";
  hint.textContent = `${toggleKey} hides this panel`;
  content.appendChild(hint);

  const statsGrid = document.createElement("div");
  statsGrid.className = "perf-hud-grid";
  content.appendChild(statsGrid);

  const rowElements = new Map<string, HTMLSpanElement>();
  const createRow = (label: string, key: string) => {
    const row = document.createElement("div");
    row.className = "perf-hud-row";

    const labelEl = document.createElement("span");
    labelEl.className = "perf-hud-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "perf-hud-value";
    valueEl.textContent = "--";

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    statsGrid.appendChild(row);
    rowElements.set(key, valueEl);
  };

  createRow("FPS", "fps");
  createRow("Frame", "frame");
  createRow("Avg frame", "avg");
  createRow("Worst", "worst");
  createRow("Draw calls", "calls");
  createRow("Triangles", "triangles");
  createRow("Textures", "textures");
  createRow("Geometry", "geometries");
  createRow("JS heap", "heap");

  const applyVisibility = () => {
    runtimeWindow.SHOW_PERF_HUD = visible;
    wrap.style.display = visible ? "" : "none";
    updateLayout();
  };

  const updateStats = () => {
    const metrics = options.getMetrics?.() ?? {};
    updateTextIfChanged(rowElements.get("fps"), formatMetric(metrics.fps, 0));
    updateTextIfChanged(
      rowElements.get("frame"),
      `${formatMetric(metrics.frameTimeMs, 1)} ms`,
    );
    updateTextIfChanged(
      rowElements.get("avg"),
      `${formatMetric(metrics.averageFrameTimeMs, 1)} ms`,
    );
    updateTextIfChanged(
      rowElements.get("worst"),
      `${formatMetric(metrics.worstFrameMs, 1)} ms`,
    );
    updateTextIfChanged(rowElements.get("calls"), formatMetric(metrics.drawCalls, 0));
    updateTextIfChanged(
      rowElements.get("triangles"),
      formatMetric(metrics.triangles, 0),
    );
    updateTextIfChanged(
      rowElements.get("textures"),
      formatMetric(metrics.textures, 0),
    );
    updateTextIfChanged(
      rowElements.get("geometries"),
      formatMetric(metrics.geometries, 0),
    );
    updateTextIfChanged(
      rowElements.get("heap"),
      metrics.jsHeapMb == null ? "--" : `${formatMetric(metrics.jsHeapMb, 1)} MB`,
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code !== toggleKey) return;
    event.preventDefault();
    visible = !visible;
    applyVisibility();
  };

  registerPanel("performanceHud", wrap, 4);
  const disposeUpdate = registerUIUpdate("performanceHud", updateStats, 4);
  window.addEventListener("keydown", onKeyDown);
  updateStats();
  applyVisibility();

  return {
    dispose() {
      disposeUpdate();
      window.removeEventListener("keydown", onKeyDown);
      unregisterPanel("performanceHud");
      wrap.remove();
    },
    setVisible(nextVisible: boolean) {
      visible = !!nextVisible;
      applyVisibility();
    },
  };
}
