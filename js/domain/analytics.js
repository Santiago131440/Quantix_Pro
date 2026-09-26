/**
 * Analítica de inventario (pura). Todos los indicadores se calculan a partir de los datos,
 * nunca se escriben a mano. `lines` = detalle de movimientos normalizado:
 * { date, type, reason, productId, quantity, delta, unitCost }
 */
import { addDays, endOfDay, isWithin, startOfDay, startOfWeek, DAY_MS } from '../utils/dates.js';
import { getStockStatus, stockValue } from './inventory.js';

const sum = (items, read) => items.reduce((total, item) => total + (read(item) || 0), 0);
const qtyOf = (index, productId) => index.get(productId)?.quantity ?? 0;
const lineValue = (line) => Math.abs(line.delta) * (line.unitCost || 0);

export function inventoryValue(products, stockIndex) {
  return sum(products, (product) => stockValue(qtyOf(stockIndex, product.id), product.unitCost));
}

export function statusOf(product, stockIndex) {
  return getStockStatus({ quantity: qtyOf(stockIndex, product.id), minStock: product.minStock, maxStock: product.maxStock, blocked: product.blocked });
}

/** Serie diaria del valor del inventario reconstruida hacia atrás desde el saldo actual. */
export function buildValueSeries({ products, stockIndex, lines, range }) {
  const costs = new Map(products.map((product) => [product.id, product.unitCost || 0]));
  const sorted = [...lines].sort((a, b) => new Date(b.date) - new Date(a.date));
  let running = inventoryValue(products, stockIndex);
  let pointer = 0;
  const points = [];
  for (let day = startOfDay(range.to); day >= startOfDay(range.from); day = addDays(day, -1)) {
    const limit = endOfDay(day).getTime();
    while (pointer < sorted.length && new Date(sorted[pointer].date).getTime() > limit) {
      running -= sorted[pointer].delta * (costs.get(sorted[pointer].productId) || 0);
      pointer += 1;
    }
    points.push({ date: day.toISOString(), value: Math.max(running, 0) });
  }
  return points.reverse();
}

/** Flujo de entradas vs salidas (valorizado) por día o semana. */
export function buildFlowSeries({ lines, range, bucket = 'day' }) {
  const buckets = new Map();
  const keyOf = (date) => (bucket === 'week' ? startOfWeek(date) : startOfDay(date)).toISOString();
  for (let day = startOfDay(range.from); day <= range.to; day = addDays(day, bucket === 'week' ? 7 : 1)) {
    const key = keyOf(day);
    if (!buckets.has(key)) buckets.set(key, { date: key, in: 0, out: 0 });
  }
  lines.filter((line) => isWithin(line.date, range)).forEach((line) => {
    const entry = buckets.get(keyOf(line.date));
    if (!entry) return;
    if (line.type === 'IN') entry.in += lineValue(line);
    if (line.type === 'OUT') entry.out += lineValue(line);
  });
  return [...buckets.values()];
}

export function computeKpis({ products, stockIndex, lines, range, valueSeries }) {
  const active = products.filter((product) => product.status === 'active');
  const statusCounts = { available: 0, low: 0, out: 0, over: 0, blocked: 0 };
  active.forEach((product) => { statusCounts[statusOf(product, stockIndex)] += 1; });

  const periodLines = lines.filter((line) => isWithin(line.date, range));
  const entries = periodLines.filter((line) => line.type === 'IN');
  const exits = periodLines.filter((line) => line.type === 'OUT');
  const adjustments = periodLines.filter((line) => line.type === 'ADJUST');

  const totalValue = inventoryValue(products, stockIndex);
  const entriesValue = sum(entries, lineValue);
  const exitsValue = sum(exits, lineValue);
  const adjustmentValue = sum(adjustments, (line) => line.delta * (line.unitCost || 0));
  const averageValue = valueSeries?.length ? sum(valueSeries, (point) => point.value) / valueSeries.length : totalValue;
  const startValue = valueSeries?.[0]?.value ?? totalValue;
  const dailyExitValue = exitsValue / range.days;

  return {
    totalValue,
    valueChange: startValue ? (totalValue - startValue) / startValue : 0,
    activeProducts: active.length,
    productsWithStock: active.filter((product) => qtyOf(stockIndex, product.id) > 0).length,
    totalProducts: products.length,
    statusCounts,
    entriesValue,
    entriesCount: new Set(entries.map((line) => line.movementId)).size,
    exitsValue,
    exitsCount: new Set(exits.map((line) => line.movementId)).size,
    adjustmentValue,
    adjustmentsCount: adjustments.length,
    netFlow: entriesValue - exitsValue,
    rotation: averageValue ? (exitsValue / averageValue) * (365 / range.days) : 0,
    coverageDays: dailyExitValue > 0 ? totalValue / dailyExitValue : null,
  };
}

