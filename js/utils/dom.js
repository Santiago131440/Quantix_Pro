export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Event delegation: un solo listener por contenedor. Devuelve la función para removerlo. */
export function delegate(root, eventName, selector, handler, options) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(eventName, listener, options);
  return () => root.removeEventListener(eventName, listener, options);
}

export function debounce(fn, wait = 200) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Espera al final de una animación/transición (con timeout de seguridad). */
export function afterAnimation(element, fallbackMs = 320) {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) { resolve(); return; }
    const done = () => { clearTimeout(timer); element.removeEventListener('animationend', done); resolve(); };
    const timer = setTimeout(done, fallbackMs);
    element.addEventListener('animationend', done, { once: true });
  });
}

/** Parsea `#/ruta?x=1` → { path, query } */
export function parseHash(hash = window.location.hash) {
  const clean = hash.replace(/^#/, '') || '/dashboard';
  const [path, search = ''] = clean.split('?');
  return { path: path || '/dashboard', query: Object.fromEntries(new URLSearchParams(search)) };
}

export function navigate(path, query) {
  const search = query ? `?${new URLSearchParams(query).toString()}` : '';
  window.location.hash = `#${path}${search}`;
}
