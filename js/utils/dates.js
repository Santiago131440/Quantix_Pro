export const DAY_MS = 86_400_000;

export const toDate = (value) => (value instanceof Date ? value : new Date(value));

export function startOfDay(value = new Date()) {
  const date = new Date(toDate(value));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value = new Date()) {
  const date = new Date(toDate(value));
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value, days) {
  const date = new Date(toDate(value));
  date.setDate(date.getDate() + days);
  return date;
}

export function toISODate(value) {
  const date = toDate(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Valor compatible con <input type="datetime-local"> en hora local. */
export function toLocalInputValue(value = new Date()) {
  const date = toDate(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Rango de los últimos N días (incluye hoy). */
export function periodRange(days, reference = new Date()) {
  return { from: startOfDay(addDays(reference, -(days - 1))), to: endOfDay(reference), days };
}

export function isWithin(value, { from, to }) {
  const time = toDate(value).getTime();
  return (!from || time >= toDate(from).getTime()) && (!to || time <= toDate(to).getTime());
}

/** Lunes de la semana de la fecha dada. */
export function startOfWeek(value) {
  const date = startOfDay(value);
  const day = (date.getDay() + 6) % 7;
  return addDays(date, -day);
}
