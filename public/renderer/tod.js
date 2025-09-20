const TAU = Math.PI * 2;

function clamp(value, min, max) {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

function toRGBA({ r, g, b, a }) {
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(3)})`;
}

const DAY_TINT = { r: 255, g: 230, b: 200, a: 0.05 };
const NIGHT_TINT = { r: 180, g: 210, b: 255, a: 0.08 };

export function createTimeOfDay({ speed = 0.05, min = 0, max = 1 } = {}) {
  const range = Math.max(0.001, max - min || 1);
  let t = clamp(min, min, max);
  let rate = speed;

  function update(dt) {
    const delta = Number.isFinite(dt) ? dt : 0;
    if (!delta) return;
    t += delta * rate;
    if (t > max) {
      t = min + ((t - min) % range);
    } else if (t < min) {
      t = max - ((min - t) % range);
    }
  }

  function getPhase() {
    const phase = Math.sin(((t - min) / range) * TAU);
    const dayWeight = (phase + 1) / 2; // 0 at night, 1 at day
    return clamp(dayWeight, 0, 1);
  }

  function getTint() {
    const dayAmount = getPhase();
    const tint = {
      r: mix(NIGHT_TINT.r, DAY_TINT.r, dayAmount),
      g: mix(NIGHT_TINT.g, DAY_TINT.g, dayAmount),
      b: mix(NIGHT_TINT.b, DAY_TINT.b, dayAmount),
      a: mix(NIGHT_TINT.a, DAY_TINT.a, dayAmount)
    };
    const vignette = mix(0.45, 0.25, dayAmount);
    return { tint: toRGBA(tint), vignette };
  }

  function isNight() {
    return getPhase() < 0.45;
  }

  function setSpeed(newSpeed) {
    if (Number.isFinite(newSpeed)) {
      rate = newSpeed;
    }
  }

  return {
    get t() {
      return t;
    },
    update,
    getTint,
    isNight,
    setSpeed
  };
}

export default createTimeOfDay;
