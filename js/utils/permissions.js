/**
 * Punto único de autorización en la UI.
 * La UI lo usa para mostrar/ocultar acciones; los servicios lo usan para rechazar operaciones
 * (simulando la autorización que en producción haría el backend).
 */
import { appStore } from '../core/store.js';
import { roleHasPermission } from '../domain/access.js';
import { PermissionError } from '../core/errors.js';

export function hasPermission(permission) {
  if (!permission) return true;
  const { session } = appStore.getState();
  return Boolean(session?.role) && roleHasPermission(session.role, permission);
}

export function assertPermission(permission) {
  if (!hasPermission(permission)) {
    throw new PermissionError(`No tienes permiso para realizar esta acción (${permission}).`);
  }
}
