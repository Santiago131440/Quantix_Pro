/** Normalización y validación de productos (reglas puras). */
import { rules, validate, sanitizeText, CODE_PATTERN } from '../utils/validators.js';

export function normalizeProduct(data) {
  const number = (value, fallback = 0) => (value === '' || value === null || value === undefined ? fallback : Number(value));
  return {
    code: sanitizeText(data.code, 30).toUpperCase(),
    sku: sanitizeText(data.sku, 30).toUpperCase(),
    name: sanitizeText(data.name, 120),
    description: sanitizeText(data.description, 500),
    categoryId: data.categoryId || '',
    subcategoryId: data.subcategoryId || '',
    unit: data.unit || 'und',
    brand: sanitizeText(data.brand, 60),
    supplierId: data.supplierId || '',
    warehouseId: data.warehouseId || '',
    locationId: data.locationId || '',
    minStock: number(data.minStock),
    maxStock: number(data.maxStock),
    unitCost: number(data.unitCost),
    price: number(data.price),
    status: data.status === 'inactive' ? 'inactive' : 'active',
    blocked: Boolean(data.blocked),
  };
}

export function validateProduct(product, { existing = [], id } = {}) {
  const schema = {
    code: [rules.required(), rules.pattern(CODE_PATTERN, 'Usa mayúsculas, números y guiones (2-30).')],
    sku: [rules.required(), rules.pattern(CODE_PATTERN, 'Usa mayúsculas, números y guiones (2-30).')],
    name: [rules.required(), rules.minLength(3)],
    categoryId: [rules.required('Selecciona una categoría.')],
    unit: [rules.required()],
    warehouseId: [rules.required('Selecciona un centro de trabajo.')],
    locationId: [rules.required('Selecciona una ubicación.')],
    minStock: [rules.number(), rules.min(0)],
    maxStock: [rules.number(), rules.min(0), (value, values) => (Number(value) > 0 && Number(value) < Number(values.minStock) ? 'El máximo debe ser mayor o igual al mínimo.' : null)],
    unitCost: [rules.number(), rules.min(0)],
    price: [rules.number(), rules.min(0)],
  };
  const { errors } = validate(product, schema);
  const others = existing.filter((item) => item.id !== id);
  if (!errors.code && others.some((item) => item.code === product.code)) errors.code = 'Ya existe un producto con este código.';
  if (!errors.sku && others.some((item) => item.sku === product.sku)) errors.sku = 'Ya existe un producto con este SKU.';
  return { valid: Object.keys(errors).length === 0, errors };
}
