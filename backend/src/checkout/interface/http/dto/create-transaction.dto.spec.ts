import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

function validPayload(): Record<string, unknown> {
  return {
    idempotencyKey: '6c1f6e2e-1b3a-4b3a-9b3a-1b3a4b3a9b3a',
    productId: 'b3f1c2a0-1b3a-4b3a-9b3a-1b3a4b3a9b3a',
    quantity: 2,
    cardToken: 'tok_test',
    paymentAcceptanceToken: 'accept_token',
    personalDataAuthToken: 'accept_personal_token',
    customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '+573001234567' },
    delivery: { address: 'Calle 123', city: 'Bogotá' },
  };
}

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateTransactionDto, payload);
  return validate(dto);
}

describe('CreateTransactionDto', () => {
  it('accepts a well-formed payload', async () => {
    const errors = await validateDto(validPayload());
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID idempotencyKey', async () => {
    const errors = await validateDto({ ...validPayload(), idempotencyKey: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
  });

  it('rejects a non-integer or non-positive quantity', async () => {
    for (const quantity of [0, -1, 1.5]) {
      const errors = await validateDto({ ...validPayload(), quantity });
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
    }
  });

  it('rejects an invalid customer email', async () => {
    const payload = validPayload();
    const errors = await validateDto({ ...payload, customer: { ...(payload.customer as object), email: 'not-an-email' } });
    expect(errors.some((e) => e.property === 'customer')).toBe(true);
  });

  it('rejects a missing delivery.address', async () => {
    const payload = validPayload();
    const { address: _address, ...deliveryWithoutAddress } = payload.delivery as Record<string, unknown>;
    const errors = await validateDto({ ...payload, delivery: deliveryWithoutAddress });
    expect(errors.some((e) => e.property === 'delivery')).toBe(true);
  });

  it('accepts delivery without the optional region/postalCode/notes', async () => {
    const errors = await validateDto(validPayload());
    expect(errors).toHaveLength(0);
  });
});
