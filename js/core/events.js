/** Bus de eventos mínimo (pub/sub). En React se reemplaza por contexto/queries invalidation. */
export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((handler) => {
        try { handler(payload); } catch (error) { console.error(`[bus:${event}]`, error); }
      });
    },
    clear() { listeners.clear(); },
  };
}

export const bus = createEventBus();

export const EVENTS = Object.freeze({
  DATA_CHANGED: 'data:changed',
  SESSION_CHANGED: 'session:changed',
  ROUTE_CHANGED: 'route:changed',
  SETTINGS_CHANGED: 'settings:changed',
});
