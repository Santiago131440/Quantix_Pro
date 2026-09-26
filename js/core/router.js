/**
 * Router por hash con carga diferida de vistas (equivalente a React Router + React.lazy).
 * Contrato de vista: export default { mount(container, ctx) => cleanup? }
 */
import { parseHash } from '../utils/dom.js';
import { bus, EVENTS } from './events.js';

export function createRouter({ routes, resolveGuard, onRender, fallback }) {
  let cleanup = null;
  let navigationId = 0;

  async function handle() {
    const current = ++navigationId;
    const { path, query } = parseHash();
    const route = routes.find((item) => item.path === path) || fallback;
    const guard = resolveGuard(route);
    if (guard.redirect) { window.location.replace(`#${guard.redirect}`); return; }

    if (typeof cleanup === 'function') cleanup();
    cleanup = null;

    const target = guard.route || route;
    const { container } = onRender(target, { path, query });
    bus.emit(EVENTS.ROUTE_CHANGED, { route: target, path, query });

    try {
      const module = await target.load();
      if (current !== navigationId) return; // hubo otra navegación mientras cargaba
      cleanup = await module.default.mount(container, { path, query, route: target });
    } catch (error) {
      console.error('[router]', error);
      container.innerHTML = '<div class="state state--error" role="alert"><h2>No se pudo cargar la vista</h2><p>Recarga la página para intentarlo de nuevo.</p></div>';
    }
  }

  return {
    start() { window.addEventListener('hashchange', handle); handle(); },
    refresh: handle,
    stop() { window.removeEventListener('hashchange', handle); if (typeof cleanup === 'function') cleanup(); },
  };
}
