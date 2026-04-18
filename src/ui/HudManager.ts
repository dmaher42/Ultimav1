import { ensureUIRoot, getUISlot } from "./uiRoot.js";

type HudQuadrant = "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "center";

interface HudPanelRegistration {
  readonly name: string;
  readonly element: HTMLElement;
  readonly priority: number;
  readonly quadrant: HudQuadrant;
  layoutHidden: boolean;
  previousDisplay?: string | null;
}

const DEFAULT_POSITIONS: Record<string, HudQuadrant> = {
  miniMap: "topLeft",
  questHud: "topLeft",
  devHud: "topRight",
  performanceHud: "bottomLeft",
  audioMixer: "topRight",
  exposureSlider: "topRight",
  hotkeyOverlay: "topRight",
  interactionHud: "center",
};

const SMALL_SCREEN_WIDTH = 1024;
const SMALL_SCREEN_HEIGHT = 768;
const COLLAPSIBLE_PANELS = new Set([
  "questHud",
  "devHud",
  "audioMixer",
  "exposureSlider",
  "hotkeyOverlay",
]);

class HudManager {
  private panels = new Map<string, HudPanelRegistration>();
  private showCollapsedPanels = false;
  private toggleButton: HTMLButtonElement | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => this.updateLayout());
    }
  }

  registerPanel(name: string, element: HTMLElement, priority = 0): void {
    if (!element || typeof document === "undefined") return;
    ensureUIRoot();

    const quadrant = DEFAULT_POSITIONS[name] ?? "topRight";
    this.panels.set(name, {
      name,
      element,
      priority,
      quadrant,
      layoutHidden: false,
    });

    element.dataset["hudQuadrant"] = quadrant;
    this.updateLayout();
  }

  unregisterPanel(name: string): void {
    const registration = this.panels.get(name);
    if (!registration) return;
    if (registration.layoutHidden) {
      if (registration.previousDisplay != null) {
        registration.element.style.display = registration.previousDisplay;
      } else {
        registration.element.style.removeProperty("display");
      }
    }
    this.panels.delete(name);
    this.updateLayout();
  }

  private hidePanel(registration: HudPanelRegistration): void {
    registration.previousDisplay = registration.element.style.display;
    registration.layoutHidden = true;
    registration.element.style.display = "none";
  }

  private ensureToggleButton(): HTMLButtonElement | null {
    if (typeof document === "undefined") return null;

    if (this.toggleButton) return this.toggleButton;

    const root = ensureUIRoot();
    if (!root) return null;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hud-small-toggle";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      this.showCollapsedPanels = !this.showCollapsedPanels;
      this.updateLayout();
    });

    root.appendChild(button);
    this.toggleButton = button;
    return button;
  }

  private updateToggleButton(isSmallScreen: boolean): void {
    const button = this.ensureToggleButton();
    if (!button) return;

    if (!isSmallScreen) {
      button.style.display = "none";
      this.showCollapsedPanels = false;
      return;
    }

    button.style.display = "block";
    button.textContent = this.showCollapsedPanels
      ? "Hide HUD panels"
      : "Show HUD panels";
  }

  updateLayout(): void {
    if (typeof document === "undefined") return;
    ensureUIRoot();

    const isSmallScreen =
      typeof window !== "undefined" &&
      (window.innerWidth <= SMALL_SCREEN_WIDTH ||
        window.innerHeight <= SMALL_SCREEN_HEIGHT);
    const maxPerQuadrant = isSmallScreen ? 1 : Number.POSITIVE_INFINITY;
    this.updateToggleButton(isSmallScreen);

    const allowCollapsedPanels = !isSmallScreen || this.showCollapsedPanels;

    const grouped = new Map<HudQuadrant, HudPanelRegistration[]>();
    const visiblePanels: HudPanelRegistration[] = [];

    this.panels.forEach((panel) => {
      const shouldHideForSize =
        isSmallScreen &&
        !allowCollapsedPanels &&
        COLLAPSIBLE_PANELS.has(panel.name);

      if (shouldHideForSize) {
        this.hidePanel(panel);
        return;
      }

      visiblePanels.push(panel);
    });

    visiblePanels.forEach((panel) => {
      const list = grouped.get(panel.quadrant) ?? [];
      list.push(panel);
      grouped.set(panel.quadrant, list);
    });

    grouped.forEach((panels, quadrant) => {
      const slot = getUISlot(quadrant);
      if (!slot) return;

      const sorted = panels.sort((a, b) => b.priority - a.priority);
      const visible = sorted.slice(0, maxPerQuadrant);
      const hidden = sorted.slice(maxPerQuadrant);

      visible.forEach((panel) => {
        if (panel.layoutHidden) {
          if (panel.previousDisplay != null) {
            panel.element.style.display = panel.previousDisplay;
          } else {
            panel.element.style.removeProperty("display");
          }
          panel.layoutHidden = false;
          panel.previousDisplay = undefined;
        }
        if (panel.element.parentElement !== slot) {
          slot.appendChild(panel.element);
        }
      });

      hidden.forEach((panel) => {
        panel.previousDisplay = panel.element.style.display;
        panel.layoutHidden = true;
        panel.element.style.display = "none";
      });
    });
  }
}

const manager = new HudManager();

export const registerPanel = (
  name: string,
  element: HTMLElement,
  priority = 0,
): void => manager.registerPanel(name, element, priority);

export const unregisterPanel = (name: string): void =>
  manager.unregisterPanel(name);

export const updateLayout = (): void => manager.updateLayout();
