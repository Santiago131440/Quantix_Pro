/** Usuarios ficticios. No se almacenan contraseñas (autenticación simulada). */
export const usersSeed = [
  ['usr-admin', 'Laura Méndez', 'admin@inventra.demo', 'role-admin', 'wh-alm'],
  ['usr-super', 'Carlos Ruiz', 'supervisor@inventra.demo', 'role-supervisor', 'wh-pro'],
  ['usr-oper', 'Andrea Gómez', 'operador@inventra.demo', 'role-operator', 'wh-alm'],
  ['usr-oper2', 'Julián Pardo', 'julian.pardo@inventra.demo', 'role-operator', 'wh-des'],
  ['usr-view', 'María Torres', 'consulta@inventra.demo', 'role-viewer', 'wh-alm'],
  ['usr-inactive', 'Pedro Salas', 'pedro.salas@inventra.demo', 'role-operator', 'wh-man', false],
].map(([id, name, email, roleId, warehouseId, active = true]) => ({ id, name, email, roleId, warehouseId, active }));
