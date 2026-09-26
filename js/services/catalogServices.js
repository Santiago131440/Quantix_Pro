/** Servicios de catálogos: categorías, centros de trabajo, ubicaciones y proveedores. */
import { db } from '../core/storage.js';
import { createCrudService } from './crudService.js';
import { rules, validate, sanitizeText, CODE_PATTERN } from '../utils/validators.js';

const uniqueBy = (field, message) => (data, { existing, id }) => (
  existing.some((item) => item.id !== id && String(item[field]).toLowerCase() === String(data[field]).toLowerCase()) ? { [field]: message } : {}
);

const combine = (schema, ...checks) => (data, context) => {
  const { errors } = validate(data, schema);
  checks.forEach((check) => Object.assign(errors, { ...check(data, context), ...errors }));
  return { valid: Object.keys(errors).length === 0, errors };
};

export const categoryService = createCrudService({
  collection: 'categories', entity: 'category', label: 'Categoría', idPrefix: 'cat', auditPrefix: 'CATEGORY',
  permissions: { manage: 'categories.manage' },
  normalize: (data) => ({ name: sanitizeText(data.name, 60), description: sanitizeText(data.description, 240), parentId: data.parentId || null, active: data.active !== false && data.active !== 'false' }),
  validate: combine(
    { name: [rules.required(), rules.minLength(2)] },
    uniqueBy('name', 'Ya existe una categoría con este nombre.'),
    (data, { id }) => (data.parentId && data.parentId === id ? { parentId: 'Una categoría no puede ser su propia madre.' } : {}),
    (data, { id }) => (id && data.parentId && db.get('categories').some((item) => item.parentId === id) ? { parentId: 'Esta categoría tiene subcategorías; no puede convertirse en subcategoría.' } : {}),
  ),
  beforeRemove: (category) => {
    if (db.get('categories').some((item) => item.parentId === category.id)) return 'La categoría tiene subcategorías. Elimínalas o reasígnalas primero.';
    if (db.get('products').some((product) => product.categoryId === category.id || product.subcategoryId === category.id)) return 'Hay productos asociados. Desactiva la categoría en lugar de eliminarla.';
    return null;
  },
});

export const warehouseService = createCrudService({
  collection: 'warehouses', entity: 'warehouse', label: 'Centro de trabajo', idPrefix: 'wh', auditPrefix: 'WAREHOUSE',
  permissions: { manage: 'locations.manage' },
  normalize: (data) => ({ code: sanitizeText(data.code, 20).toUpperCase(), name: sanitizeText(data.name, 80), description: sanitizeText(data.description, 240), active: data.active !== false && data.active !== 'false' }),
  validate: combine(
    { code: [rules.required(), rules.pattern(CODE_PATTERN, 'Usa mayúsculas, números y guiones.')], name: [rules.required(), rules.minLength(3)] },
    uniqueBy('code', 'El código ya existe.'),
  ),
  beforeRemove: (warehouse) => (db.get('locations').some((location) => location.warehouseId === warehouse.id) ? 'El centro tiene ubicaciones asociadas.' : null),
});

export const locationService = createCrudService({
  collection: 'locations', entity: 'location', label: 'Ubicación', idPrefix: 'loc', auditPrefix: 'LOCATION', sortBy: 'code',
  permissions: { manage: 'locations.manage' },
  normalize: (data) => ({ code: sanitizeText(data.code, 20).toUpperCase(), name: sanitizeText(data.name, 80), warehouseId: data.warehouseId || '', active: data.active !== false && data.active !== 'false' }),
  validate: combine(
    { code: [rules.required(), rules.pattern(CODE_PATTERN, 'Usa mayúsculas, números y guiones.')], name: [rules.required()], warehouseId: [rules.required('Selecciona un centro de trabajo.')] },
    uniqueBy('code', 'El código ya existe.'),
  ),
  beforeRemove: (location) => {
    if (db.get('inventory').some((row) => row.locationId === location.id && row.quantity !== 0)) return 'La ubicación tiene existencias.';
    if (db.get('products').some((product) => product.locationId === location.id)) return 'Es la ubicación predeterminada de uno o más productos.';
    return null;
  },
});

export const supplierService = createCrudService({
  collection: 'suppliers', entity: 'supplier', label: 'Proveedor', idPrefix: 'sup', auditPrefix: 'SUPPLIER',
  permissions: { manage: 'suppliers.manage' },
  normalize: (data) => ({
    name: sanitizeText(data.name, 100), taxId: sanitizeText(data.taxId, 30).toUpperCase(), contact: sanitizeText(data.contact, 80),
    email: sanitizeText(data.email, 120).toLowerCase(), phone: sanitizeText(data.phone, 30),
    leadTimeDays: data.leadTimeDays === '' || data.leadTimeDays === undefined ? 0 : Number(data.leadTimeDays), active: data.active !== false && data.active !== 'false',
  }),
  validate: combine(
    { name: [rules.required(), rules.minLength(3)], taxId: [rules.required()], email: [rules.email()], leadTimeDays: [rules.number(), rules.integer(), rules.min(0), rules.max(365)] },
    uniqueBy('taxId', 'Ya existe un proveedor con esta identificación.'),
  ),
  beforeRemove: (supplier) => (db.get('products').some((product) => product.supplierId === supplier.id) || db.get('movements').some((movement) => movement.supplierId === supplier.id)
    ? 'El proveedor tiene productos o movimientos asociados. Desactívalo en su lugar.' : null),
});
