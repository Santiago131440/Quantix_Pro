/**
 * Validación declarativa reutilizable (UI, servicios y, a futuro, backend Node).
 * Cada regla recibe (value, values) y devuelve un mensaje de error o null.
 */
const isEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

export const rules = {
  required: (message = 'Este campo es obligatorio.') => (value) => (isEmpty(value) ? message : null),
  minLength: (min) => (value) => (!isEmpty(value) && String(value).trim().length < min ? `Mínimo ${min} caracteres.` : null),
  maxLength: (max) => (value) => (!isEmpty(value) && String(value).length > max ? `Máximo ${max} caracteres.` : null),
  number: (message = 'Debe ser un número válido.') => (value) => (!isEmpty(value) && !Number.isFinite(Number(value)) ? message : null),
  integer: () => (value) => (!isEmpty(value) && !Number.isInteger(Number(value)) ? 'Debe ser un número entero.' : null),
  min: (min, message) => (value) => (!isEmpty(value) && Number(value) < min ? (message || `Debe ser mayor o igual a ${min}.`) : null),
  max: (max, message) => (value) => (!isEmpty(value) && Number(value) > max ? (message || `Debe ser menor o igual a ${max}.`) : null),
  positive: (message = 'Debe ser mayor que cero.') => (value) => (!isEmpty(value) && !(Number(value) > 0) ? message : null),
  email: () => (value) => (!isEmpty(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value)) ? 'Correo electrónico no válido.' : null),
  pattern: (regex, message) => (value) => (!isEmpty(value) && !regex.test(String(value)) ? message : null),
  notFuture: () => (value) => (!isEmpty(value) && new Date(value).getTime() > Date.now() + 60_000 ? 'La fecha no puede ser futura.' : null),
};

/** Ejecuta un esquema { campo: [reglas] } y devuelve { valid, errors }. */
export function validate(values, schema) {
  const errors = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    for (const rule of fieldRules) {
      const message = rule(values[field], values);
      if (message) { errors[field] = message; break; }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Normaliza texto libre: recorta, elimina caracteres de control y limita longitud. */
export function sanitizeText(value, maxLength = 500) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-_.]{1,29}$/;
