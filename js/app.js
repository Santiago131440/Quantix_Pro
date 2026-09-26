/**
 * Bootstrap de la aplicación.
 * Orden: tema → datos/configuración → sesión → layout → router.
 */
import { initTheme } from './core/theme.js';
import { createRouter } from './core/router.js';
import { appStore } from './core/store.js';
import { bus, EVENTS } from './core/events.js';
import { ROUTES, FORBIDDEN_ROUTE, NOT_FOUND_ROUTE } from './config/routes.js';
import { hasPermission } from './utils/permissions.js';
import { settingsService, authService } from './services/index.js';
import { mountLayout } from './components/layout.js';
import { APP } from './config/constants.js';

const root = document.getElementById('app');
let layout = null;

function ensureLayout(needed) {
  if (needed && !layout) layout = mountLayout(root);
  if (!needed && layout) { layout.destroy(); layout = null; }
}

const router = createRouter({
  routes: ROUTES,
  fallback: NOT_FOUND_ROUTE,
  resolveGuard(route) {
    const { session } = appStore.getState();
    if (route.public) return session ? { redirect: '/dashboard' } : {};
    if (!session) return { redirect: '/login' };
    if (route.permission && !hasPermission(route.permission)) return { route: FORBIDDEN_ROUTE };
    return {};
  },
  onRender(route) {
    const blank = route.layout === 'blank';
    ensureLayout(!blank);
    document.title = `${route.title} · ${APP.name}`;
    const container = blank ? root : layout.content;
    if (!blank) {
      container.classList.remove('view-enter');
      container.innerHTML = '';
      void container.offsetWidth; // reinicia la animación de entrada
      container.classList.add('view-enter');
      window.scrollTo({ top: 0 });
    }
    return { container };
  },
});

function start() {
  initTheme();
  settingsService.init();
  authService.restore();

  bus.on(EVENTS.SESSION_CHANGED, (session) => {
    if (!session) { ensureLayout(false); window.location.hash = '#/login'; }
  });
  // Si cambian roles/usuarios, recalcula permisos de la sesión activa.
  bus.on(EVENTS.DATA_CHANGED, ({ entity }) => { if (['role', 'user', 'all'].includes(entity)) authService.refresh(); });

  router.start();

  // Mueve el foco al título de la vista tras navegar (lectores de pantalla).
  bus.on(EVENTS.ROUTE_CHANGED, () => {
    requestAnimationFrame(() => setTimeout(() => document.querySelector('[data-page-title]')?.focus({ preventScroll: true }), 60));
  });
}

start();
