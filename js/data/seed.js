/**
 * Generador determinista de datos demo.
 * Simula ~100 días de operación (consumos, compras con lead time, producción, conteos cíclicos)
 * usando las MISMAS reglas de dominio que la aplicación, para que el historial sea coherente
 * (stock anterior/nuevo, costo promedio ponderado, estados finales variados).
 */
import { categoriesSeed } from './categories.js';
import { warehousesSeed } from './warehouses.js';
import { locationsSeed } from './locations.js';
import { suppliersSeed } from './suppliers.js';
import { rolesSeed } from './roles.js';
import { usersSeed } from './users.js';
import { productsSeed } from './products.js';
import { computeMovementEffect, weightedAverageCost, INTEGER_UNITS } from '../domain/inventory.js';
import { MOVEMENT_TYPE_META } from '../config/constants.js';
import { addDays, startOfDay } from '../utils/dates.js';
import { padNumber } from '../utils/id.js';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OUT_REASON = { 'cat-pt': 'DISPATCH', 'cat-rep': 'CONSUMPTION', 'cat-ins': 'CONSUMPTION' };
const DOC_PREFIX = { PURCHASE: 'OC', PRODUCTION: 'OP', RETURN: 'DV', INITIAL: 'SI', DISPATCH: 'RM', SALE: 'FV', PRODUCTION_USE: 'OP', CONSUMPTION: 'VS', CYCLE_COUNT: 'CC', SHRINKAGE: 'MR' };

