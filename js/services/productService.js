import { db } from '../core/storage.js';
import { bus, EVENTS } from '../core/events.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../core/errors.js';
import { assertPermission, hasPermission } from '../utils/permissions.js';
import { normalizeProduct, validateProduct } from '../domain/products.js';
import { uid } from '../utils/id.js';
import { appendAudit, buildAuditEntry } from './auditService.js';
import { clone, nowISO, simulateNetwork } from './http.js';
import { inventoryService } from './inventoryService.js';

const products = () => db.get('products');
const findOrThrow = (id) => {
  const product = products().find((item) => item.id === id);
  if (!product) throw new NotFoundError('Producto');
  return product;
};

function assertReferences(data) {
  const errors = {};
  const categories = db.get('categories');
  if (!categories.some((item) => item.id === data.categoryId && !item.parentId)) errors.categoryId = 'La categoría no existe.';
  if (data.subcategoryId && !categories.some((item) => item.id === data.subcategoryId && item.parentId === data.categoryId)) errors.subcategoryId = 'La subcategoría no pertenece a la categoría.';
  const location = db.get('locations').find((item) => item.id === data.locationId);
  if (!location) errors.locationId = 'La ubicación no existe.';
  else if (location.warehouseId !== data.warehouseId) errors.locationId = 'La ubicación no pertenece al centro seleccionado.';
  if (data.supplierId && !db.get('suppliers').some((item) => item.id === data.supplierId)) errors.supplierId = 'El proveedor no existe.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

const emit = (action, id) => bus.emit(EVENTS.DATA_CHANGED, { entity: 'product', action, id });

export const productService = {
  async getAll() {
    await simulateNetwork();
    assertPermission('products.view');
    return clone(products());
  },

  async getById(id) {
    await simulateNetwork(0.5);
    assertPermission('products.view');
    return clone(findOrThrow(id));
  },

  hasMovements(id) {
    return db.get('movementDetails').some((detail) => detail.productId === id);
  },

  async create(input) {
    await simulateNetwork(1.2);
    assertPermission('products.create');
    const data = normalizeProduct(input);
    const { valid, errors } = validateProduct(data, { existing: products() });
    if (!valid) throw new ValidationError(errors);
    assertReferences(data);

    const initialStock = Number(input.initialStock) || 0;
    if (initialStock < 0) throw new ValidationError({ initialStock: 'El stock inicial no puede ser negativo.' });
    if (initialStock > 0 && !hasPermission('movements.create')) throw new ValidationError({ initialStock: 'No tienes permiso para registrar stock inicial.' });

    const timestamp = nowISO();
    const product = { id: uid('prd'), ...data, createdAt: timestamp, updatedAt: timestamp };
    db.commit({
      products: [...products(), product],
      inventory: [...db.get('inventory'), { id: uid('inv'), productId: product.id, locationId: product.locationId, warehouseId: product.warehouseId, quantity: 0, updatedAt: timestamp }],
      auditLogs: appendAudit(buildAuditEntry({ action: 'PRODUCT_CREATED', entity: 'product', entityId: product.id, after: product })),
    });
    emit('created', product.id);

    if (initialStock > 0) {
      await inventoryService.registerMovement({
        type: 'IN', reason: 'INITIAL', productId: product.id, locationId: product.locationId, quantity: initialStock,
        unitCost: product.unitCost, document: 'SI-ALTA', notes: 'Stock inicial al crear el producto',
      });
    }
    return clone(db.get('products').find((item) => item.id === product.id));
  },

  async update(id, input) {
    await simulateNetwork(1.2);
    assertPermission('products.edit');
    const before = findOrThrow(id);
    const data = normalizeProduct({ ...before, ...input });
    const { valid, errors } = validateProduct(data, { existing: products(), id });
    if (!valid) throw new ValidationError(errors);
    assertReferences(data);
    const after = { ...before, ...data, updatedAt: nowISO() };
    db.commit({
      products: products().map((item) => (item.id === id ? after : item)),
      auditLogs: appendAudit(buildAuditEntry({ action: 'PRODUCT_UPDATED', entity: 'product', entityId: id, before, after })),
    });
    emit('updated', id);
    return clone(after);
  },

  /** Desactivar/activar (baja lógica). */
  async setStatus(id, status) {
    assertPermission('products.delete');
    return this.update(id, { status: status === 'inactive' ? 'inactive' : 'active' });
  },

  /** Eliminación física solo si nunca tuvo movimientos (preserva trazabilidad). */
  async remove(id) {
    await simulateNetwork(1.2);
    assertPermission('products.delete');
    const before = findOrThrow(id);
    if (this.hasMovements(id)) throw new BusinessRuleError('El producto tiene movimientos registrados. Desactívalo para conservar la trazabilidad.');
    db.commit({
      products: products().filter((item) => item.id !== id),
      inventory: db.get('inventory').filter((row) => row.productId !== id),
      auditLogs: appendAudit(buildAuditEntry({ action: 'PRODUCT_DELETED', entity: 'product', entityId: id, before })),
    });
    emit('deleted', id);
    return true;
  },
};
