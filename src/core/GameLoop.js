import * as THREE from "three";

export class GameLoop {
  constructor({ autoStart = false } = {}) {
    this.clock = new THREE.Clock();
    this.callbacks = new Set();
    this.performance = {
      fps: 0,
      frameTimeMs: 0,
      averageFrameTimeMs: 0,
      worstFrameMs: 0,
    };
    this._running = false;
    this._elapsedSeconds = 0;
    this._frameCount = 0;
    this._perfLastTimestamp = null;
    this._perfWorstFrameMs = 0;
    this._boundLoop = this._loop.bind(this);

    if (autoStart) {
      this.start();
    }
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  onUpdate(callback) {
    if (typeof callback !== "function") return () => {};
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  getPerformanceMetrics() {
    return { ...this.performance };
  }

  getElapsedTime() {
    return this._elapsedSeconds;
  }

  advanceTime(ms = 0, fixedStepSeconds = 1 / 60) {
    const durationSeconds = Math.max(0, Number(ms) / 1000 || 0);
    if (durationSeconds <= 0) return;

    const stepSeconds = Math.max(
      1 / 240,
      Number.isFinite(fixedStepSeconds) ? fixedStepSeconds : 1 / 60,
    );
    const wasRunning = this._running;

    if (wasRunning && this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this._running = false;
    }

    let remaining = durationSeconds;
    while (remaining > 1e-8) {
      const delta = Math.min(stepSeconds, remaining);
      this._tick(delta);
      remaining -= delta;
    }

    if (wasRunning) {
      this._running = true;
      this.clock.start();
      this._rafId = requestAnimationFrame(this._boundLoop);
    }
  }

  _loop() {
    if (!this._running) return;

    const delta = this.clock.getDelta();
    this._tick(delta);

    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  _tick(delta) {
    const safeDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this._elapsedSeconds += safeDelta;
    const elapsed = this._elapsedSeconds;

    for (const callback of this.callbacks) {
      try {
        callback(safeDelta, elapsed);
      } catch (error) {
        console.error("[GameLoop] callback error", error);
      }
    }

    this._updatePerformance(safeDelta);
  }

  _updatePerformance(delta) {
    const frameTimeMs = Math.max(0, delta * 1000);
    this.performance.frameTimeMs = frameTimeMs;
    this._perfWorstFrameMs = Math.max(this._perfWorstFrameMs, frameTimeMs);
    this._frameCount += 1;
    const now =
      typeof performance?.now === "function" ? performance.now() : Date.now();
    if (this._perfLastTimestamp === null) {
      this._perfLastTimestamp = now;
      return;
    }

    const elapsedMs = now - this._perfLastTimestamp;
    if (elapsedMs >= 500) {
      const fps = this._frameCount / (elapsedMs / 1000);
      this.performance.fps = fps;
      this.performance.averageFrameTimeMs =
        this._frameCount > 0 ? elapsedMs / this._frameCount : 0;
      this.performance.worstFrameMs = this._perfWorstFrameMs;
      this._frameCount = 0;
      this._perfLastTimestamp = now;
      this._perfWorstFrameMs = 0;
    }
  }
}
