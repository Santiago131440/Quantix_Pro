/** Configuración, inicialización de datos demo, respaldo e importación. */
import { db } from '../core/storage.js';
import { appStore } from '../core/store.js';
import { bus, EVENTS } from '../core/events.js';
import { ValidationError } from '../core/errors.js';
import { APP, CURRENCIES, DEFAULT_SETTINGS } from '../config/constants.js';
import { buildSeedData } from '../data/seed.js';
import { assertPermission } from '../utils/permissions.js';
import { configureFormatters } from '../utils/formatters.js';
import { sanitizeText } from '../utils/validators.js';
import { appendAudit, buildAuditEntry } from './auditService.js';
import { setLatency, simulateNetwork } from './http.js';

export const COLLECTIONS = ['categories', 'warehouses', 'locations', 'suppliers', 'roles', 'users', 'products', 'inventory', 'movements', 'movementDetails', 'auditLogs'];

function applySettings(settings) {
  configureFormatters({ currency: settings.currency });
  setLatency(settings.simulateLatency ? 260 : 0);
  appStore.setState({ settings });
}

function writeDataset(data) {
  const changes = Object.fromEntries(COLLECTIONS.map((key) => [key, data[key] || []]));
  db.commit({ ...changes, counters: data.counters || { IN: 0, OUT: 0, ADJUST: 0 }, meta: { dataVersion: APP.dataVersion, seededAt: new Date().toISOString() } });
}

export const settingsService = {
  /** Carga datos demo si el almacenamiento está vacío o proviene de una versión anterior. */
  init() {
    const meta = db.getValue('meta');
    if (!meta || meta.dataVersion !== APP.dataVersion) {
      writeDataset(buildSeedData());
      db.setValue('settings', { ...DEFAULT_SETTINGS });
    }
    applySettings({ ...DEFAULT_SETTINGS, ...db.getValue('settings', {}) });
  },

  get() { return { ...DEFAULT_SETTINGS, ...db.getValue('settings', {}) }; },

  async update(patch) {
    await simulateNetwork();
    assertPermission('settings.manage');
    const before = this.get();
    const errors = {};
    const next = { ...before };
    if ('companyName' in patch) {
      next.companyName = sanitizeText(patch.companyName, 80);
      if (next.companyName.length < 2) errors.companyName = 'Ingresa el nombre de la empresa.';
    }
    if ('currency' in patch) {
      if (!CURRENCIES.includes(patch.currency)) errors.currency = 'Moneda no soportada.';
      next.currency = patch.currency;
    }
    if ('pageSize' in patch) next.pageSize = [10, 20, 50].includes(Number(patch.pageSize)) ? Number(patch.pageSize) : 10;
    if ('defaultPeriod' in patch) next.defaultPeriod = [7, 30, 90].includes(Number(patch.defaultPeriod)) ? Number(patch.defaultPeriod) : 30;
    if ('coverageAlertDays' in patch) {
      next.coverageAlertDays = Number(patch.coverageAlertDays);
      if (!Number.isInteger(next.coverageAlertDays) || next.coverageAlertDays < 1 || next.coverageAlertDays > 90) errors.coverageAlertDays = 'Entre 1 y 90 días.';
    }
    if ('simulateLatency' in patch) next.simulateLatency = Boolean(patch.simulateLatency);
    if (Object.keys(errors).length) throw new ValidationError(errors);
    db.commit({ settings: next, auditLogs: appendAudit(buildAuditEntry({ action: 'SETTINGS_UPDATED', entity: 'settings', before, after: next })) });
    applySettings(next);
    bus.emit(EVENTS.SETTINGS_CHANGED, next);
    bus.emit(EVENTS.DATA_CHANGED, { entity: 'settings' });
    return next;
  },

  exportBackup() {
    assertPermission('settings.manage');
    const backup = { app: APP.name, dataVersion: APP.dataVersion, exportedAt: new Date().toISOString(), settings: this.get(), counters: db.getValue('counters') };
    COLLECTIONS.forEach((key) => { backup[key] = db.get(key); });
    return backup;
  },

  async importBackup(backup) {
    await simulateNetwork(2);
    assertPermission('settings.manage');
    const valid = backup && backup.app === APP.name && COLLECTIONS.every((key) => Array.isArray(backup[key]));
    if (!valid) throw new ValidationError({ file: 'El archivo no es un respaldo válido de Inventra.' });
    const sessionUser = appStore.getState().session?.user;
    writeDataset(backup);
    db.setValue('settings', { ...DEFAULT_SETTINGS, ...backup.settings });
    db.set('auditLogs', appendAudit(buildAuditEntry({ action: 'DATA_IMPORTED', entity: 'system', after: { products: backup.products.length, by: sessionUser?.name } })));
    applySettings(this.get());
    bus.emit(EVENTS.DATA_CHANGED, { entity: 'all' });
  },

  async resetDemoData() {
    await simulateNetwork(2);
    assertPermission('settings.manage');
    writeDataset(buildSeedData());
    db.setValue('settings', { ...DEFAULT_SETTINGS });
    db.set('auditLogs', appendAudit(buildAuditEntry({ action: 'DATA_RESET', entity: 'system' })));
    applySettings(this.get());
    bus.emit(EVENTS.DATA_CHANGED, { entity: 'all' });
  },
};
