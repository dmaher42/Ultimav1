import { registerPanel } from "./HudManager.js";
import "./hudTheme.css";

export class InteractionHud {
  public root: HTMLElement;
  private keyEl: HTMLElement;
  private labelEl: HTMLElement;

  constructor() {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      background: "var(--hud-surface-strong)",
      color: "var(--hud-text)",
      padding: "8px 16px",
      borderRadius: "20px",
      font: "var(--hud-font)",
      fontWeight: "600",
      pointerEvents: "none",
      transition: "opacity 0.2s ease",
      opacity: "0",
      marginTop: "auto",
      marginBottom: "20%"
    });

    // Icon/Key prompt
    this.keyEl = document.createElement("span");
    this.keyEl.textContent = "[E]";
    Object.assign(this.keyEl.style, {
      background: "rgba(255,255,255,0.9)",
      color: "#000",
      borderRadius: "4px",
      padding: "0 4px",
      marginRight: "8px",
      fontWeight: "700",
      fontSize: "12px"
    });
    this.root.appendChild(this.keyEl);

    this.labelEl = document.createElement("span");
    this.root.appendChild(this.labelEl);

    registerPanel("interactionHud", this.root, 4);
  }

  show(text: string) {
    this.labelEl.textContent = text;
    this.root.style.opacity = "1";
  }

  hide() {
    this.root.style.opacity = "0";
  }
}