export function buildSeedData({ now = new Date(), days = 100, seed = 20260925 } = {}) {
  const random = mulberry32(seed);
  const between = (min, max) => min + random() * (max - min);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const locationById = new Map(locationsSeed.map((location) => [location.id, location]));
  const supplierById = new Map(suppliersSeed.map((supplier) => [supplier.id, supplier]));
  const start = startOfDay(addDays(now, -days));

  const products = [];
  const simulation = new Map();
  productsSeed.forEach(([code, sku, name, categoryId, subcategoryId, unit, brand, supplierId, locationId, unitCost, price, minStock, maxStock, initialQty, dailyUse, target]) => {
    const id = `prd-${code.toLowerCase()}`;
    products.push({
      id, code, sku, name, description: '', categoryId, subcategoryId, unit, brand, supplierId,
      warehouseId: locationById.get(locationId).warehouseId, locationId, minStock, maxStock, unitCost, price,
      status: target === 'inactive' ? 'inactive' : 'active', blocked: target === 'blocked',
      createdAt: start.toISOString(), updatedAt: start.toISOString(),
    });
    simulation.set(id, { initialQty, dailyUse, target, baseCost: unitCost, pendingArrival: null });
  });

  const inventory = new Map(products.map((product) => [product.id, 0]));
  const movements = [];
  const movementDetails = [];
  const counters = { IN: 0, OUT: 0, ADJUST: 0 };
  const docCounters = {};

  function post({ type, reason, date, product, quantity, unitCost, adjustMode, userId, supplierId, notes = '' }) {
    const current = inventory.get(product.id);
    const effect = computeMovementEffect({ type, quantity, currentQty: current, adjustMode });
    if (effect.delta === 0 || effect.after < 0) return;
    if (type === 'IN') product.unitCost = weightedAverageCost(current, product.unitCost, quantity, unitCost);
    inventory.set(product.id, effect.after);
    counters[type] += 1;
    docCounters[reason] = (docCounters[reason] || 1000) + 1;
    const movementId = `mov-${type.toLowerCase()}-${counters[type]}`;
    const iso = date.toISOString();
    movements.push({
      id: movementId, number: `${MOVEMENT_TYPE_META[type].prefix}-${padNumber(counters[type])}`, type, reason, date: iso,
      warehouseId: product.warehouseId, userId, supplierId: supplierId || null,
      document: `${DOC_PREFIX[reason] || 'DOC'}-${docCounters[reason]}`, notes, status: 'posted', createdAt: iso,
    });
    movementDetails.push({
      id: `det-${movementId}`, movementId, productId: product.id, locationId: product.locationId,
      quantity: Math.abs(effect.delta), delta: effect.delta, unitCost: type === 'IN' ? unitCost : product.unitCost,
      stockBefore: effect.before, stockAfter: effect.after,
    });
    product.updatedAt = iso;
  }

  const roundQty = (product, value) => (INTEGER_UNITS.has(product.unit) || value >= 20 ? Math.round(value) : Math.round(value * 10) / 10);
  const timeOn = (day, fromHour = 6, toHour = 18) => {
    const date = new Date(day);
    date.setHours(Math.floor(between(fromHour, toHour)), Math.floor(between(0, 60)), 0, 0);
    return date > now ? new Date(now.getTime() - 60_000 * Math.floor(between(5, 90))) : date;
  };

  // Saldos iniciales
  products.forEach((product) => {
    post({ type: 'IN', reason: 'INITIAL', date: new Date(start.getTime() + 7 * 3_600_000), product, quantity: simulation.get(product.id).initialQty, unitCost: product.unitCost, userId: 'usr-admin', notes: 'Saldo inicial de implementación' });
  });

  for (let offset = 1; offset <= days; offset += 1) {
    const day = addDays(start, offset);
    const isSunday = day.getDay() === 0;
    const lateStage = offset > days - 25;

    products.forEach((product) => {
      const sim = simulation.get(product.id);
      if (product.status !== 'active') return;

      // Llegada de pedidos pendientes
      if (sim.pendingArrival && sim.pendingArrival.day <= offset) {
        const isInternal = product.supplierId === 'sup-interna';
        post({
          type: 'IN', reason: isInternal ? 'PRODUCTION' : 'PURCHASE', date: timeOn(day, 7, 11), product,
          quantity: sim.pendingArrival.quantity, unitCost: Math.round(sim.baseCost * between(0.94, 1.08) * 10000) / 10000,
          userId: product.warehouseId === 'wh-des' ? 'usr-oper2' : 'usr-oper', supplierId: product.supplierId,
          notes: isInternal ? 'Ingreso de orden de producción' : 'Recepción de orden de compra',
        });
        sim.pendingArrival = null;
      }

      // Consumo / despacho
      if (sim.dailyUse > 0 && !isSunday) {
        const current = inventory.get(product.id);
        let quantity = 0;
        if (sim.dailyUse >= 1) {
          if (random() < 0.45) quantity = roundQty(product, sim.dailyUse * (7 / 2.7) * between(0.6, 1.4));
        } else if (random() < sim.dailyUse * 1.15) quantity = 1;
        quantity = Math.min(quantity, current);
        if (quantity > 0) {
          const reason = OUT_REASON[product.categoryId] || 'PRODUCTION_USE';
          post({
            type: 'OUT', reason: reason === 'DISPATCH' && random() < 0.3 ? 'SALE' : reason, date: timeOn(day), product, quantity,
            userId: product.warehouseId === 'wh-des' ? 'usr-oper2' : pick(['usr-oper', 'usr-oper', 'usr-super']),
            notes: reason === 'PRODUCTION_USE' ? `Orden de producción línea ${pick(['1', '2'])}` : '',
          });
        }
      }

      // Punto de reorden (se suspende al final para los productos que deben terminar bajos o agotados)
      const suppress = lateStage && ['low', 'out'].includes(sim.target);
      const leadTime = supplierById.get(product.supplierId)?.leadTimeDays ?? 7;
      const reorderPoint = product.minStock + sim.dailyUse * leadTime * 1.2;
      if (!suppress && !sim.pendingArrival && sim.dailyUse > 0 && inventory.get(product.id) <= reorderPoint) {
        const quantity = roundQty(product, product.maxStock * between(0.8, 0.95) - inventory.get(product.id));
        if (quantity > 0) sim.pendingArrival = { day: offset + leadTime, quantity };
      }
    });

    // Conteo cíclico cada ~30 días sobre 4 productos
    if (offset % 30 === 0) {
      for (let i = 0; i < 4; i += 1) {
        const product = pick(products.filter((item) => item.status === 'active' && inventory.get(item.id) > 0));
        const counted = roundQty(product, inventory.get(product.id) * between(0.965, 1.01));
        post({ type: 'ADJUST', reason: 'CYCLE_COUNT', adjustMode: 'count', date: timeOn(day, 15, 17), product, quantity: counted, userId: 'usr-super', notes: 'Diferencia detectada en conteo cíclico mensual' });
      }
    }

    // Devoluciones esporádicas de cliente
    if (offset % 17 === 0) {
      const product = pick(products.filter((item) => item.categoryId === 'cat-pt'));
      post({ type: 'IN', reason: 'RETURN', date: timeOn(day), product, quantity: Math.max(1, Math.round(simulation.get(product.id).dailyUse * 0.3)), unitCost: product.unitCost, userId: 'usr-oper2', notes: 'Devolución de cliente por empaque averiado' });
    }
    if (offset % 23 === 0) {
      const product = pick(products.filter((item) => item.categoryId === 'cat-emp'));
      post({ type: 'ADJUST', reason: 'DAMAGE', adjustMode: 'decrease', date: timeOn(day), product, quantity: roundQty(product, simulation.get(product.id).dailyUse * 0.4), userId: 'usr-super', notes: 'Material averiado en manipulación' });
    }
  }

  // Estados finales para demostrar alertas
  products.forEach((product) => {
    const sim = simulation.get(product.id);
    const current = inventory.get(product.id);
    const date = new Date(now.getTime() - between(2, 20) * 3_600_000);
    const reason = OUT_REASON[product.categoryId] || 'PRODUCTION_USE';
    if (sim.target === 'out' && current > 0) post({ type: 'OUT', reason, date, product, quantity: current, userId: 'usr-oper', notes: 'Consumo de emergencia' });
    if (sim.target === 'low') {
      const goal = Math.floor(product.minStock * 0.6);
      if (current > goal) post({ type: 'OUT', reason, date, product, quantity: current - goal, userId: 'usr-oper' });
      else if (current < goal) post({ type: 'IN', reason: 'PURCHASE', date, product, quantity: goal - current, unitCost: product.unitCost, userId: 'usr-oper', supplierId: product.supplierId, notes: 'Recepción parcial de pedido' });
    }
    if (sim.target === 'over') {
      const goal = Math.round(product.maxStock * 1.25);
      if (current < goal) post({ type: 'IN', reason: product.supplierId === 'sup-interna' ? 'PRODUCTION' : 'PURCHASE', date, product, quantity: goal - current, unitCost: product.unitCost, userId: 'usr-oper', supplierId: product.supplierId, notes: 'Compra por oportunidad de precio' });
    }
  });

  movements.sort((a, b) => a.date.localeCompare(b.date));

  const inventoryRows = products.map((product) => ({
    id: `inv-${product.id}`, productId: product.id, locationId: product.locationId, warehouseId: product.warehouseId,
    quantity: inventory.get(product.id), updatedAt: product.updatedAt,
  }));

  const detailByMovement = new Map(movementDetails.map((detail) => [detail.movementId, detail]));
  const recentLimit = addDays(now, -3).toISOString();
  const auditLogs = [
    { id: 'aud-seed', action: 'SYSTEM_SEEDED', entity: 'system', entityId: null, userId: 'usr-admin', date: start.toISOString(), before: null, after: { products: products.length, movements: movements.length } },
    ...movements.filter((movement) => movement.date >= recentLimit).map((movement) => {
      const detail = detailByMovement.get(movement.id);
      return {
        id: `aud-${movement.id}`, action: { IN: 'STOCK_IN', OUT: 'STOCK_OUT', ADJUST: 'STOCK_ADJUSTED' }[movement.type], entity: 'movement', entityId: movement.id,
        userId: movement.userId, date: movement.date,
        before: { productId: detail.productId, stock: detail.stockBefore }, after: { productId: detail.productId, stock: detail.stockAfter, number: movement.number },
      };
    }),
  ];

  return {
    categories: categoriesSeed.map((item) => ({ ...item, createdAt: start.toISOString(), updatedAt: start.toISOString() })),
    warehouses: warehousesSeed.map((item) => ({ ...item, createdAt: start.toISOString(), updatedAt: start.toISOString() })),
    locations: locationsSeed.map((item) => ({ ...item, createdAt: start.toISOString(), updatedAt: start.toISOString() })),
    suppliers: suppliersSeed.map((item) => ({ ...item, createdAt: start.toISOString(), updatedAt: start.toISOString() })),
    roles: rolesSeed.map((item) => ({ ...item, createdAt: start.toISOString(), updatedAt: start.toISOString() })),
    users: usersSeed.map((item) => ({ ...item, createdAt: start.toISOString(), updatedAt: start.toISOString() })),
    products,
    inventory: inventoryRows,
    movements,
    movementDetails,
    auditLogs,
    counters,
  };
}
