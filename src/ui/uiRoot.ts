const STYLE_ID = "ui-root-style" as const;
const ROOT_ID = "ui-root" as const;

export function ensureUIRoot(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  let root = document.getElementById(ROOT_ID);
  if (!root) {
    const createdRoot = document.createElement("div");
    createdRoot.id = ROOT_ID;
    document.body.appendChild(createdRoot);
    ensureStyles();
    // create slots
    ["topLeft", "topRight", "bottomLeft", "bottomRight", "center"].forEach(
      (name) => {
        const slot = document.createElement("div");
        slot.dataset["slot"] = name;
        slot.className = `ui-slot ui-slot--${name}`;
        createdRoot.appendChild(slot);
      },
    );
    root = createdRoot;
  }
  return root;
}

export function getUISlot(name = "topRight"): HTMLElement | null {
  const root = ensureUIRoot();
  if (!root) {
    return null;
  }
  return root.querySelector<HTMLElement>(`.ui-slot--${name}`) ?? root;
}

function ensureStyles(): void {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      inset: 0;
      pointer-events: none; /* panels opt-in */
      display: grid;
      grid-template-rows: auto 1fr auto;
      grid-template-columns: 1fr 1fr;
      padding: 12px;
      gap: 12px;
      z-index: 1200;
    }
    .hud-small-toggle {
      position: absolute;
      left: 12px;
      bottom: 12px;
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(0, 0, 0, 0.55);
      color: white;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ui-slot { display: flex; gap: 10px; align-items: flex-start; }
    .ui-slot--topLeft, .ui-slot--topRight { flex-direction: column; align-items: flex-start; }
    .ui-slot > * { pointer-events: auto; }
    .ui-slot--topLeft    { grid-row: 1; grid-column: 1; justify-self: start; }
    .ui-slot--topRight   { grid-row: 1; grid-column: 2; justify-self: end; }
    .ui-slot--bottomLeft { grid-row: 3; grid-column: 1; align-items: flex-end; }
    .ui-slot--bottomRight{ grid-row: 3; grid-column: 2; justify-self: end; align-items: flex-end; }
    .ui-slot--center     { grid-row: 2; grid-column: 1 / span 2; justify-content: center; }

    /* Small screens: tighter padding and single column top row */
    @media (max-width: 640px) {
      #${ROOT_ID} { padding: 8px; gap: 8px; }
      .ui-slot--topRight, .ui-slot--topLeft { justify-self: stretch; }
      .ui-slot--topLeft, .ui-slot--topRight { flex-wrap: wrap; }
    }
  `;
  document.head.appendChild(style);
}
