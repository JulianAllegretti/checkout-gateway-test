import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface HealthBody {
  readonly status: 'ok';
  readonly database: 'ok' | 'error';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe. Outside /api and unauthenticated — see ADR 0001.' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok', database: 'ok' } } })
  @ApiResponse({ status: 503, schema: { example: { status: 'ok', database: 'error' } } })
  async check(): Promise<HealthBody> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new HttpException({ status: 'ok', database: 'error' } satisfies HealthBody, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
