import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Nest's ValidationPipe throws its own default shape on a failed DTO check,
 * bypassing http-error.mapper.ts entirely (it never reaches a controller/port).
 * This factory makes that failure conform to the same error envelope as every
 * other error (see API-CONTRACT.md), with field-level messages in `details`.
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    errorCode: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: flattenErrors(errors),
  });
}

function flattenErrors(errors: ValidationError[], parentPath = ''): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      result[path] = Object.values(error.constraints);
    }
    if (error.children && error.children.length > 0) {
      Object.assign(result, flattenErrors(error.children, path));
    }
  }

  return result;
}
