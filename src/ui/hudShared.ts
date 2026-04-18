import "./hudTheme.css";

const DEFAULT_FRAME_INTERVAL = 1000 / 15;

interface HudPanelOptions {
  readonly title: string;
  readonly className?: string;
  readonly initialCollapsed?: boolean;
  readonly collapseContent?: boolean;
  readonly toggleLabels?: { collapsed?: string; expanded?: string };
  readonly onToggle?: (collapsed: boolean) => void;
}

export interface HudPanelHandle {
  readonly root: HTMLDivElement;
  readonly header: HTMLDivElement;
  readonly titleEl: HTMLDivElement;
  readonly content: HTMLDivElement;
  readonly toggleButton: HTMLButtonElement;
  setCollapsed(next: boolean): void;
  isCollapsed(): boolean;
}

export function createHudPanel(options: HudPanelOptions): HudPanelHandle {
  const { className, collapseContent = true } = options;
  const labels = {
    collapsed: options.toggleLabels?.collapsed ?? "Expand",
    expanded: options.toggleLabels?.expanded ?? "Minimize",
  };

  const root = document.createElement("div");
  root.className = ["hud-panel", className].filter(Boolean).join(" ");

  const header = document.createElement("div");
  header.className = "hud-panel__header";

  const titleEl = document.createElement("div");
  titleEl.className = "hud-panel__title";
  titleEl.textContent = options.title;

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "hud-toggle";

  header.appendChild(titleEl);
  header.appendChild(toggleButton);

  const content = document.createElement("div");
  content.className = "hud-panel__content";
  content.dataset['canCollapse'] = collapseContent ? "1" : "0";

  root.appendChild(header);
  root.appendChild(content);

  let collapsed = Boolean(options.initialCollapsed);

  const animateContent = (nextCollapsed: boolean, animate: boolean): void => {
    const contentElement = content;
    if (!collapseContent) {
      contentElement.style.height = "auto";
      contentElement.style.opacity = "1";
      return;
    }
    const startHeight = contentElement.getBoundingClientRect().height;
    const targetHeight = nextCollapsed ? 0 : contentElement.scrollHeight;

    if (!animate) {
      contentElement.style.height = nextCollapsed ? "0px" : "auto";
      contentElement.style.opacity = nextCollapsed ? "0" : "1";
      return;
    }

    contentElement.style.height = `${startHeight}px`;
    contentElement.style.opacity = nextCollapsed ? "1" : "0";
    void contentElement.getBoundingClientRect();
    contentElement.style.height = `${targetHeight}px`;
    contentElement.style.opacity = nextCollapsed ? "0" : "1";
  };

  const applyState = (animate = false) => {
    toggleButton.textContent = collapsed ? labels.collapsed : labels.expanded;
    root.classList.toggle("hud-panel--collapsed", collapsed);
    animateContent(collapsed, animate);
    options.onToggle?.(collapsed);
  };

  content.addEventListener("transitionend", (event) => {
    if (event.target !== content || event.propertyName !== "height") return;
    if (!collapsed) {
      content.style.height = "auto";
    }
  });

  toggleButton.addEventListener("click", (event) => {
    event.preventDefault();
    collapsed = !collapsed;
    applyState(true);
  });

  applyState();

  return {
    root,
    header,
    titleEl,
    content,
    toggleButton,
    setCollapsed(next) {
      if (collapsed === next) return;
      collapsed = next;
      applyState();
    },
    isCollapsed() {
      return collapsed;
    },
  };
}

export function startThrottledLoop(
  callback: () => void,
  intervalMs = DEFAULT_FRAME_INTERVAL,
): () => void {
  let rafId = 0;
  let running = true;
  let lastTime = 0;

  const loop = (timestamp: number) => {
    if (!running) return;
    if (timestamp - lastTime >= intervalMs) {
      lastTime = timestamp;
      callback();
    }
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
  return () => {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  };
}

export function updateTextIfChanged(
  element: { textContent: string | null } | null | undefined,
  nextValue: string,
): void {
  if (!element) return;
  if (element.textContent !== nextValue) {
    element.textContent = nextValue;
  }
}
