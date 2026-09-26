/** Búsqueda, filtros, orden y paginación puros (reutilizables en React con useMemo). */
export const normalizeText = (value) => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const readField = (row, field) => (typeof field === 'function' ? field(row) : row[field]);

export function matchesSearch(row, term, fields) {
  const needle = normalizeText(term);
  if (!needle) return true;
  const tokens = needle.split(/\s+/);
  const haystack = fields.map((field) => normalizeText(readField(row, field))).join(' ');
  return tokens.every((token) => haystack.includes(token));
}

/**
 * @param {Array} rows
 * @param {{search?:string, searchFields?:Array, filters?:Object, accessors?:Object}} query
 * Los filtros vacíos ('' | 'all' | null) se ignoran. Todos los filtros activos se combinan (AND).
 */
export function filterRows(rows, { search = '', searchFields = [], filters = {}, accessors = {} } = {}) {
  const active = Object.entries(filters).filter(([, value]) => value !== '' && value !== 'all' && value !== null && value !== undefined);
  return rows.filter((row) => {
    if (search && !matchesSearch(row, search, searchFields)) return false;
    return active.every(([key, value]) => {
      const accessor = accessors[key];
      if (typeof accessor === 'function') return accessor(row, value);
      return String(row[key]) === String(value);
    });
  });
}

export function sortRows(rows, { key, direction = 'asc', accessor } = {}) {
  if (!key) return rows;
  const read = accessor || ((row) => row[key]);
  const factor = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    if (left === right) return 0;
    if (left === null || left === undefined || left === '') return 1;
    if (right === null || right === undefined || right === '') return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' }) * factor;
  });
}

export function paginate(rows, page = 1, pageSize = 10) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: current, pages, total, start: total ? start + 1 : 0, end: Math.min(start + pageSize, total) };
}
