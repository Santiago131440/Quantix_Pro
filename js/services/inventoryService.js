/**
 * Núcleo transaccional del inventario: existencias y registro de movimientos.
 * Flujo registerMovement: autoriza → valida → calcula → escribe TODO de forma atómica → audita → notifica.
 */
import { db } from '../core/storage.js';
import { appStore } from '../core/store.js';
import { bus, EVENTS } from '../core/events.js';
import { ValidationError } from '../core/errors.js';
import { MOVEMENT_REASONS, MOVEMENT_TYPE_META } from '../config/constants.js';
import { assertPermission, hasPermission } from '../utils/permissions.js';
import { buildStockIndex, getStockStatus, stockValue, validateMovement, weightedAverageCost } from '../domain/inventory.js';
import { sanitizeText } from '../utils/validators.js';
import { uid, padNumber } from '../utils/id.js';
import { appendAudit, buildAuditEntry } from './auditService.js';
import { clone, memoizeByRefs, nowISO, simulateNetwork } from './http.js';

const indexStock = memoizeByRefs((inventory) => buildStockIndex(inventory));
export const getStockIndex = () => indexStock(db.get('inventory'));

const buildOverview = memoizeByRefs((products, inventory, categories, locations, warehouses, suppliers) => {
  const index = indexStock(inventory);
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  const categoryMap = byId(categories);
  const locationMap = byId(locations);
  const warehouseMap = byId(warehouses);
  const supplierMap = byId(suppliers);
  return products.map((product) => {
    const stock = index.get(product.id) || { quantity: 0, locations: [], updatedAt: product.updatedAt };
    const location = locationMap.get(product.locationId);
    const extraLocations = stock.locations.filter((item) => item.locationId !== product.locationId && item.quantity !== 0).length;
    return {
      ...product,
      quantity: stock.quantity,
      categoryName: categoryMap.get(product.categoryId)?.name || '—',
      subcategoryName: categoryMap.get(product.subcategoryId)?.name || '',
      locationCode: location?.code || '—',
      locationName: location?.name || '',
      extraLocations,
      warehouseName: warehouseMap.get(product.warehouseId)?.name || '—',
      supplierName: supplierMap.get(product.supplierId)?.name || '—',
      stockStatus: getStockStatus({ quantity: stock.quantity, minStock: product.minStock, maxStock: product.maxStock, blocked: product.blocked }),
      totalValue: stockValue(stock.quantity, product.unitCost),
      stockUpdatedAt: stock.updatedAt || product.updatedAt,
    };
  });
});

/** Vista enriquecida (join) producto + existencias + catálogos. Sin permisos: uso interno. */
export const getOverviewRows = () => buildOverview(db.get('products'), db.get('inventory'), db.get('categories'), db.get('locations'), db.get('warehouses'), db.get('suppliers'));

function normalizeInput(input) {
  return {
    type: input.type,
    reason: input.reason,
    productId: input.productId,
    locationId: input.locationId,
    quantity: input.quantity === '' || input.quantity === undefined ? '' : Number(input.quantity),
    unitCost: input.unitCost === '' || input.unitCost === undefined ? '' : Number(input.unitCost),
    adjustMode: input.adjustMode || 'increase',
    supplierId: input.supplierId || null,
    document: sanitizeText(input.document, 40),
    notes: sanitizeText(input.notes, 300),
    date: input.date ? new Date(input.date).toISOString() : nowISO(),
  };
}

