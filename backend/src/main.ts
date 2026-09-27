import 'dotenv/config';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './checkout/interface/http/validation-exception.factory';
import { SentryExceptionFilter } from './shared/sentry/sentry-exception.filter';
import { initSentry } from './shared/sentry/sentry.bootstrap';

async function bootstrap() {
  initSentry();

  // bufferLogs holds onto anything logged before useLogger() runs below, so
  // early Nest bootstrap logs go through pino too instead of the console.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useGlobalFilters(new SentryExceptionFilter());
  // /health stays unauthenticated and outside /api — CloudFront's healthcheck and
  // the deploy script hit it directly (see ADR 0001 / API-CONTRACT.md).
  app.setGlobalPrefix('api', { exclude: [{ path: 'health', method: RequestMethod.GET }] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
