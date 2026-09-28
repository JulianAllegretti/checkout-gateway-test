import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { CheckoutModule } from './checkout/checkout.module';
import { pinoConfig } from './shared/logger/pino.config';

@Module({
  imports: [LoggerModule.forRoot(pinoConfig), CheckoutModule],
})
export class AppModule {}
