/** Reportes y dashboard: orquesta datos + analítica pura del dominio. */
import { db } from '../core/storage.js';
import { appStore } from '../core/store.js';
import { assertPermission } from '../utils/permissions.js';
import { periodRange } from '../utils/dates.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';
import {
  abcAnalysis, buildAlerts, buildFlowSeries, buildInsights, buildValueSeries, computeKpis, rotationAnalysis, topMovedProducts, valueByCategory,
} from '../domain/analytics.js';
import { getStockIndex, getOverviewRows } from './inventoryService.js';
import { getHistoryRows, getMovementLines } from './movementService.js';
import { clone, simulateNetwork } from './http.js';

function context(days) {
  return {
    products: db.get('products'),
    categories: db.get('categories'),
    stockIndex: getStockIndex(),
    lines: getMovementLines(),
    range: periodRange(days),
  };
}

export const reportService = {
  async getDashboard(days = 30) {
    await simulateNetwork(1.5);
    const { products, categories, stockIndex, lines, range } = context(days);
    const valueSeries = buildValueSeries({ products, stockIndex, lines, range });
    const kpis = computeKpis({ products, stockIndex, lines, range, valueSeries });
    const rotation = rotationAnalysis({ products, stockIndex, lines, range });
    const abc = abcAnalysis({ products, lines, range });
    const coverageAlertDays = appStore.getState().settings?.coverageAlertDays ?? 7;
    const alerts = buildAlerts({ products, stockIndex, rotation, coverageAlertDays });
    const overview = new Map(getOverviewRows().map((row) => [row.id, row]));
    return clone({
      range,
      kpis,
      valueSeries,
      flowSeries: buildFlowSeries({ lines, range, bucket: days > 31 ? 'week' : 'day' }),
      byCategory: valueByCategory({ products, stockIndex, categories: categories.filter((category) => !category.parentId) }),
      topMoved: topMovedProducts({ products, lines, range, limit: 6 }),
      alerts: alerts.map((alert) => ({ ...alert, product: overview.get(alert.product.id) })),
      insights: buildInsights({ kpis, rotation, abc, alerts, format: { percent: (value) => formatPercent(value, 0), currency: (value) => formatCurrency(value, { compact: true }) } }),
      recent: getHistoryRows().slice(0, 8),
      critical: [...overview.values()]
        .filter((row) => row.status === 'active' && ['out', 'low'].includes(row.stockStatus))
        .sort((a, b) => a.quantity / (a.minStock || 1) - b.quantity / (b.minStock || 1)),
    });
  },

  async getValuation() {
    await simulateNetwork();
    assertPermission('reports.view');
    const { products, categories, stockIndex } = context(30);
    return clone(valueByCategory({ products, stockIndex, categories: categories.filter((category) => !category.parentId) }));
  },

  async getAbc(days = 90) {
    await simulateNetwork();
    assertPermission('reports.view');
    const { products, lines, range } = context(days);
    return clone(abcAnalysis({ products: products.filter((product) => product.status === 'active'), lines, range }));
  },

  async getRotation(days = 90) {
    await simulateNetwork();
    assertPermission('reports.view');
    const { products, stockIndex, lines, range } = context(days);
    return clone(rotationAnalysis({ products: products.filter((product) => product.status === 'active'), stockIndex, lines, range }));
  },

  async getMovementSummary(days = 30) {
    await simulateNetwork();
    assertPermission('reports.view');
    const { range } = context(days);
    const groups = new Map();
    getHistoryRows().filter((row) => row.date >= range.from.toISOString()).forEach((row) => {
      const key = `${row.type}|${row.reason}`;
      const entry = groups.get(key) || { type: row.type, reason: row.reason, reasonLabel: row.reasonLabel, count: 0, value: 0, products: new Set() };
      entry.count += 1;
      entry.value += row.value;
      entry.products.add(row.productId);
      groups.set(key, entry);
    });
    return [...groups.values()].map((entry) => ({ ...entry, products: entry.products.size })).sort((a, b) => b.value - a.value);
  },

  /** Kardex: libro de movimientos de un producto con saldo corrido. */
  async getKardex(productId) {
    await simulateNetwork();
    assertPermission('reports.view');
    const rows = getHistoryRows().filter((row) => row.productId === productId).slice().reverse();
    let balance = 0;
    return clone(rows.map((row) => { balance += row.delta; return { ...row, balance }; }).reverse());
  },
};
