import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Node >= 22 ships a native global localStorage that is unusable without
// --localstorage-file and shadows jsdom's implementation; replace both
// storages with an in-memory one so tests behave the same on every Node.
class MemoryStorage {
  #map = new Map();
  get length() {
    return this.#map.size;
  }
  key(index) {
    return [...this.#map.keys()][index] ?? null;
  }
  getItem(key) {
    const k = String(key);
    return this.#map.has(k) ? this.#map.get(k) : null;
  }
  setItem(key, value) {
    this.#map.set(String(key), String(value));
  }
  removeItem(key) {
    this.#map.delete(String(key));
  }
  clear() {
    this.#map.clear();
  }
}

for (const storage of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, storage, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true
  });
}

// Mock fetch for template loading
global.fetch = vi.fn();
