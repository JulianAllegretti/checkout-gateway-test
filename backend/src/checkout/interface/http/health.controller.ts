import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface HealthBody {
  readonly status: 'ok';
  readonly database: 'ok' | 'error';
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthBody> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new HttpException({ status: 'ok', database: 'error' } satisfies HealthBody, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
