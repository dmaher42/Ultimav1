import * as THREE from "three";
import { resolveBaseUrl, joinPath } from "../utils/baseUrl.js";

// Simple noise buffer for placeholder ambience when assets are missing
function createNoiseBuffer(context, { duration = 1, amplitude = 0.12 } = {}) {
  const sampleRate = context.sampleRate || 44100;
  const length = Math.max(1, Math.floor(duration * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return buffer;
}

class ZoneAmbienceManager {
  constructor(listener, loadBuffer, busNode) {
    this.listener = listener;
    this.loadBuffer = loadBuffer;
    this.busNode = busNode;
    this.tracks = new Map();
    this.trackConfigs = new Map();
    this.loading = new Map();
  }

  registerTrack(key, config) {
    this.trackConfigs.set(key, config || {});
  }

  async _prepareTrack(key) {
    if (this.tracks.has(key)) return this.tracks.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const config = this.trackConfigs.get(key) || {};
    const ctx = this.listener.context;
    const promise = (async () => {
      let buffer = null;
      if (config.url) {
        buffer = await this.loadBuffer(key, config.url);
      }
      if (!buffer) {
        buffer = createNoiseBuffer(ctx, config.noiseOptions);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      let outputNode = source;
      if (config.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = config.filter.type || "lowpass";
        if (config.filter.frequency) {
          filter.frequency.value = config.filter.frequency;
        }
        outputNode.connect(filter);
        outputNode = filter;
      }
      const gain = ctx.createGain();
      gain.gain.value = 0;
      outputNode.connect(gain);
      gain.connect(this.busNode);
      source.start();
      const track = {
        key,
        source,
        gain,
        targetVolume: 0,
      };
      this.tracks.set(key, track);
      this.loading.delete(key);
      return track;
    })();
    this.loading.set(key, promise);
    return promise;
  }

  async setActiveZones(activeKeys) {
    const activeSet = new Set(activeKeys);
    await Promise.all(Array.from(activeSet).map((key) => this._prepareTrack(key)));
    for (const track of this.tracks.values()) {
      track.targetVolume = activeSet.has(track.key) ? 0.55 : 0;
    }
  }

  updateFades(fadeRate = 0.08) {
    for (const track of this.tracks.values()) {
      const current = track.gain.gain.value;
      const next = current + (track.targetVolume - current) * fadeRate;
      track.gain.gain.value = next;
    }
  }

  dispose() {
    for (const track of this.tracks.values()) {
      try { track.source.stop(); } catch {}
      try { track.source.disconnect(); } catch {}
      try { track.gain.disconnect(); } catch {}
    }
    this.tracks.clear();
    this.loading.clear();
  }
}

// Ensure we always work with strings; accept object forms like { url: "..." }
function ensureUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return "";
}

let manifestWarningLogged = false;

/**
 * Living City Soundscape
 * - Global ambient loops (sea/wind)
 * - Zone ambience (harbor/agora/acropolis) with positional audio
 * - Randomized one-shots (goats, cart, blacksmith)
 * - Day/Night mix (more wind/lyre at night, more market by day)
 * - Graceful missing-asset handling (logs tip, continues)
 */
export class Soundscape {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {Object} lightingRef returns 0..1 (0=day,1=night)
   * @param {function()} lightingRef.getNightFactor
   * @param {Object} anchors
   * @param {THREE.Vector3} anchors.harbor
   * @param {THREE.Vector3} anchors.agora
   * @param {THREE.Vector3} anchors.acropolis
   */
  constructor(scene, camera, lightingRef, anchors) {
    this.scene = scene;
    this.camera = camera;
    this.lightingRef = lightingRef;
    this.anchors = anchors;

    // Audio graph (initialized immediately in suspended state)
    this.listener = null;
    this.loader = null;
    this.masterGain = null;
    this.bus = null;
    this._audioInitialized = false;
    this._zoneTrackConfigs = new Map();

    // State
    this.buffers = new Map();
    this.emitters = [];
    this.oneShotTimers = [];
    this.pendingSources = new Set();
    this.ready = false;
    this.manifestLoaded = false;
    this._manifest = null;
    this.zoneAmbience = null;
    this._activeZoneSignature = "";
    const BASE = resolveBaseUrl();
    this._registerZoneTrack("harbor", {
      label: "Ocean Waves",
      url: joinPath(BASE, "audio/ocean_waves.mp3"),
      noiseOptions: { duration: 2, amplitude: 0.08 },
      filter: { type: "lowpass", frequency: 600 },
    });
    this._registerZoneTrack("city", {
      label: "Crowd Murmur",
      url: joinPath(BASE, "audio/ambient_sea.ogg"),
      noiseOptions: { duration: 2, amplitude: 0.06 },
      filter: { type: "bandpass", frequency: 450 },
    });
    this._registerZoneTrack("wind", {
      label: "Wind",
      // url: joinPath(BASE, "audio/wind.mp3"), // Asset missing, use procedural fallback
      noiseOptions: { duration: 2, amplitude: 0.05 },
      filter: { type: "highpass", frequency: 300 },
    });

    // Zones
    this.zones = {
      harbor: { pos: anchors.harbor, radius: 50 },
      agora: { pos: anchors.agora, radius: 40 },
      acropolis: { pos: anchors.acropolis, radius: 40 }
    };

    this.mode = null;

    // Initialize graph immediately so UI can bind to it
    this._initAudioGraph();
  }

  _registerZoneTrack(key, config) {
    this._zoneTrackConfigs.set(key, config || {});
    if (this.zoneAmbience) {
      this.zoneAmbience.registerTrack(key, config || {});
    }
  }

  _initAudioGraph() {
    if (this._audioInitialized) return;
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.loader = new THREE.AudioLoader();

    const ctx = this.listener.context;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.9;
    this.masterGain.connect(this.listener.getInput());

    this.bus = {
      ambience: ctx.createGain(),
      voices: ctx.createGain(),
      effects: ctx.createGain()
    };
    this.bus.ambience.gain.value = 0.9;
    this.bus.voices.gain.value = 0.7;
    this.bus.effects.gain.value = 0.7;
    this.bus.ambience.connect(this.masterGain);
    this.bus.voices.connect(this.masterGain);
    this.bus.effects.connect(this.masterGain);

    this.zoneAmbience = new ZoneAmbienceManager(
      this.listener,
      (name, url) => this.loadBuffer(name, url),
      this.bus.ambience,
    );
    for (const [key, config] of this._zoneTrackConfigs.entries()) {
      this.zoneAmbience.registerTrack(key, config);
    }
    this._audioInitialized = true;
  }

  _safePlay(source) {
    if (!source) return;
    if (!this.listener) return;
    if (this.listener.context.state === "running") {
      source.play();
    } else {
      this.pendingSources.add(source);
    }
  }

  logMissing(name, url) {
    const hint = url && !/^(?:[a-z]+:)?\/\//i.test(url) ? `public/${url}` : url;
    console.info(`[audio] Optional asset missing: ${name} (${url}). Drop a file at ${hint} to enable.`);
  }

  async loadBuffer(name, url) {
    if (!url) return null;
    if (!this.loader) return null;
    // Skip problematic audio file to prevent console errors
    if (name === "agora" || url.includes("ambience_agora.mp3")) {
      return null;
    }
    const existing = this.buffers.get(name);
    if (existing) return existing;
    try {
      const buf = await new Promise((resolve, reject) =>
        this.loader.load(url, resolve, undefined, reject)
      );
      this.buffers.set(name, buf);
      return buf;
    } catch {
      // User request: disable track without crashing or excessive spam
      // logMissing is already non-intrusive (console.info)
      this.logMissing(name, url);
      return null;
    }
  }

  _makePositional(buffer, position, group = "ambience", { loop = true, volume = 0.6, refDistance = 12, maxDistance = 80, rolloff = 1 } = {}) {
    if (!buffer || !this.listener) return null;
    const src = new THREE.PositionalAudio(this.listener);
    src.setBuffer(buffer);
    src.setLoop(loop);
    src.setRefDistance(refDistance);
    src.setMaxDistance(maxDistance);
    src.setRolloffFactor(rolloff);
    src.setVolume(volume);
    src.userData.group = group;
    // route into group bus
    const sourceNode = src.getOutput ? src.getOutput() : src.source; // compat across three versions
    if (sourceNode && this.bus[group]) {
      // reroute output: disconnect default → connect to our bus
      try { sourceNode.disconnect(); } catch {}
      sourceNode.connect(this.bus[group]);
    }
    const obj = new THREE.Object3D();
    obj.position.copy(position);
    obj.add(src);
    this.scene.add(obj);
    const entry = { obj, src, group };
    this.emitters.push(entry);
    if (!loop) {
      this._attachOneShotCleanup(entry);
    }
    return src;
  }

  _makeGlobal(buffer, group = "ambience", { loop = true, volume = 0.3 } = {}) {
    if (!buffer || !this.listener) return null;
    const src = new THREE.Audio(this.listener);
    src.setBuffer(buffer);
    src.setLoop(loop);
    src.setVolume(volume);
    src.userData.group = group;
    const sourceNode = src.getOutput ? src.getOutput() : src.source;
    if (sourceNode && this.bus[group]) {
      try { sourceNode.disconnect(); } catch {}
      sourceNode.connect(this.bus[group]);
    }
    const entry = { obj: this.camera, src, group };
    this.emitters.push(entry);
    if (!loop) {
      this._attachOneShotCleanup(entry);
    }
    return src;
  }

  _normalizeManifestSchema(rawManifest) {
    if (!rawManifest || typeof rawManifest !== "object" || Array.isArray(rawManifest)) {
      return rawManifest;
    }

    if (rawManifest?.categories && typeof rawManifest.categories === "object") {
      return rawManifest;
    }

    const { ambient, effects } = rawManifest;
    const isLegacyAmbient = ambient && typeof ambient === "object" && !Array.isArray(ambient);
    const isLegacyEffects = effects && typeof effects === "object" && !Array.isArray(effects);

    if (!isLegacyAmbient && !isLegacyEffects) {
      return rawManifest;
    }

    const cloneEntry = (id, value) => {
      if (value == null) return null;
      if (typeof value === "string") {
        return { id, file: value };
      }
      if (typeof value === "object") {
        const file = value.file ?? value.url ?? value.path;
        if (!file) return null;
        const entry = { id, file };
        const extraKeys = ["loop", "volume", "group", "refDistance", "maxDistance", "rolloff"];
        for (const key of extraKeys) {
          if (value[key] !== undefined) {
            entry[key] = value[key];
          }
        }
        return entry;
      }
      return null;
    };

    const toArray = (records) => {
      if (!records || typeof records !== "object") return [];
      const entries = [];
      for (const [id, value] of Object.entries(records)) {
        const normalized = cloneEntry(id, value);
        if (normalized) {
          entries.push(normalized);
        }
      }
      return entries;
    };

    return {
      version: 1,
      categories: {
        ambience: toArray(ambient),
        fx: toArray(effects),
      },
    };
  }

  async loadManifest() {
    if (this.manifestLoaded) {
      return this._manifest;
    }

    const BASE = resolveBaseUrl();
    const manifestUrl = joinPath(BASE, "audio/manifest.json");

    try {
      const response = await fetch(manifestUrl, {
        method: "GET",
        cache: "no-cache",
      });
      if (!response.ok) {
        if (!manifestWarningLogged) {
          console.warn(`[audio] manifest missing: ${manifestUrl}`);
          manifestWarningLogged = true;
        }
        this.manifestLoaded = true;
        this._manifest = null;
        return null;
      }

      const manifest = await response.json();
      this._manifest = this._normalizeManifestSchema(manifest);
      this.manifestLoaded = true;
      console.log("[audio] manifest loaded:", manifestUrl);
      return this._manifest;
    } catch (err) {
      if (!manifestWarningLogged) {
        console.warn(`[audio] manifest fetch error: ${manifestUrl}`, err);
        manifestWarningLogged = true;
      }
      this.manifestLoaded = true;
      this._manifest = null;
      return null;
    }
  }

  async _initFromCategorizedManifest(categories, toUrl) {
    const ambience = Array.isArray(categories?.ambience)
      ? categories.ambience.filter((entry) => entry && entry.file)
      : [];
    for (const [index, entry] of ambience.entries()) {
      const key = entry?.id || entry?.file || `ambience-${index}`;
      const buffer = await this.loadBuffer(key, toUrl(entry?.file));
      if (!buffer) continue;
      const opts = {
        loop: entry.loop !== false,
        volume: entry.volume ?? 0.35,
        refDistance: entry.refDistance ?? 12,
        maxDistance: entry.maxDistance ?? 80,
        rolloff: entry.rolloff ?? 1,
      };
      const zone = entry?.id && this.zones?.[entry.id];
      const target = zone?.pos;
      if (target) {
        this._safePlay(this._makePositional(buffer, target, entry.group || "ambience", opts));
      } else {
        this._safePlay(this._makeGlobal(buffer, entry.group || "ambience", opts));
      }
    }

    const fx = Array.isArray(categories?.fx)
      ? categories.fx.filter((entry) => entry && entry.file)
      : [];
    for (const [index, entry] of fx.entries()) {
      const key = entry?.id || entry?.file || `fx-${index}`;
      await this.loadBuffer(key, toUrl(entry?.file));
    }

    if (!ambience.length && !fx.length) {
      console.info("[audio] running silently (no categorized entries).");
    } else {
      console.info("[audio] manifest loaded.", {
        ambience: ambience.length,
        fx: fx.length,
      });
    }
  }

  async initFromManifest() {
    const BASE = resolveBaseUrl();
    const audioBase = joinPath(BASE, "audio");
    const manifest = await this.loadManifest();
    if (!manifest) {
      this.ready = true;
      return;
    }

    const toUrl = (file) => {
      const raw = ensureUrl(file) || (file != null ? String(file) : "");
      if (!raw) return "";
      if (/^(?:[a-z]+:)?\/\//i.test(raw)) {
        return raw;
      }
      return joinPath(audioBase, raw);
    };

    const mf = manifest ?? { ambient: {}, effects: {} };

    if (mf?.categories) {
      await this._initFromCategorizedManifest(mf.categories, toUrl);
      this.ready = true;
      return;
    }

    const ambient = mf.ambient ?? {};
    const effects = mf.effects ?? {};

    // Ambient layers
    const sea = await this.loadBuffer("sea", toUrl(ambient.sea));
    const gulls = await this.loadBuffer("gulls", toUrl(ambient.gulls));
    const wind = await this.loadBuffer("wind", toUrl(ambient.wind));
    const market = await this.loadBuffer("market", toUrl(ambient.market));
    const fountain = await this.loadBuffer("fountain", toUrl(ambient.fountain));
    const lyre = await this.loadBuffer("lyre", toUrl(ambient.lyre));

    // Effects / one-shots
    const blacksmith = await this.loadBuffer("blacksmith", toUrl(effects.blacksmith));
    const goats = await this.loadBuffer("goats", toUrl(effects.goats));
    const cart = await this.loadBuffer("cart", toUrl(effects.cart));

    // Global ambient: sea + wind (wind mixed more at night)
    this._safePlay(this._makeGlobal(sea, "ambience", { volume: 0.25 }));
    this._safePlay(this._makeGlobal(wind, "ambience", { volume: 0.05 }));

    // Zones: harbor, agora, acropolis
    this._safePlay(this._makePositional(gulls, this.zones.harbor.pos, "ambience", { volume: 0.35, refDistance: 16, maxDistance: 120 }));
    this._safePlay(this._makePositional(market, this.zones.agora.pos, "voices", { volume: 0.35, refDistance: 10 }));
    this._safePlay(this._makePositional(fountain, this.zones.agora.pos.clone().add(new THREE.Vector3(6,0,-4)), "ambience", { volume: 0.25, refDistance: 8 }));
    this._safePlay(this._makePositional(lyre, this.zones.acropolis.pos, "ambience", { volume: 0.22, refDistance: 10 }));

    // One-shots with randomized scheduling
    this.scheduleOneShots(blacksmith, this.zones.agora.pos.clone().add(new THREE.Vector3(-8,0,6)), "effects", 12, 22); // every 12–22s
    this.scheduleOneShots(goats, this.zones.harbor.pos.clone().add(new THREE.Vector3(18,0,10)), "effects", 18, 38);
    this.scheduleOneShots(cart, this.zones.agora.pos.clone().add(new THREE.Vector3(12,0,-12)), "effects", 25, 45);

    this.ready = true;
  }

  scheduleOneShots(buffer, position, group, minS = 12, maxS = 24) {
    if (!buffer) return;
    const scheduleTick = (delay) => {
      const id = setTimeout(() => {
        this._removeOneShotTimer(id);
        const src = this._makePositional(buffer, position, group, { loop: false, volume: 0.35, refDistance: 8 });
        if (src) { src.play(); }
        const next = (Math.random() * (maxS - minS) + minS) * 1000;
        scheduleTick(next);
      }, delay);
      this.oneShotTimers.push(id);
    };
    const first = (Math.random() * (maxS - minS) + minS) * 1000;
    scheduleTick(first);
  }

  /**
   * Call once per frame
   * @param {THREE.Vector3} playerPos  (optional, for future distance-based mixing)
   */
  update(playerPos) {
    if (!this.ready || !this.bus) return;
    const nightPreference = this.mode === "night" ? 1 : this.mode === "day" ? 0 : null;
    const night =
      nightPreference ?? (this.lightingRef?.getNightFactor?.() ?? 0);
    // Day/Night crossfade: more market by day, more wind/lyre by night
    const lerp = (a,b,t)=> a+(b-a)*t;
    this.bus.voices.gain.value = lerp(0.75, 0.35, night);
    this.bus.ambience.gain.value = lerp(0.85, 0.95, night);
    // Master stays ~0.9; optionally lower late night:
    this.masterGain.gain.value = lerp(0.9, 0.8, night);
    this._updateZoneAmbience(playerPos);
  }

  setMode(mode) {
    if (mode === "day" || mode === "night") {
      this.mode = mode;
    } else {
      this.mode = null;
    }
  }

  _updateZoneAmbience(playerPos) {
    if (!playerPos || !this.zoneAmbience) return;
    const activeZones = [];
    if (playerPos.z > 50) {
      activeZones.push("harbor");
    } else {
      activeZones.push("city");
    }
    if (playerPos.y > 15) {
      activeZones.push("wind");
    }
    const activeZoneSignature = activeZones.join("|");
    if (activeZoneSignature !== this._activeZoneSignature) {
      this._activeZoneSignature = activeZoneSignature;
      this.zoneAmbience.setActiveZones(activeZones).catch(() => {});
    }
    this.zoneAmbience.updateFades();
  }

  async ensureUserGestureResume() {
    const resume = async () => {
      if (!this._audioInitialized) {
        this._initAudioGraph();
      }
      const ctx = this.listener?.context;
      if (ctx && ctx.state !== "running") {
        try { await ctx.resume(); } catch {}
      }
      if (!this.ready) {
        try {
          await this.initFromManifest();
        } catch {}
      }
      // Play pending
      for (const src of this.pendingSources) {
        try {
          if (src && src.play) src.play();
        } catch {}
      }
      this.pendingSources.clear();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      window.removeEventListener("touchstart", resume);
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    window.addEventListener("touchstart", resume, { once: true });
  }

  dispose() {
    this.emitters.forEach(({ obj, src }) => {
      try { src.stop(); } catch {}
      if (obj && obj !== this.camera) { this.scene.remove(obj); }
    });
    this.oneShotTimers.forEach(id => clearTimeout(id));
    this.emitters = [];
    this.buffers.clear();
    if (this.zoneAmbience) {
      this.zoneAmbience.dispose();
    }
    // detach listener
    try { this.camera.remove(this.listener); } catch {}
  }

  _attachOneShotCleanup(entry) {
    const { obj, src } = entry;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (obj && obj !== this.camera) {
        this.scene.remove(obj);
      }
      const idx = this.emitters.indexOf(entry);
      if (idx !== -1) {
        this.emitters.splice(idx, 1);
      }
    };
    const originalOnEnded = src.onEnded ? src.onEnded.bind(src) : null;
    src.onEnded = () => {
      if (originalOnEnded) {
        originalOnEnded();
      }
      cleanup();
    };
  }

  _removeOneShotTimer(id) {
    const idx = this.oneShotTimers.indexOf(id);
    if (idx !== -1) {
      this.oneShotTimers.splice(idx, 1);
    }
  }
}
