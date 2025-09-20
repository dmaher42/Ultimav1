function normaliseMap(map) {
  const states = {};
  Object.entries(map || {}).forEach(([name, config]) => {
    if (!config) return;
    const frames = Array.isArray(config.frames) ? config.frames.slice() : [];
    const fps = Number.isFinite(config.fps) ? Math.max(0, config.fps) : 0;
    if (!frames.length) return;
    states[name] = { frames, fps };
  });
  return states;
}

export function createAnimFSM(map, initial = 'idle') {
  const states = normaliseMap(map);
  const stateNames = Object.keys(states);
  if (!stateNames.length) {
    throw new Error('Animation map must contain at least one state.');
  }
  let current = states[initial] ? initial : stateNames[0];
  let time = 0;
  let frameIndex = 0;

  function set(state) {
    if (!states[state] || state === current) return;
    current = state;
    time = 0;
    frameIndex = 0;
  }

  function update(dt) {
    const config = states[current];
    if (!config) return;
    const frames = config.frames;
    if (!frames.length) return;
    const fps = config.fps > 0 ? config.fps : 0;
    if (fps <= 0) {
      frameIndex = 0;
      return;
    }
    const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (!delta) return;
    time += delta;
    const frameDuration = 1 / fps;
    while (time >= frameDuration) {
      time -= frameDuration;
      frameIndex = (frameIndex + 1) % frames.length;
    }
  }

  function frame() {
    const config = states[current];
    if (!config || !config.frames.length) return null;
    return config.frames[Math.min(frameIndex, config.frames.length - 1)];
  }

  function state() {
    return current;
  }

  return { set, update, frame, state };
}

export default createAnimFSM;
