/* Script síncrono y mínimo: aplica el tema antes del primer pintado (evita el destello claro/oscuro). */
(function () {
  var preference = 'system';
  try { preference = localStorage.getItem('inventra:theme') || 'system'; } catch (error) { /* modo privado */ }
  var dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}());
