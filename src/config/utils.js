const PLAIN_OBJECT_TAG = "[object Object]";

export const TRUE_VALUES = new Set(["", "1", "true", "on", "yes", "y"]);
export const FALSE_VALUES = new Set(["0", "false", "off", "no", "n"]);

export function getRuntimeEnvironment() {
  return "unified";
}

export function isPlainObject(value) {
  if (value == null || typeof value !== "object") return false;
  return Object.prototype.toString.call(value) === PLAIN_OBJECT_TAG;
}

export function mergeDeep(target = {}, ...sources) {
  let output = Array.isArray(target)
    ? [...target]
    : isPlainObject(target)
    ? { ...target }
    : target;

  for (const source of sources) {
    if (source == null) continue;
    if (Array.isArray(source)) {
      output = [...source];
      continue;
    }
    if (!isPlainObject(source)) {
      output = source;
      continue;
    }
    if (!isPlainObject(output)) {
      output = {};
    }
    for (const [key, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        output[key] = [...value];
        continue;
      }
      if (isPlainObject(value)) {
        output[key] = mergeDeep(output[key] ?? {}, value);
        continue;
      }
      output[key] = value;
    }
  }

  return output;
}

export function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      deepFreeze(v);
    }
    return Object.freeze(value);
  }
  return value;
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function ensureArrayOfStrings(value, { allowEmpty = true, label = "value" } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  const result = [];
  for (const entry of value) {
    assert(typeof entry === "string", `${label} must contain only strings`);
    const trimmed = entry.trim();
    if (!trimmed && !allowEmpty) {
      continue;
    }
    result.push(trimmed);
  }
  if (!allowEmpty) {
    assert(result.length > 0, `${label} must not be empty`);
  }
  return result;
}

export function parseToggleValue(value, defaultValue = true) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}
