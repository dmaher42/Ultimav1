export const DEFAULT_MOVEMENT_TIMING = Object.freeze({
  stepDurationMs: 118,
  initialRepeatDelayMs: 185,
  repeatIntervalMs: 116,
  minimumStepGapMs: 92,
  blockedRepeatIntervalMs: 150,
  inputBufferMs: 190
});

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function normaliseKey(key) {
  return String(key || '').toLowerCase();
}

function createFrameRequest() {
  if (typeof requestAnimationFrame === 'function') {
    return (callback) => requestAnimationFrame(callback);
  }
  return (callback) => setTimeout(() => callback(nowMs()), 16);
}

function createFrameCancel() {
  if (typeof cancelAnimationFrame === 'function') {
    return (handle) => cancelAnimationFrame(handle);
  }
  return (handle) => clearTimeout(handle);
}

/**
 * Deterministic tile-movement input.
 *
 * Browser key-repeat speed varies between computers. This controller performs
 * the first step immediately, then owns the repeat cadence, recent-direction
 * priority, and a short one-step input buffer for responsive turns.
 */
export default class MovementController {
  constructor({
    keyToDirection,
    attemptStep,
    canMove = () => true,
    onIntentChange = () => {},
    onIdle = () => {},
    timing = {},
    clock = nowMs,
    requestFrame = createFrameRequest(),
    cancelFrame = createFrameCancel()
  } = {}) {
    if (!keyToDirection || typeof keyToDirection !== 'object') {
      throw new Error('MovementController requires a keyToDirection map.');
    }
    if (typeof attemptStep !== 'function') {
      throw new Error('MovementController requires an attemptStep callback.');
    }

    this.keyToDirection = { ...keyToDirection };
    this.attemptStep = attemptStep;
    this.canMove = canMove;
    this.onIntentChange = onIntentChange;
    this.onIdle = onIdle;
    this.timing = { ...DEFAULT_MOVEMENT_TIMING, ...timing };
    this.clock = clock;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;

    this.pressedKeys = new Map();
    this.directionSequence = new Map();
    this.sequence = 0;
    this.lastStepAt = -Infinity;
    this.nextRepeatAt = Infinity;
    this.bufferedDirection = null;
    this.bufferDueAt = Infinity;
    this.bufferExpiresAt = -Infinity;
    this.frameHandle = null;
    this.lastActiveDirection = null;

    this.tick = this.tick.bind(this);
  }

  handleKeyDown(key, { repeated = false } = {}) {
    const normalizedKey = normaliseKey(key);
    const direction = this.keyToDirection[normalizedKey];
    if (!direction) return false;

    // Native keyboard repeat is intentionally ignored; cadence is controlled
    // here so movement feels the same on a Chromebook and a desktop PC.
    if (repeated || this.pressedKeys.has(normalizedKey)) return true;

    const alreadyHeld = this.isDirectionHeld(direction);
    this.pressedKeys.set(normalizedKey, direction);
    this.sequence += 1;
    this.directionSequence.set(direction, this.sequence);
    if (!alreadyHeld) this.onIntentChange(direction, true);

    const now = this.clock();
    this.lastActiveDirection = direction;
    this.queueOrStep(direction, now, 'press');
    this.ensureLoop();
    return true;
  }

  handleKeyUp(key) {
    const normalizedKey = normaliseKey(key);
    const direction = this.pressedKeys.get(normalizedKey) || this.keyToDirection[normalizedKey];
    if (!direction) return false;

    const previousActive = this.getActiveDirection();
    this.pressedKeys.delete(normalizedKey);
    if (!this.isDirectionHeld(direction)) {
      this.directionSequence.delete(direction);
      this.onIntentChange(direction, false);
    }

    const active = this.getActiveDirection();
    if (active && active !== previousActive) {
      this.lastActiveDirection = active;
      this.queueOrStep(active, this.clock(), 'fallback');
    }

    if (!active && !this.bufferedDirection) {
      this.nextRepeatAt = Infinity;
      this.lastActiveDirection = null;
      this.onIdle();
      this.stopLoop();
    } else {
      this.ensureLoop();
    }
    return true;
  }

