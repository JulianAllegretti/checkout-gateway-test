import 'dotenv/config';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './checkout/interface/http/validation-exception.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
