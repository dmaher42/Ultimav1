/**
 * Injects a tiny crosshair element so the player can see where they are aiming.
 * We only create it once, even if attachCrosshair is called multiple times.
 */
export function attachCrosshair() {
  if (document.querySelector(".crosshair-overlay")) {
    return;
  }

  ensureCrosshairStyles();

  const crosshair = document.createElement("div");
  crosshair.className = "crosshair-overlay";
  document.body.appendChild(crosshair);
}

const STYLE_ID = "crosshair-overlay-style";

function ensureCrosshairStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .crosshair-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .crosshair-overlay::before {
      content: "";
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
    }
  `;

  document.head.appendChild(style);
}
