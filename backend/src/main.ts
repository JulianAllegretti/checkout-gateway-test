import 'dotenv/config';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Generated straight from the DTOs/controllers below, not hand-maintained —
  // see API-CONTRACT.md for the narrative version. SwaggerModule.setup mounts
  // directly on the HTTP adapter, bypassing setGlobalPrefix, so 'api/docs' is
  // spelled out in full rather than relying on the prefix to apply here too.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Checkout API')
    .setDescription(
      'Checkout flow: create a transaction, charge a card via the payment gateway sandbox, and track its status.',
    )
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
