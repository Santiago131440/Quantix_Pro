import { db } from '../core/storage.js';
import { appStore } from '../core/store.js';
import { assertPermission } from '../utils/permissions.js';
import { uid } from '../utils/id.js';
import { clone, nowISO, simulateNetwork } from './http.js';

const MAX_LOGS = 5000; // Límite de la demo para no saturar LocalStorage (el backend no tendría este límite).

export const currentUserId = () => appStore.getState().session?.user?.id || 'system';

/** Crea una entrada de auditoría (no la persiste). */
export function buildAuditEntry({ action, entity, entityId = null, before = null, after = null }) {
  return { id: uid('aud'), action, entity, entityId, userId: currentUserId(), date: nowISO(), before: before ? clone(before) : null, after: after ? clone(after) : null };
}

/** Devuelve la colección de auditoría con las nuevas entradas agregadas (para usar dentro de db.commit). */
export function appendAudit(...entries) {
  const logs = [...db.get('auditLogs'), ...entries];
  return logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs;
}

export const auditService = {
  log(entry) {
    db.set('auditLogs', appendAudit(buildAuditEntry(entry)));
  },
  async list() {
    await simulateNetwork();
    assertPermission('audit.view');
    const users = new Map(db.get('users').map((user) => [user.id, user.name]));
    return db.get('auditLogs')
      .map((log, index) => ({ ...log, index, userName: users.get(log.userId) || (log.userId === 'system' ? 'Sistema' : 'Usuario eliminado') }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);
  },
};
