export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

/** Errores de validación por campo: { fields: { campo: mensaje } } */
export class ValidationError extends AppError {
  constructor(fields, message = 'Revisa los campos marcados.') {
    super(message, { code: 'VALIDATION_ERROR', details: fields });
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Registro') { super(`${entity} no encontrado.`, { code: 'NOT_FOUND' }); }
}

export class PermissionError extends AppError {
  constructor(message = 'Acceso denegado.') { super(message, { code: 'FORBIDDEN' }); }
}

export class BusinessRuleError extends AppError {
  constructor(message, details) { super(message, { code: 'BUSINESS_RULE', details }); }
}

export class StorageError extends AppError {
  constructor(message = 'No fue posible guardar los datos en el almacenamiento local.') { super(message, { code: 'STORAGE_ERROR' }); }
}

export const errorMessage = (error) => (error instanceof AppError ? error.message : 'Ocurrió un error inesperado. Intenta de nuevo.');
