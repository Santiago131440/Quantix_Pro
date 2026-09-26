/** Usuarios, roles y autenticación simulada. */
import { db } from '../core/storage.js';
import { appStore } from '../core/store.js';
import { bus, EVENTS } from '../core/events.js';
import { BusinessRuleError, ValidationError } from '../core/errors.js';
import { APP } from '../config/constants.js';
import { ALL_PERMISSIONS } from '../config/permissions.js';
import { rules, validate, sanitizeText } from '../utils/validators.js';
import { uid } from '../utils/id.js';
import { createCrudService } from './crudService.js';
import { buildAuditEntry, appendAudit } from './auditService.js';
import { simulateNetwork, clone } from './http.js';

const currentUserId = () => appStore.getState().session?.user?.id;

export const userService = createCrudService({
  collection: 'users', entity: 'user', label: 'Usuario', idPrefix: 'usr', auditPrefix: 'USER',
  permissions: { view: 'users.view', manage: 'users.manage' },
  normalize: (data) => ({
    name: sanitizeText(data.name, 80), email: sanitizeText(data.email, 120).toLowerCase(), roleId: data.roleId || '',
    warehouseId: data.warehouseId || '', active: data.active !== false && data.active !== 'false',
  }),
  validate: (data, { existing, id, before }) => {
    const { errors } = validate(data, { name: [rules.required(), rules.minLength(3)], email: [rules.required(), rules.email()], roleId: [rules.required('Selecciona un rol.')] });
    if (!errors.email && existing.some((user) => user.id !== id && user.email === data.email)) errors.email = 'El correo ya está registrado.';
    if (id && id === currentUserId() && before) {
      if (!data.active) errors.active = 'No puedes desactivar tu propio usuario.';
      if (data.roleId !== before.roleId) errors.roleId = 'No puedes cambiar tu propio rol.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  },
  beforeRemove: (user) => {
    if (user.id === currentUserId()) return 'No puedes eliminar tu propio usuario.';
    if (db.get('movements').some((movement) => movement.userId === user.id)) return 'El usuario tiene movimientos registrados (trazabilidad). Desactívalo en su lugar.';
    return null;
  },
});

export const roleService = createCrudService({
  collection: 'roles', entity: 'role', label: 'Rol', idPrefix: 'role', auditPrefix: 'ROLE',
  permissions: { manage: 'users.manage' },
  normalize: (data) => ({
    name: sanitizeText(data.name, 40), description: sanitizeText(data.description, 200),
    permissions: data.permissions?.includes('*') ? ['*'] : [...new Set((data.permissions || []).filter((key) => ALL_PERMISSIONS.includes(key)))],
    system: Boolean(data.system), active: data.active !== false,
  }),
  validate: (data, { existing, id, before }) => {
    const { errors } = validate(data, { name: [rules.required(), rules.minLength(3)] });
    if (!errors.name && existing.some((role) => role.id !== id && role.name.toLowerCase() === data.name.toLowerCase())) errors.name = 'Ya existe un rol con este nombre.';
    if (before?.permissions?.includes('*') && !data.permissions.includes('*')) errors.permissions = 'El rol Administrador conserva acceso total.';
    return { valid: Object.keys(errors).length === 0, errors };
  },
  beforeRemove: (role) => {
    if (role.system) return 'Los roles del sistema no se pueden eliminar.';
    if (db.get('users').some((user) => user.roleId === role.id)) return 'Hay usuarios con este rol.';
    return null;
  },
});

/* ---------------------------------------------------------------------------
 * Autenticación SIMULADA. No es segura para producción:
 * - La contraseña demo está en el código y no se guarda en ningún almacenamiento.
 * - El "token" es un identificador aleatorio sin firma.
 * En producción: login contra API, JWT/OAuth firmado por el servidor, cookie httpOnly.
 * ------------------------------------------------------------------------- */
const SESSION_TTL_MS = 8 * 3_600_000;

function buildSession(user) {
  const role = db.get('roles').find((item) => item.id === user.roleId);
  if (!role || role.active === false) throw new BusinessRuleError('El rol del usuario no está disponible.');
  return { user: clone(user), role: clone(role) };
}

export const authService = {
  async login(email, password) {
    await simulateNetwork(2);
    const normalized = sanitizeText(email, 120).toLowerCase();
    const user = db.get('users').find((item) => item.email === normalized);
    if (!user || password !== APP.demoPassword) throw new ValidationError({ password: 'Correo o contraseña incorrectos.' }, 'Credenciales inválidas.');
    if (!user.active) throw new BusinessRuleError('El usuario está inactivo. Contacta al administrador.');
    const session = { ...buildSession(user), token: `demo.${uid('tok')}` };
    db.setValue('session', { userId: user.id, token: session.token, expiresAt: Date.now() + SESSION_TTL_MS });
    appStore.setState({ session });
    db.set('auditLogs', appendAudit(buildAuditEntry({ action: 'LOGIN', entity: 'session', entityId: user.id })));
    bus.emit(EVENTS.SESSION_CHANGED, session);
    return session;
  },

  restore() {
    const stored = db.getValue('session');
    if (!stored || stored.expiresAt < Date.now()) { db.setValue('session', null); return null; }
    const user = db.get('users').find((item) => item.id === stored.userId && item.active);
    if (!user) return null;
    try {
      const session = { ...buildSession(user), token: stored.token };
      appStore.setState({ session });
      return session;
    } catch { return null; }
  },

  /** Recalcula permisos tras editar roles o el propio usuario. */
  refresh() {
    const session = appStore.getState().session;
    if (!session) return;
    const user = db.get('users').find((item) => item.id === session.user.id);
    if (!user?.active) { this.logout(); return; }
    appStore.setState({ session: { ...buildSession(user), token: session.token } });
    bus.emit(EVENTS.SESSION_CHANGED, appStore.getState().session);
  },

  logout() {
    if (appStore.getState().session) db.set('auditLogs', appendAudit(buildAuditEntry({ action: 'LOGOUT', entity: 'session', entityId: currentUserId() })));
    db.setValue('session', null);
    appStore.setState({ session: null });
    bus.emit(EVENTS.SESSION_CHANGED, null);
  },

  getDemoUsers() {
    const roles = new Map(db.get('roles').map((role) => [role.id, role.name]));
    return db.get('users').filter((user) => user.active).map((user) => ({ ...user, roleName: roles.get(user.roleId) }));
  },
};
