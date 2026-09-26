/** Categorías y subcategorías demo (parentId = null → categoría principal). */
const main = [
  ['cat-liq', 'Líquidos', 'Aceites, solventes y aditivos líquidos'],
  ['cat-sol', 'Sólidos', 'Resinas, pigmentos y sólidos a granel'],
  ['cat-gra', 'Granulados', 'Polímeros y fertilizantes granulados'],
  ['cat-mp', 'Materias primas', 'Químicos base y minerales'],
  ['cat-emp', 'Material de empaque', 'Envases, tapas, etiquetas y embalaje'],
  ['cat-pt', 'Producto terminado', 'Producto listo para despacho'],
  ['cat-rep', 'Repuestos', 'Repuestos mecánicos y eléctricos'],
  ['cat-ins', 'Insumos', 'Limpieza, EPP y laboratorio'],
];

const sub = [
  ['sub-aceites', 'cat-liq', 'Aceites y lubricantes'], ['sub-solventes', 'cat-liq', 'Solventes'], ['sub-aditivos', 'cat-liq', 'Aditivos líquidos'],
  ['sub-resinas', 'cat-sol', 'Resinas'], ['sub-pigmentos', 'cat-sol', 'Pigmentos'],
  ['sub-polimeros', 'cat-gra', 'Polímeros'], ['sub-fertilizantes', 'cat-gra', 'Fertilizantes granulados'],
  ['sub-quimicos', 'cat-mp', 'Químicos base'], ['sub-minerales', 'cat-mp', 'Minerales'], ['sub-alimentarios', 'cat-mp', 'Insumos alimentarios'],
  ['sub-envases', 'cat-emp', 'Envases y tapas'], ['sub-etiquetas', 'cat-emp', 'Etiquetas'], ['sub-embalaje', 'cat-emp', 'Embalaje'],
  ['sub-hogar', 'cat-pt', 'Línea hogar'], ['sub-agro', 'cat-pt', 'Línea agro'], ['sub-bebidas', 'cat-pt', 'Bebidas'],
  ['sub-mecanicos', 'cat-rep', 'Mecánicos'], ['sub-electricos', 'cat-rep', 'Eléctricos'],
  ['sub-limpieza', 'cat-ins', 'Limpieza'], ['sub-epp', 'cat-ins', 'EPP'], ['sub-laboratorio', 'cat-ins', 'Laboratorio'], ['sub-mantenimiento', 'cat-ins', 'Mantenimiento'],
];

export const categoriesSeed = [
  ...main.map(([id, name, description]) => ({ id, name, description, parentId: null, active: true })),
  ...sub.map(([id, parentId, name]) => ({ id, name, description: '', parentId, active: true })),
];
