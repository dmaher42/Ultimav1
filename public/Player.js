function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function smoothStep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export default class Player {
  constructor(character) {
    this.character = character;
    this.position = { x: 0, y: 0 };
    this.map = null;
    this.facing = 'south';
    this.motion = null;
  }

  setMap(map, spawnTag) {
    this.map = map;
    const spawn = map.getSpawn(spawnTag);
    this.position = { x: spawn.x, y: spawn.y };
    this.cancelMotion();
  }

  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    this.cancelMotion();
  }

  face(directionOrDx, dy = 0) {
    if (typeof directionOrDx === 'string') {
      if (['north', 'south', 'east', 'west'].includes(directionOrDx)) {
        this.facing = directionOrDx;
        return true;
      }
      return false;
    }

    const dx = Number(directionOrDx) || 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) this.facing = 'east';
      if (dx < 0) this.facing = 'west';
    } else {
      if (dy > 0) this.facing = 'south';
      if (dy < 0) this.facing = 'north';
    }
    return dx !== 0 || dy !== 0;
  }

  move(dx, dy, { durationMs = 0, timestamp = nowMs() } = {}) {
    if (!this.map) return false;
    this.face(dx, dy);

    const newX = this.position.x + dx;
    const newY = this.position.y + dy;
    if (!this.map.isWalkable(newX, newY)) {
      return false;
    }

    const from = this.getRenderPosition(timestamp);
    this.position.x = newX;
    this.position.y = newY;

    if (durationMs > 0) {
      this.motion = {
        fromX: from.x,
        fromY: from.y,
        toX: newX,
        toY: newY,
        startedAt: timestamp,
        durationMs: Math.max(1, durationMs)
      };
    } else {
      this.cancelMotion();
    }
    return true;
  }

  getMovementProgress(timestamp = nowMs()) {
    if (!this.motion) return 1;
    const elapsed = timestamp - this.motion.startedAt;
    return Math.min(1, Math.max(0, elapsed / this.motion.durationMs));
  }

  getRenderPosition(timestamp = nowMs()) {
    if (!this.motion) return { x: this.position.x, y: this.position.y };

    const rawProgress = this.getMovementProgress(timestamp);
    if (rawProgress >= 1) {
      this.motion = null;
      return { x: this.position.x, y: this.position.y };
    }

    const progress = smoothStep(rawProgress);
    return {
      x: this.motion.fromX + (this.motion.toX - this.motion.fromX) * progress,
      y: this.motion.fromY + (this.motion.toY - this.motion.fromY) * progress
    };
  }

  isVisuallyMoving(timestamp = nowMs()) {
    if (!this.motion) return false;
    if (this.getMovementProgress(timestamp) >= 1) {
      this.motion = null;
      return false;
    }
    return true;
  }

  cancelMotion() {
    this.motion = null;
  }

  look(dx, dy) {
    return {
      x: this.position.x + dx,
      y: this.position.y + dy
    };
  }
}
