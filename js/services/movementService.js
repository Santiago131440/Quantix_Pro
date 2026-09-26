import { db } from '../core/storage.js';
import { NotFoundError } from '../core/errors.js';
import { REASON_LABELS } from '../config/constants.js';
import { assertPermission } from '../utils/permissions.js';
import { clone, memoizeByRefs, simulateNetwork } from './http.js';

/** Líneas normalizadas para analítica (sin nombres, livianas). */
const buildLines = memoizeByRefs((movements, details) => {
  const headers = new Map(movements.map((movement) => [movement.id, movement]));
  return details.map((detail) => {
    const header = headers.get(detail.movementId);
    return { ...detail, date: header.date, type: header.type, reason: header.reason, userId: header.userId, warehouseId: header.warehouseId };
  });
});

export const getMovementLines = () => buildLines(db.get('movements'), db.get('movementDetails'));

/** Join completo para el historial. */
const buildHistory = memoizeByRefs((lines, movements, products, users, warehouses, locations, suppliers) => {
  const map = (rows) => new Map(rows.map((row) => [row.id, row]));
  const [headers, productMap, userMap, warehouseMap, locationMap, supplierMap] = [movements, products, users, warehouses, locations, suppliers].map(map);
  return lines.map((line) => {
    const header = headers.get(line.movementId);
    const product = productMap.get(line.productId);
    return {
      ...line,
      number: header.number,
      document: header.document,
      notes: header.notes,
      reasonLabel: REASON_LABELS[line.reason] || line.reason,
      productCode: product?.code || '—',
      productName: product?.name || 'Producto eliminado',
      unit: product?.unit || '',
      categoryId: product?.categoryId,
      userName: userMap.get(line.userId)?.name || 'Sistema',
      warehouseName: warehouseMap.get(line.warehouseId)?.name || '—',
      locationCode: locationMap.get(line.locationId)?.code || '—',
      supplierName: supplierMap.get(header.supplierId)?.name || '',
      value: Math.abs(line.delta) * (line.unitCost || 0),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
});

export const getHistoryRows = () => buildHistory(getMovementLines(), db.get('movements'), db.get('products'), db.get('users'), db.get('warehouses'), db.get('locations'), db.get('suppliers'));

export const movementService = {
  async list({ type, productId, limit } = {}) {
    await simulateNetwork();
    assertPermission('movements.view');
    let rows = getHistoryRows();
    if (type) rows = rows.filter((row) => row.type === type);
    if (productId) rows = rows.filter((row) => row.productId === productId);
    return clone(limit ? rows.slice(0, limit) : rows);
  },

  async getById(movementId) {
    await simulateNetwork(0.5);
    assertPermission('movements.view');
    const row = getHistoryRows().find((item) => item.movementId === movementId);
    if (!row) throw new NotFoundError('Movimiento');
    return clone(row);
  },
};
