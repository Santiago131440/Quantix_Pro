/**
 * Contenedor de estado observable (patrón similar a Zustand/Redux).
 * Estado global de la UI: sesión, preferencias y estado de interfaz.
 * Los datos de negocio NO viven aquí: se consultan a los servicios.
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    getState: () => state,
    setState(update) {
      const partial = typeof update === 'function' ? update(state) : update;
      const next = { ...state, ...partial };
      if (Object.keys(partial).every((key) => Object.is(state[key], next[key]))) return;
      const previous = state;
      state = next;
      listeners.forEach((listener) => listener(state, previous));
    },
    /** Suscripción con selector opcional: solo notifica si cambia la porción seleccionada. */
    subscribe(listener, selector) {
      const wrapped = selector
        ? (next, previous) => { if (!Object.is(selector(next), selector(previous))) listener(selector(next), next); }
        : listener;
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
  };
}

export const appStore = createStore({
  session: null,        // { user, role, token }
  settings: null,       // configuración del sistema
  sidebarOpen: false,   // menú móvil
});
