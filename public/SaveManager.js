const STORAGE_KEY = 'britannia-reborn-save';

function hasLocalStorage() {
  try {
    const testKey = '__test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('LocalStorage not available', error);
    return false;
  }
}

export default class SaveManager {
  static save(data) {
    if (!hasLocalStorage()) return false;
    try {
      const payload = {
        ...data,
        timestamp: Date.now()
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error('Failed to save game', error);
      return false;
    }
  }

  static load() {
    if (!hasLocalStorage()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Failed to load save data', error);
      return null;
    }
  }

  static clear() {
    if (!hasLocalStorage()) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear save data', error);
    }
  }
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return 'No saves yet.';
  const date = new Date(timestamp);
  return `Last saved ${date.toLocaleString()}`;
}
