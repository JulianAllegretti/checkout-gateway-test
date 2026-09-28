import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PaymentService } from './application/payment.service';
import { ProductsService } from './application/products.service';
import { TransactionsService } from './application/transactions.service';
import { HttpPaymentGatewayAdapter } from './infrastructure/gateway/http-payment-gateway.adapter';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { ProductRepositoryPrisma } from './infrastructure/prisma/product.repository.prisma';
import { TransactionRepositoryPrisma } from './infrastructure/prisma/transaction.repository.prisma';
import { HealthController } from './interface/http/health.controller';
import { PaymentController } from './interface/http/payment.controller';
import { ProductsController } from './interface/http/products.controller';
import { TransactionsController } from './interface/http/transactions.controller';
import { PAYMENT_PORT } from './ports/inbound/payment.port';
import { PRODUCTS_PORT } from './ports/inbound/products.port';
import { TRANSACTIONS_PORT } from './ports/inbound/transactions.port';
import { PAYMENT_GATEWAY } from './ports/outbound/payment-gateway.port';
import { PRODUCT_REPOSITORY } from './ports/outbound/product.repository';
import { TRANSACTION_REPOSITORY } from './ports/outbound/transaction.repository';

@Module({
  imports: [HttpModule],
  controllers: [HealthController, ProductsController, TransactionsController, PaymentController],
  providers: [
    PrismaService,
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepositoryPrisma },
    { provide: TRANSACTION_REPOSITORY, useClass: TransactionRepositoryPrisma },
    { provide: PAYMENT_GATEWAY, useClass: HttpPaymentGatewayAdapter },
    { provide: PRODUCTS_PORT, useClass: ProductsService },
    { provide: TRANSACTIONS_PORT, useClass: TransactionsService },
    { provide: PAYMENT_PORT, useClass: PaymentService },
  ],
})
export class CheckoutModule {}
