/**
 * Plantillas HTML seguras.
 * Toda interpolación se escapa por defecto (prevención de XSS).
 * Solo el contenido envuelto en `raw()` o producido por `html``` se inserta sin escapar.
 */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (char) => ESCAPE_MAP[char]);
}

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marca una cadena como HTML de confianza (usar solo con contenido generado por el sistema). */
export const raw = (value) => new SafeHtml(String(value ?? ''));

function serialize(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let output = strings[0];
  for (let i = 0; i < values.length; i += 1) output += serialize(values[i]) + strings[i + 1];
  return new SafeHtml(output);
}

export function render(element, content) {
  element.innerHTML = serialize(content);
}