export function topMovedProducts({ products, lines, range, limit = 6 }) {
  const byProduct = new Map();
  lines.filter((line) => isWithin(line.date, range)).forEach((line) => {
    const entry = byProduct.get(line.productId) || { productId: line.productId, count: 0, value: 0, outQty: 0, inQty: 0 };
    entry.count += 1;
    entry.value += lineValue(line);
    if (line.delta < 0) entry.outQty += -line.delta; else entry.inQty += line.delta;
    byProduct.set(line.productId, entry);
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  return [...byProduct.values()]
    .filter((entry) => productMap.has(entry.productId))
    .sort((a, b) => b.count - a.count || b.value - a.value)
    .slice(0, limit)
    .map((entry) => ({ ...entry, product: productMap.get(entry.productId) }));
}

export function valueByCategory({ products, stockIndex, categories }) {
  const totals = new Map();
  products.forEach((product) => {
    const value = stockValue(qtyOf(stockIndex, product.id), product.unitCost);
    const entry = totals.get(product.categoryId) || { categoryId: product.categoryId, value: 0, skus: 0, units: 0 };
    entry.value += value;
    entry.skus += 1;
    totals.set(product.categoryId, entry);
  });
  const total = sum([...totals.values()], (entry) => entry.value) || 1;
  const names = new Map(categories.map((category) => [category.id, category.name]));
  return [...totals.values()]
    .map((entry) => ({ ...entry, name: names.get(entry.categoryId) || 'Sin categoría', share: entry.value / total }))
    .sort((a, b) => b.value - a.value);
}

/** Clasificación ABC por valor de consumo (Pareto 80/15/5). */
export function abcAnalysis({ products, lines, range }) {
  const consumption = new Map();
  lines.filter((line) => line.type === 'OUT' && isWithin(line.date, range)).forEach((line) => {
    consumption.set(line.productId, (consumption.get(line.productId) || 0) + lineValue(line));
  });
  const total = sum([...consumption.values()], (value) => value) || 1;
  let cumulative = 0;
  const rows = products
    .map((product) => ({ product, value: consumption.get(product.id) || 0 }))
    .sort((a, b) => b.value - a.value)
    .map((row) => {
      const previous = cumulative;
      cumulative += row.value / total;
      const klass = row.value === 0 ? 'C' : previous < 0.8 ? 'A' : previous < 0.95 ? 'B' : 'C';
      return { ...row, share: row.value / total, cumulative, class: klass };
    });
  const summary = ['A', 'B', 'C'].map((klass) => {
    const group = rows.filter((row) => row.class === klass);
    return { class: klass, count: group.length, value: sum(group, (row) => row.value), share: sum(group, (row) => row.share) };
  });
  return { rows, summary, total: total === 1 && !consumption.size ? 0 : total };
}

/** Rotación, cobertura e inventario inmovilizado por producto. */
export function rotationAnalysis({ products, stockIndex, lines, range }) {
  const stats = new Map();
  lines.forEach((line) => {
    const entry = stats.get(line.productId) || { outQty: 0, outValue: 0, lastMovement: null };
    if (isWithin(line.date, range) && line.type === 'OUT') {
      entry.outQty += Math.abs(line.delta);
      entry.outValue += lineValue(line);
    }
    if (!entry.lastMovement || line.date > entry.lastMovement) entry.lastMovement = line.date;
    stats.set(line.productId, entry);
  });
  return products.map((product) => {
    const quantity = qtyOf(stockIndex, product.id);
    const value = stockValue(quantity, product.unitCost);
    const entry = stats.get(product.id) || { outQty: 0, outValue: 0, lastMovement: null };
    const dailyUse = entry.outQty / range.days;
    const idleDays = entry.lastMovement ? Math.floor((Date.now() - new Date(entry.lastMovement).getTime()) / DAY_MS) : null;
    return {
      product,
      quantity,
      value,
      consumption: entry.outQty,
      consumptionValue: entry.outValue,
      dailyUse,
      coverageDays: dailyUse > 0 ? quantity / dailyUse : null,
      rotation: value > 0 ? (entry.outValue / value) * (365 / range.days) : 0,
      lastMovement: entry.lastMovement,
      idleDays,
      isDead: quantity > 0 && entry.outQty === 0,
    };
  });
}

const SEVERITY = { out: 0, coverage: 1, low: 2, over: 3, blocked: 4 };

export function buildAlerts({ products, stockIndex, rotation, coverageAlertDays = 7 }) {
  const rotationMap = new Map((rotation || []).map((row) => [row.product.id, row]));
  const alerts = [];
  products.filter((product) => product.status === 'active').forEach((product) => {
    const status = statusOf(product, stockIndex);
    const quantity = qtyOf(stockIndex, product.id);
    const coverage = rotationMap.get(product.id)?.coverageDays;
    if (status === 'out') alerts.push({ kind: 'out', tone: 'danger', product, quantity, message: 'Sin existencias' });
    else if (status === 'low') alerts.push({ kind: 'low', tone: 'warning', product, quantity, message: `Bajo el mínimo (${product.minStock} ${product.unit})` });
    else if (status === 'available' && coverage !== null && coverage !== undefined && coverage < coverageAlertDays) {
      alerts.push({ kind: 'coverage', tone: 'warning', product, quantity, message: `Cobertura estimada: ${Math.max(1, Math.round(coverage))} días` });
    } else if (status === 'over') alerts.push({ kind: 'over', tone: 'info', product, quantity, message: `Supera el máximo (${product.maxStock} ${product.unit})` });
    else if (status === 'blocked') alerts.push({ kind: 'blocked', tone: 'neutral', product, quantity, message: 'Bloqueado (retención de calidad)' });
  });
  return alerts.sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind]);
}

