/** Proveedores ficticios (sin datos reales). */
export const suppliersSeed = [
  ['sup-nova', 'Química Nova Industrial', 'TX-100241', 'Elena Ríos', 'ventas@quimicanova.demo', '+00 600 100 241', 7],
  ['sup-delta', 'Polímeros Delta', 'TX-100377', 'Martín Ochoa', 'comercial@polimerosdelta.demo', '+00 600 100 377', 10],
  ['sup-orbital', 'Envases Orbital', 'TX-100518', 'Paula Serna', 'pedidos@envasesorbital.demo', '+00 600 100 518', 5],
  ['sup-vertice', 'Lubricantes Vértice', 'TX-100662', 'Iván Correa', 'contacto@vertice.demo', '+00 600 100 662', 6],
  ['sup-atlas', 'Suministros Técnicos Atlas', 'TX-100709', 'Sofía Luna', 'soporte@atlastec.demo', '+00 600 100 709', 12],
  ['sup-prisma', 'Etiquetas Prisma', 'TX-100835', 'Diego Mora', 'hola@prisma.demo', '+00 600 100 835', 8],
  ['sup-sierra', 'Minerales Sierra Alta', 'TX-100912', 'Ana Beltrán', 'ventas@sierraalta.demo', '+00 600 100 912', 15],
  ['sup-interna', 'Producción interna', 'INT-000001', 'Jefatura de planta', 'planta@inventra.demo', '—', 1],
].map(([id, name, taxId, contact, email, phone, leadTimeDays]) => ({ id, name, taxId, contact, email, phone, leadTimeDays, active: true }));