export const inventoryService = {
  async getStockOverview() {
    await simulateNetwork();
    assertPermission('inventory.view');
    return clone(getOverviewRows());
  },

  /** Existencias de un producto por ubicación (para formularios de movimientos). */
  getProductStock(productId) {
    const locations = new Map(db.get('locations').map((location) => [location.id, location]));
    return db.get('inventory')
      .filter((row) => row.productId === productId)
      .map((row) => ({ ...row, locationCode: locations.get(row.locationId)?.code, locationName: locations.get(row.locationId)?.name }));
  },

  /** Previsualiza el efecto sin guardar (usado por la UI para validar en vivo). */
  preview(input) {
    const data = normalizeInput(input);
    const product = db.get('products').find((item) => item.id === data.productId);
    const record = db.get('inventory').find((row) => row.productId === data.productId && row.locationId === data.locationId);
    return validateMovement(data, {
      product, currentQty: record?.quantity ?? 0, allowNegative: hasPermission('inventory.allow_negative'),
      validReasons: (MOVEMENT_REASONS[data.type] || []).map((reason) => reason.value),
    });
  },

  async registerMovement(input) {
    await simulateNetwork(1.5);
    const data = normalizeInput(input);
    assertPermission(data.type === 'ADJUST' ? 'inventory.adjust' : 'movements.create');

    const products = db.get('products');
    const product = products.find((item) => item.id === data.productId);
    const location = db.get('locations').find((item) => item.id === data.locationId && item.active !== false);
    const inventory = db.get('inventory');
    const record = inventory.find((row) => row.productId === data.productId && row.locationId === data.locationId);
    const currentQty = record?.quantity ?? 0;

    const result = validateMovement(data, {
      product, currentQty, allowNegative: hasPermission('inventory.allow_negative'),
      validReasons: (MOVEMENT_REASONS[data.type] || []).map((reason) => reason.value),
    });
    if (!location && !result.errors.locationId) result.errors.locationId = 'La ubicación no existe o está inactiva.';
    if (!result.valid || !location) throw new ValidationError(result.errors);

    const { effect } = result;
    const timestamp = nowISO();
    const counters = { IN: 0, OUT: 0, ADJUST: 0, ...db.getValue('counters', {}) };
    counters[data.type] += 1;
    const userId = appStore.getState().session?.user?.id || 'system';

    const totalQty = inventory.filter((row) => row.productId === product.id).reduce((total, row) => total + row.quantity, 0);
    const unitCost = data.type === 'IN' ? Number(data.unitCost) : product.unitCost;
    const updatedProduct = {
      ...product,
      unitCost: data.type === 'IN' ? weightedAverageCost(totalQty, product.unitCost, effect.delta, unitCost) : product.unitCost,
      updatedAt: timestamp,
    };

    const movement = {
      id: uid('mov'), number: `${MOVEMENT_TYPE_META[data.type].prefix}-${padNumber(counters[data.type])}`,
      type: data.type, reason: data.reason, date: data.date, warehouseId: location.warehouseId, userId,
      supplierId: data.type === 'IN' ? data.supplierId : null, document: data.document, notes: data.notes, status: 'posted', createdAt: timestamp,
    };
    const detail = {
      id: uid('det'), movementId: movement.id, productId: product.id, locationId: location.id,
      quantity: Math.abs(effect.delta), delta: effect.delta, unitCost, stockBefore: effect.before, stockAfter: effect.after,
    };
    const nextInventory = record
      ? inventory.map((row) => (row === record ? { ...row, quantity: effect.after, updatedAt: timestamp } : row))
      : [...inventory, { id: uid('inv'), productId: product.id, locationId: location.id, warehouseId: location.warehouseId, quantity: effect.after, updatedAt: timestamp }];

    const action = { IN: 'STOCK_IN', OUT: 'STOCK_OUT', ADJUST: 'STOCK_ADJUSTED' }[data.type];
    db.commit({
      products: products.map((item) => (item.id === product.id ? updatedProduct : item)),
      inventory: nextInventory,
      movements: [...db.get('movements'), movement],
      movementDetails: [...db.get('movementDetails'), detail],
      counters,
      auditLogs: appendAudit(buildAuditEntry({
        action, entity: 'movement', entityId: movement.id,
        before: { productId: product.id, stock: effect.before, unitCost: product.unitCost },
        after: { productId: product.id, stock: effect.after, unitCost: updatedProduct.unitCost, number: movement.number },
      })),
    });
    bus.emit(EVENTS.DATA_CHANGED, { entity: 'inventory', action: 'movement', id: movement.id });
    return clone({ movement, detail, product: updatedProduct });
  },
};
