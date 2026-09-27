import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { HealthController } from './health.controller';

function fakePrisma(queryRaw: jest.Mock): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

describe('HealthController', () => {
  it('returns 200 ok/ok when the database check succeeds', async () => {
    const controller = new HealthController(fakePrisma(jest.fn().mockResolvedValue([{ '?column?': 1 }])));

    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', database: 'ok' });
  });

  it('throws a 503 with database: error when the database check fails', async () => {
    const controller = new HealthController(fakePrisma(jest.fn().mockRejectedValue(new Error('connection refused'))));

    await expect(controller.check()).rejects.toThrow(HttpException);
    try {
      await controller.check();
      throw new Error('expected check() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      if (e instanceof HttpException) {
        expect(e.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(e.getResponse()).toEqual({ status: 'ok', database: 'error' });
      }
    }
  });
});
