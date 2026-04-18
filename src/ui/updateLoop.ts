type UpdateEntry = {
  name: string;
  fn: (dt: number) => void;
  intervalMs: number;
  lastTime: number;
};

const entries = new Map<string, UpdateEntry>();
let rafId = 0;
let lastTick = 0;

function tick(ts: number) {
  const now = ts || performance.now?.() || Date.now();
  const dt = now - lastTick;
  lastTick = now;

  entries.forEach((e) => {
    if (now - e.lastTime >= e.intervalMs) {
      e.lastTime = now;
      try {
        e.fn(dt);
      } catch (err) {
        console.warn(`[UIUpdate] '${e.name}' update failed`, err);
      }
    }
  });

  if (entries.size > 0) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = 0;
  }
}

function ensureLoopRunning() {
  if (!rafId && entries.size > 0) {
    lastTick = performance.now?.() || Date.now();
    rafId = requestAnimationFrame(tick);
  }
}

export function registerUIUpdate(
  name: string,
  fn: (dt: number) => void,
  hz = 10,
): () => void {
  const clampedHz = Math.max(1, Math.min(60, Math.floor(hz)));
  const intervalMs = 1000 / clampedHz;
  const entry: UpdateEntry = { name, fn, intervalMs, lastTime: 0 };
  entries.set(name, entry);
  ensureLoopRunning();
  return () => {
    entries.delete(name);
  };
}

export function clearAllUIUpdates(): void {
  entries.clear();
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  rafId = 0;
}
