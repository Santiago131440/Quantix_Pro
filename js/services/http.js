/**
 * Utilidades compartidas por los servicios "mock backend".
 * `simulateNetwork` emula la latencia de una API para que la UI maneje estados de carga reales.
 */
let latencyMs = 0;

export function setLatency(ms) { latencyMs = Math.max(0, Number(ms) || 0); }

export const simulateNetwork = (factor = 1) => (latencyMs
  ? new Promise((resolve) => { setTimeout(resolve, latencyMs * factor * (0.7 + Math.random() * 0.6)); })
  : Promise.resolve());

export const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export const nowISO = () => new Date().toISOString();

/** Memoiza un cálculo mientras las colecciones de entrada sean las mismas referencias (caché invalidada al escribir). */
export function memoizeByRefs(compute) {
  let lastRefs = [];
  let lastValue;
  return (...refs) => {
    if (refs.length === lastRefs.length && refs.every((ref, index) => ref === lastRefs[index])) return lastValue;
    lastRefs = refs;
    lastValue = compute(...refs);
    return lastValue;
  };
}
