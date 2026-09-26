/**
 * Capa de persistencia intercambiable.
 * - createLocalStorageAdapter: navegador (demo)
 * - createMemoryAdapter: pruebas en Node
 * A futuro: los servicios cambian su repositorio por uno HTTP; las vistas no se enteran.
 */
import { StorageError } from './errors.js';

export function createLocalStorageAdapter(namespace = 'inventra') {
  const cache = new Map();
  const fullKey = (key) => `${namespace}:${key}`;

  // Invalida la caché si otra pestaña modifica los datos.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith(`${namespace}:`)) cache.delete(event.key.slice(namespace.length + 1));
    });
  }

  return {
    read(key) {
      if (cache.has(key)) return cache.get(key);
      try {
        const rawValue = localStorage.getItem(fullKey(key));
        const value = rawValue ? JSON.parse(rawValue) : null;
        cache.set(key, value);
        return value;
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(fullKey(key), JSON.stringify(value));
        cache.set(key, value);
      } catch (error) {
        throw new StorageError(error?.name === 'QuotaExceededError'
          ? 'El almacenamiento local está lleno. Exporta un respaldo y restablece los datos.'
          : undefined);
      }
    },
    remove(key) { localStorage.removeItem(fullKey(key)); cache.delete(key); },
    clear() {
      Object.keys(localStorage).filter((key) => key.startsWith(`${namespace}:`)).forEach((key) => localStorage.removeItem(key));
      cache.clear();
    },
  };
}

export function createMemoryAdapter() {
  const data = new Map();
  return {
    read: (key) => (data.has(key) ? data.get(key) : null),
    write: (key, value) => { data.set(key, value); },
    remove: (key) => { data.delete(key); },
    clear: () => data.clear(),
  };
}

let adapter = typeof localStorage !== 'undefined' ? createLocalStorageAdapter() : createMemoryAdapter();

/**
 * API de acceso a colecciones. Las filas se tratan como inmutables:
 * cada escritura reemplaza el arreglo completo (facilita commit atómico y caché).
 */
export const db = {
  use(nextAdapter) { adapter = nextAdapter; },
  get(collection) { return adapter.read(collection) ?? []; },
  set(collection, rows) { adapter.write(collection, rows); },
  getValue(key, fallback = null) { return adapter.read(key) ?? fallback; },
  setValue(key, value) { adapter.write(key, value); },
  clear() { adapter.clear(); },

  /**
   * Escritura atómica de varias colecciones: si alguna falla, se restauran las anteriores.
   * Equivale a una transacción de BD en el backend futuro.
   */
  commit(changes) {
    const snapshot = Object.keys(changes).map((key) => [key, adapter.read(key)]);
    try {
      Object.entries(changes).forEach(([key, value]) => adapter.write(key, value));
    } catch (error) {
      snapshot.forEach(([key, value]) => {
        try { if (value === null) adapter.remove(key); else adapter.write(key, value); } catch { /* sin espacio para revertir */ }
      });
      throw error;
    }
  },
};