  isDirectionHeld(direction) {
    for (const heldDirection of this.pressedKeys.values()) {
      if (heldDirection === direction) return true;
    }
    return false;
  }

  getActiveDirection() {
    let selected = null;
    let selectedSequence = -Infinity;
    for (const direction of new Set(this.pressedKeys.values())) {
      const sequence = this.directionSequence.get(direction) || 0;
      if (sequence > selectedSequence) {
        selected = direction;
        selectedSequence = sequence;
      }
    }
    return selected;
  }

  queueOrStep(direction, now, source) {
    const earliest = this.lastStepAt + this.timing.minimumStepGapMs;
    if (now >= earliest && this.canMove()) {
      this.performStep(direction, now, source);
      return;
    }

    this.bufferedDirection = direction;
    this.bufferDueAt = Math.max(now, earliest);
    this.bufferExpiresAt = now + this.timing.inputBufferMs;
    this.nextRepeatAt = Math.min(this.nextRepeatAt, this.bufferDueAt);
  }

  performStep(direction, now, source) {
    if (!direction || !this.canMove()) return null;

    const result = this.attemptStep(direction, {
      durationMs: this.timing.stepDurationMs,
      source
    }) || { moved: false };

    if (result.moved || result.transitioned) {
      this.lastStepAt = now;
      if (result.transitioned) {
        this.reset();
        return result;
      }
      this.nextRepeatAt = now + (
        source === 'press'
          ? this.timing.initialRepeatDelayMs
          : this.timing.repeatIntervalMs
      );
    } else {
      this.nextRepeatAt = now + this.timing.blockedRepeatIntervalMs;
    }

    return result;
  }

  tick(timestamp) {
    this.frameHandle = null;
    const now = Number.isFinite(timestamp) ? timestamp : this.clock();

    if (this.bufferedDirection) {
      if (now > this.bufferExpiresAt) {
        this.clearBuffer();
      } else if (now >= this.bufferDueAt && this.canMove()) {
        const direction = this.bufferedDirection;
        this.clearBuffer();
        this.performStep(direction, now, 'buffered');
      }
    }

    const active = this.getActiveDirection();
    if (!this.bufferedDirection && active && now >= this.nextRepeatAt && this.canMove()) {
      this.lastActiveDirection = active;
      this.performStep(active, now, 'repeat');
    }

    if (this.bufferedDirection || active) {
      this.ensureLoop();
    } else {
      this.nextRepeatAt = Infinity;
      this.lastActiveDirection = null;
      this.onIdle();
    }
  }

  clearBuffer() {
    this.bufferedDirection = null;
    this.bufferDueAt = Infinity;
    this.bufferExpiresAt = -Infinity;
  }

  ensureLoop() {
    if (this.frameHandle != null) return;
    this.frameHandle = this.requestFrame(this.tick);
  }

  stopLoop() {
    if (this.frameHandle == null) return;
    this.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  reset() {
    const heldDirections = new Set(this.pressedKeys.values());
    heldDirections.forEach((direction) => this.onIntentChange(direction, false));
    this.pressedKeys.clear();
    this.directionSequence.clear();
    this.clearBuffer();
    this.nextRepeatAt = Infinity;
    this.lastActiveDirection = null;
    this.stopLoop();
    this.onIdle();
  }

  getState() {
    return {
      activeDirection: this.getActiveDirection(),
      pressedKeys: Array.from(this.pressedKeys.keys()),
      bufferedDirection: this.bufferedDirection,
      lastStepAt: this.lastStepAt,
      nextRepeatAt: this.nextRepeatAt,
      timing: { ...this.timing }
    };
  }
}
