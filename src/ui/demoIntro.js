let activeIntro = null;

export function showDemoIntro({
  title = "A Short Walk Through Athens",
  route = "Agora -> Harbor Quarter -> Acropolis",
  hint = "Start in the Agora, follow the blue beacon down to the sea, then climb toward the ivory glow above the city.",
  durationMs = 9000,
} = {}) {
  if (typeof document === "undefined") {
    return () => {};
  }

  activeIntro?.dismiss?.();

  const root = document.createElement("div");
  root.setAttribute("aria-live", "polite");
  Object.assign(root.style, {
    position: "fixed",
    top: "18px",
    left: "50%",
    transform: "translateX(-50%) translateY(0)",
    width: "min(480px, calc(100vw - 32px))",
    padding: "12px 16px",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(26, 20, 11, 0.92), rgba(45, 33, 19, 0.88))",
    border: "1px solid rgba(247, 209, 123, 0.38)",
    boxShadow: "0 18px 42px rgba(0, 0, 0, 0.35)",
    color: "#f7f1e4",
    fontFamily: 'Georgia, "Times New Roman", serif',
    pointerEvents: "none",
    zIndex: "30",
    opacity: "0",
    transition: "opacity 220ms ease, transform 220ms ease",
  });

  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontSize: "20px",
    fontWeight: "700",
    letterSpacing: "0.02em",
    marginBottom: "4px",
    color: "#f7d17b",
    textAlign: "center",
  });
  root.appendChild(titleEl);

  const routeEl = document.createElement("div");
  routeEl.textContent = route;
  Object.assign(routeEl.style, {
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    textAlign: "center",
    color: "rgba(247, 241, 228, 0.82)",
    marginBottom: "6px",
  });
  root.appendChild(routeEl);

  const hintEl = document.createElement("div");
  hintEl.textContent = hint;
  Object.assign(hintEl.style, {
    fontSize: "14px",
    lineHeight: "1.35",
    textAlign: "center",
    color: "#f7f1e4",
  });
  root.appendChild(hintEl);

  document.body.appendChild(root);

  const dismiss = () => {
    root.style.opacity = "0";
    root.style.transform = "translateX(-50%) translateY(-8px)";
    window.setTimeout(() => {
      root.remove();
      if (activeIntro?.root === root) {
        activeIntro = null;
      }
    }, 260);
  };

  const timerId = window.setTimeout(dismiss, durationMs);
  activeIntro = { root, dismiss };

  window.requestAnimationFrame(() => {
    root.style.opacity = "1";
    root.style.transform = "translateX(-50%) translateY(0)";
  });

  return () => {
    window.clearTimeout(timerId);
    dismiss();
  };
}
