/**
 * Fábrica de servicios CRUD con la misma interfaz que tendrá el cliente REST:
 * getAll · getById · create · update · remove · setActive
 * Aplica: autorización, normalización, validación, auditoría y escritura atómica.
 */
import { db } from '../core/storage.js';
import { bus, EVENTS } from '../core/events.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../core/errors.js';
import { assertPermission } from '../utils/permissions.js';
import { uid } from '../utils/id.js';
import { appendAudit, buildAuditEntry } from './auditService.js';
import { clone, nowISO, simulateNetwork } from './http.js';

export function createCrudService({
  collection, entity, label, idPrefix, auditPrefix,
  permissions = {}, normalize = (data) => data, validate = () => ({ valid: true, errors: {} }),
  beforeRemove = () => null, sortBy = 'name',
}) {
  const rows = () => db.get(collection);
  const findOrThrow = (id) => {
    const row = rows().find((item) => item.id === id);
    if (!row) throw new NotFoundError(label);
    return row;
  };
  const emit = (action, id) => bus.emit(EVENTS.DATA_CHANGED, { entity, action, id });

  return {
    async getAll() {
      await simulateNetwork();
      if (permissions.view) assertPermission(permissions.view);
      return clone(rows()).sort((a, b) => String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'es', { numeric: true }));
    },

    async getById(id) {
      await simulateNetwork(0.5);
      if (permissions.view) assertPermission(permissions.view);
      return clone(findOrThrow(id));
    },

    async create(input) {
      await simulateNetwork(1.2);
      assertPermission(permissions.manage);
      const data = normalize(input);
      const { valid, errors } = validate(data, { existing: rows() });
      if (!valid) throw new ValidationError(errors);
      const timestamp = nowISO();
      const row = { id: uid(idPrefix), ...data, createdAt: timestamp, updatedAt: timestamp };
      db.commit({
        [collection]: [...rows(), row],
        auditLogs: appendAudit(buildAuditEntry({ action: `${auditPrefix}_CREATED`, entity, entityId: row.id, after: row })),
      });
      emit('created', row.id);
      return clone(row);
    },

    async update(id, input) {
      await simulateNetwork(1.2);
      assertPermission(permissions.manage);
      const before = findOrThrow(id);
      const data = normalize({ ...before, ...input });
      const { valid, errors } = validate(data, { existing: rows(), id, before });
      if (!valid) throw new ValidationError(errors);
      const after = { ...before, ...data, id, createdAt: before.createdAt, updatedAt: nowISO() };
      db.commit({
        [collection]: rows().map((item) => (item.id === id ? after : item)),
        auditLogs: appendAudit(buildAuditEntry({ action: `${auditPrefix}_UPDATED`, entity, entityId: id, before, after })),
      });
      emit('updated', id);
      return clone(after);
    },

    async setActive(id, active) {
      return this.update(id, { active: Boolean(active) });
    },

    async remove(id) {
      await simulateNetwork(1.2);
      assertPermission(permissions.manage);
      const before = findOrThrow(id);
      const blocker = beforeRemove(before);
      if (blocker) throw new BusinessRuleError(blocker);
      db.commit({
        [collection]: rows().filter((item) => item.id !== id),
        auditLogs: appendAudit(buildAuditEntry({ action: `${auditPrefix}_DELETED`, entity, entityId: id, before })),
      });
      emit('deleted', id);
      return true;
    },
  };
}