/** Hallazgos automáticos en lenguaje natural para la toma de decisiones. */
export function buildInsights({ kpis, rotation, abc, alerts, format }) {
  const insights = [];
  if (kpis.exitsValue > 0 || kpis.entriesValue > 0) {
    const ratio = kpis.entriesValue ? kpis.exitsValue / kpis.entriesValue : null;
    if (ratio !== null && ratio > 1.1) insights.push({ tone: 'warning', text: `Las salidas superan a las entradas en ${format.percent(ratio - 1)}: el inventario se está consumiendo más rápido de lo que se repone.` });
    else if (ratio !== null && ratio < 0.9) insights.push({ tone: 'info', text: `Las entradas superan a las salidas en ${format.percent(1 / ratio - 1)}: revisa si las compras están generando sobre stock.` });
    else insights.push({ tone: 'success', text: 'Entradas y salidas están equilibradas en el período.' });
  }
  const outAlerts = alerts.filter((alert) => alert.kind === 'out');
  if (outAlerts.length) {
    const outIds = new Set(outAlerts.map((alert) => alert.product.id));
    const impact = abc.rows.filter((row) => outIds.has(row.product.id)).reduce((total, row) => total + row.share, 0);
    insights.push({ tone: 'danger', text: `${outAlerts.length} producto(s) agotado(s) representan ${format.percent(impact)} del consumo del período: priorizar reposición.` });
  }
  const dead = rotation.filter((row) => row.isDead);
  if (dead.length) {
    const deadValue = dead.reduce((total, row) => total + row.value, 0);
    insights.push({ tone: 'warning', text: `${dead.length} producto(s) sin consumo en el período inmovilizan ${format.currency(deadValue)}.` });
  }
  const classA = abc.summary.find((item) => item.class === 'A');
  if (classA?.count) insights.push({ tone: 'info', text: `${classA.count} productos (clase A) concentran ${format.percent(classA.share)} del valor consumido: foco de control y conteo cíclico.` });
  if (kpis.coverageDays !== null) insights.push({ tone: kpis.coverageDays < 15 ? 'warning' : 'success', text: `Con el ritmo actual de consumo, el inventario cubre ≈ ${Math.round(kpis.coverageDays)} días de operación.` });
  return insights;
}
