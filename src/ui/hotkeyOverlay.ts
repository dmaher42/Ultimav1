import type {
  HotkeyDescriptor,
  HotkeyOverlayHandle as HotkeyOverlayHandleContract,
  HotkeyOverlayOptions,
} from "@app/types";

import { createHudPanel } from "./hudShared.js";
import { registerPanel } from "./HudManager.js";
import "./hudTheme.css";

const ROOT_CLASS = "hotkey-overlay" as const;
const HIDDEN_MOD = "hotkey-overlay--hidden" as const;
const STORAGE_KEY = "hotkeyOverlayOpen" as const;

export type HotkeyOverlayHandle = HotkeyOverlayHandleContract;

function loadOpenState(): boolean {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveOpenState(isOpen: boolean): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, isOpen ? "1" : "0");
  } catch {
    // ignore write errors (e.g., storage disabled)
  }
}

const DEFAULT_HOTKEYS: readonly HotkeyDescriptor[] = [
  { keys: ["W", "A", "S", "D"], description: "Move" },
  { keys: ["Shift"], description: "Sprint" },
  { keys: ["Space"], description: "Jump / fly up" },
  { keys: ["Ctrl"], description: "Fly down" },
  { keys: ["F"], description: "Toggle flight mode" },
  { keys: ["E"], description: "Interact with highlighted objects" },
  { keys: ["Arrow Keys"], description: "Look around" },
  { keys: ["PageUp", "PageDown"], description: "Zoom camera" },
  { keys: ["End"], description: "Reset camera behind player" },
  { keys: ["H"], description: "Show or hide this controls panel" },
];

export function mountHotkeyOverlay(
  options: HotkeyOverlayOptions = {},
): HotkeyOverlayHandle | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (document.querySelector(`.${ROOT_CLASS}`)) {
    return null;
  }

  const hotkeys: readonly HotkeyDescriptor[] =
    Array.isArray(options.hotkeys) && options.hotkeys.length > 0
      ? options.hotkeys
      : DEFAULT_HOTKEYS;

  const toggleKey = typeof options.toggleKey === "string" && options.toggleKey.trim().length > 0
    ? options.toggleKey
    : "KeyH";

  const showButton = options.showButton !== false;

  const initialOpen = loadOpenState();

  const root = document.createElement("div");
  root.className = ROOT_CLASS;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-live", "polite");

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = `${ROOT_CLASS}__toggle hud-toggle`;
  toggleButton.innerHTML = `
    <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">
      <path fill=\"currentColor\"
        d=\"M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-3.5 3.5a1 1 0 0 1-1.7-.7V17H6a3 3 0 0 1-3-3V6zm4 2a1 1 0 1 0
0 2h2a1 1 0 1 0 0-2H7zm5 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2zm5 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2z\"/>
    </svg>
    <span class=\"${ROOT_CLASS}__sr\">Hotkeys (press ${resolveKeyLabel(toggleKey)})</span>
  `;
  toggleButton.setAttribute("title", `Hotkeys (${resolveKeyLabel(toggleKey)})`);
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.setAttribute("aria-controls", `${ROOT_CLASS}-panel`);

  const panelHandle = createHudPanel({
    title: "Controls",
    className: `${ROOT_CLASS}__panel`,
    initialCollapsed: !initialOpen,
    toggleLabels: { collapsed: "Show", expanded: "Hide" },
    onToggle: (collapsed) => {
      const open = !collapsed;
      saveOpenState(open);
      root.classList.toggle(HIDDEN_MOD, !open);
    },
  });
  panelHandle.root.id = `${ROOT_CLASS}-panel`;
  panelHandle.root.setAttribute("role", "document");
  panelHandle.root.setAttribute("aria-hidden", String(!initialOpen));

  const list = document.createElement("dl");
  list.className = `${ROOT_CLASS}__list`;

  for (const entry of hotkeys) {
    if (!entry || !Array.isArray(entry.keys) || entry.keys.length === 0) {
      continue;
    }
    const keys = entry.keys.map((key: string) => String(key).trim()).filter(Boolean);
    const description = typeof entry.description === "string" ? entry.description : "";
    if (keys.length === 0 || !description) {
      continue;
    }

    const dt = document.createElement("dt");
    dt.className = `${ROOT_CLASS}__keys`;

    keys.forEach((key) => {
      const kbd = document.createElement("kbd");
      kbd.className = `${ROOT_CLASS}__kbd`;
      kbd.textContent = key;
      dt.appendChild(kbd);
    });

    const dd = document.createElement("dd");
    dd.className = `${ROOT_CLASS}__description`;
    dd.textContent = description;

    list.appendChild(dt);
    list.appendChild(dd);
  }

  panelHandle.content.appendChild(list);

  const hint = document.createElement("p");
  hint.className = `${ROOT_CLASS}__hint`;
  hint.textContent = `Press ${resolveKeyLabel(toggleKey)} to toggle`;
  panelHandle.content.appendChild(hint);

  if (!initialOpen) {
    root.classList.add(HIDDEN_MOD);
  } else {
    root.classList.remove(HIDDEN_MOD);
  }

  if (showButton) {
    root.appendChild(toggleButton);
  }
  root.appendChild(panelHandle.root);

  registerPanel("hotkeyOverlay", root, 2);

  const applyVisibility = (shouldOpen: boolean): void => {
    panelHandle.setCollapsed(!shouldOpen);
    root.classList.toggle(HIDDEN_MOD, !shouldOpen);
    toggleButton.setAttribute("aria-expanded", String(shouldOpen));
    panelHandle.root.setAttribute("aria-hidden", String(!shouldOpen));
    saveOpenState(shouldOpen);
  };

  applyVisibility(initialOpen);

  const updateVisibility = (toggle?: boolean): void => {
    if (toggle === true) {
      applyVisibility(root.classList.contains(HIDDEN_MOD));
      return;
    }
    if (toggle === false) {
      applyVisibility(false);
      return;
    }
    applyVisibility(!root.classList.contains(HIDDEN_MOD));
  };

  if (showButton) {
    toggleButton.addEventListener("click", () => {
      updateVisibility(true);
    });
  }

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.code === toggleKey && !event.repeat) {
      updateVisibility(true);
    }
    if (event.code === "Escape" && !root.classList.contains(HIDDEN_MOD)) {
      updateVisibility(false);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeydown);
  }

  return {
    element: root,
    toggle(forceOpen?: boolean) {
      if (forceOpen === undefined) {
        updateVisibility();
      } else {
        applyVisibility(Boolean(forceOpen));
      }
    },
    dispose() {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeydown);
      }
      root.remove();
    },
  };
}

function resolveKeyLabel(code: string): string {
  switch (code) {
    case "KeyH":
      return "H";
    case "F9":
    case "F10":
    case "F11":
    case "F12":
      return code;
    case "ControlLeft":
    case "ControlRight":
      return "Ctrl";
    default:
      if (code.startsWith("Key") && code.length === 4) {
        return code.slice(3);
      }
      return code;
  }
}
