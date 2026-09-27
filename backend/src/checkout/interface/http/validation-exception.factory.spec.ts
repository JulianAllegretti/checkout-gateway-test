import type { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory';

function buildError(overrides: Partial<ValidationError>): ValidationError {
  return { property: 'field', constraints: undefined, children: [], ...overrides } as ValidationError;
}

describe('validationExceptionFactory', () => {
  it('wraps flat field errors into the standard envelope', () => {
    const exception = validationExceptionFactory([
      buildError({ property: 'quantity', constraints: { min: 'quantity must not be less than 1' } }),
    ]);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: { quantity: ['quantity must not be less than 1'] },
    });
  });

  it('flattens nested (ValidateNested) child errors with a dotted path', () => {
    const exception = validationExceptionFactory([
      buildError({
        property: 'customer',
        constraints: undefined,
        children: [buildError({ property: 'email', constraints: { isEmail: 'email must be an email' } })],
      }),
    ]);

    const details = (exception.getResponse() as { details: Record<string, string[]> }).details;
    expect(details['customer.email']).toEqual(['email must be an email']);
  });

  it('collects multiple constraint messages for the same field', () => {
    const exception = validationExceptionFactory([
      buildError({
        property: 'cardToken',
        constraints: { isString: 'cardToken must be a string', minLength: 'cardToken must be longer than or equal to 1 characters' },
      }),
    ]);

    const details = (exception.getResponse() as { details: Record<string, string[]> }).details;
    expect(details.cardToken).toHaveLength(2);
  });
});
