export const locationsSeed = [
  ['loc-alm-a01', 'wh-alm', 'ALM-A-01', 'Rack A · Nivel 1'],
  ['loc-alm-a02', 'wh-alm', 'ALM-A-02', 'Rack A · Nivel 2'],
  ['loc-alm-b01', 'wh-alm', 'ALM-B-01', 'Rack B · Empaque'],
  ['loc-alm-c01', 'wh-alm', 'ALM-C-01', 'Zona químicos'],
  ['loc-alm-e01', 'wh-alm', 'ALM-E-01', 'Estantería insumos'],
  ['loc-pro-silo', 'wh-pro', 'PRO-SILO', 'Silos de granulados'],
  ['loc-pro-l1', 'wh-pro', 'PRO-L1', 'Línea 1 · Mezclas'],
  ['loc-pro-l2', 'wh-pro', 'PRO-L2', 'Línea 2 · Envasado'],
  ['loc-des-p1', 'wh-des', 'DES-P1', 'Patio despacho 1'],
  ['loc-des-p2', 'wh-des', 'DES-P2', 'Patio despacho 2'],
  ['loc-man-r1', 'wh-man', 'MAN-R1', 'Estantería repuestos'],
  ['loc-man-l1', 'wh-man', 'MAN-L1', 'Cuarto de lubricantes'],
].map(([id, warehouseId, code, name]) => ({ id, warehouseId, code, name, active: true }));
