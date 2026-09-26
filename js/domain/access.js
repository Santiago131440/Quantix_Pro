/** Regla pura de autorización basada en capacidades. */
export function roleHasPermission(role, permission) {
  if (!role || role.active === false) return false;
  const permissions = role.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}
