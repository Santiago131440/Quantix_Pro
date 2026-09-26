export const rolesSeed = [
  {
    id: 'role-admin', name: 'Administrador', description: 'Acceso total al sistema.', system: true, active: true, permissions: ['*'],
  },
  {
    id: 'role-supervisor', name: 'Supervisor', description: 'Consulta inventario, registra movimientos y ajustes, y consulta reportes.', system: true, active: true,
    permissions: ['products.view', 'products.create', 'products.edit', 'categories.manage', 'inventory.view', 'inventory.adjust', 'locations.manage',
      'movements.view', 'movements.create', 'suppliers.view', 'suppliers.manage', 'users.view', 'audit.view', 'reports.view', 'reports.export'],
  },
  {
    id: 'role-operator', name: 'Operador', description: 'Registra entradas y salidas autorizadas.', system: true, active: true,
    permissions: ['products.view', 'inventory.view', 'movements.view', 'movements.create', 'suppliers.view'],
  },
  {
    id: 'role-viewer', name: 'Consulta', description: 'Solo lectura.', system: true, active: true,
    permissions: ['products.view', 'inventory.view', 'movements.view', 'suppliers.view', 'reports.view'],
  },
];
