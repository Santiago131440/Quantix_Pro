/** Punto de entrada único de servicios: las vistas importan desde aquí. */
export { productService } from './productService.js';
export { inventoryService } from './inventoryService.js';
export { movementService } from './movementService.js';
export { reportService } from './reportService.js';
export { exportService } from './exportService.js';
export { settingsService } from './settingsService.js';
export { auditService } from './auditService.js';
export { authService, userService, roleService } from './accessServices.js';
export { categoryService, warehouseService, locationService, supplierService } from './catalogServices.js';
