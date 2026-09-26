/** Tema claro/oscuro: respeta prefers-color-scheme y guarda la elección manual. */
const STORAGE_KEY = 'inventra:theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

export function getThemePreference() {
  try { return localStorage.getItem(STORAGE_KEY) || 'system'; } catch { return 'system'; }
}

export function resolveTheme(preference = getThemePreference()) {
  if (preference === 'system') return media?.matches ? 'dark' : 'light';
  return preference;
}

function apply(preference, animate) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 350);
  }
  const theme = resolveTheme(preference);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f7');
  listeners.forEach((listener) => listener(theme, preference));
}

export function setThemePreference(preference) {
  try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* modo privado */ }
  apply(preference, true);
}

export function toggleTheme() {
  setThemePreference(resolveTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initTheme() {
  apply(getThemePreference(), false);
  media?.addEventListener('change', () => { if (getThemePreference() === 'system') apply('system', true); });
}
