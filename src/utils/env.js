// src/utils/env.js
// Environment detection utilities

/**
 * Check if running in development mode
 * True during local dev, false in production builds
 */
export const IS_DEV = 
  (typeof import.meta !== "undefined" && import.meta.env?.DEV === true) ||
  (typeof process !== "undefined" && process.env?.NODE_ENV === "development") ||
  false;

/**
 * Conditional logging for development only
 * Usage: devLog('[Component]', 'message', data)
 */
export function devLog(...args) {
  if (IS_DEV && typeof console !== "undefined") {
    console.log(...args);
  }
}

/**
 * Conditional warning for development only
 */
export function devWarn(...args) {
  if (IS_DEV && typeof console !== "undefined") {
    console.warn(...args);
  }
}

/**
 * Conditional error logging (always shows in dev, optional in prod)
 */
export function devError(...args) {
  if (IS_DEV && typeof console !== "undefined") {
    console.error(...args);
  }
}
