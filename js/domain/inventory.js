/**
 * Reglas de negocio de inventario (puras, sin DOM ni almacenamiento).
 * Son la pieza que se reutiliza sin cambios en React y, si se desea, en un backend Node.
 */
import { MOVEMENT_TYPES } from '../config/constants.js';

export const INTEGER_UNITS = new Set(['und', 'caja', 'saco', 'rollo']);
const round = (value, decimals = 4) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export function getStockStatus({ quantity = 0, minStock = 0, maxStock = 0, blocked = false }) {
  if (blocked) return 'blocked';
  if (quantity <= 0) return 'out';
  if (quantity <= minStock) return 'low';
  if (maxStock > 0 && quantity > maxStock) return 'over';
  return 'available';
}

export const stockValue = (quantity, unitCost) => round(Math.max(Number(quantity) || 0, 0) * (Number(unitCost) || 0), 2);

/** Efecto de un movimiento sobre la existencia de una ubicación. */
export function computeMovementEffect({ type, quantity, currentQty = 0, adjustMode = 'increase' }) {
  const amount = Number(quantity) || 0;
  let delta;
  if (type === MOVEMENT_TYPES.IN) delta = amount;
  else if (type === MOVEMENT_TYPES.OUT) delta = -amount;
  else if (adjustMode === 'count') delta = amount - currentQty;
  else delta = adjustMode === 'decrease' ? -amount : amount;
  return { delta: round(delta), before: round(currentQty), after: round(currentQty + delta) };
}

/** Costo promedio ponderado (CPP) tras una entrada. */
export function weightedAverageCost(currentQty, currentCost, incomingQty, incomingCost) {
  const baseQty = Math.max(Number(currentQty) || 0, 0);
  const inQty = Number(incomingQty) || 0;
  if (inQty <= 0) return Number(currentCost) || 0;
  if (baseQty === 0) return round(Number(incomingCost) || 0);
  return round((baseQty * currentCost + inQty * incomingCost) / (baseQty + inQty));
}

/**
 * Valida un movimiento antes de aplicarlo.
 * @returns {{ valid:boolean, errors:Object, effect?:Object }}
 */
export function validateMovement(input, { product, currentQty = 0, allowNegative = false, validReasons = [] }) {
  const errors = {};
  const { type, reason, quantity, unitCost, locationId, adjustMode, notes, date } = input;

  if (!Object.values(MOVEMENT_TYPES).includes(type)) errors.type = 'Tipo de movimiento no válido.';
  if (!product) errors.productId = 'Selecciona un producto existente.';
  else if (product.status !== 'active') errors.productId = 'El producto está inactivo.';
  else if (type === MOVEMENT_TYPES.OUT && product.blocked) errors.productId = 'El producto está bloqueado: no admite salidas.';

  if (!reason || (validReasons.length && !validReasons.includes(reason))) errors.reason = 'Selecciona un motivo válido.';
  if (!locationId) errors.locationId = 'Selecciona una ubicación.';

  const amount = Number(quantity);
  const isCount = type === MOVEMENT_TYPES.ADJUST && adjustMode === 'count';
  if (quantity === '' || quantity === null || quantity === undefined || !Number.isFinite(amount)) errors.quantity = 'Ingresa una cantidad válida.';
  else if (isCount ? amount < 0 : amount <= 0) errors.quantity = isCount ? 'La cantidad contada no puede ser negativa.' : 'La cantidad debe ser mayor que cero.';
  else if (product && INTEGER_UNITS.has(product.unit) && !Number.isInteger(amount)) errors.quantity = `La unidad "${product.unit}" solo admite cantidades enteras.`;
  else if (amount > 1e9) errors.quantity = 'Cantidad fuera de rango.';

  if (type === MOVEMENT_TYPES.IN && (unitCost === '' || !Number.isFinite(Number(unitCost)) || Number(unitCost) < 0)) {
    errors.unitCost = 'Ingresa un costo unitario válido (≥ 0).';
  }
  if (type === MOVEMENT_TYPES.ADJUST && String(notes ?? '').trim().length < 5) errors.notes = 'Justifica el ajuste (mínimo 5 caracteres).';
  if (date && new Date(date).getTime() > Date.now() + 60_000) errors.date = 'La fecha no puede ser futura.';

  if (Object.keys(errors).length) return { valid: false, errors };

  const effect = computeMovementEffect({ type, quantity: amount, currentQty, adjustMode });
  if (effect.delta === 0) return { valid: false, errors: { quantity: 'La cantidad contada es igual a la existencia: no hay nada que ajustar.' } };
  if (effect.after < 0 && !allowNegative) {
    return { valid: false, errors: { quantity: `Stock insuficiente en la ubicación. Disponible: ${effect.before}.` }, effect };
  }
  return { valid: true, errors: {}, effect };
}

/** Índice de existencias por producto a partir de los registros de Inventory. */
export function buildStockIndex(inventoryRows) {
  const index = new Map();
  for (const row of inventoryRows) {
    const entry = index.get(row.productId) || { quantity: 0, locations: [], updatedAt: null };
    entry.quantity = round(entry.quantity + row.quantity);
    entry.locations.push({ locationId: row.locationId, warehouseId: row.warehouseId, quantity: row.quantity });
    if (!entry.updatedAt || row.updatedAt > entry.updatedAt) entry.updatedAt = row.updatedAt;
    index.set(row.productId, entry);
  }
  return index;
}
