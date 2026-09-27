import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TRANSACTIONS_PORT, type TransactionsPort } from '../../ports/inbound/transactions.port';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { toHttpException } from './http-error.mapper';
import { toCommand, toTransactionDetailResponse, type TransactionDetailResponse, type TransactionResponse } from './transactions.mapper';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TRANSACTIONS_PORT) private readonly transactionsPort: TransactionsPort,
    @InjectPinoLogger(TransactionsController.name) private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTransactionDto): Promise<TransactionResponse> {
    // `cmd` here matches pino.config.ts's REDACT_PATHS shape — cardToken,
    // paymentAcceptanceToken, customer.email/phone and delivery.address never
    // reach the log output.
    this.logger.debug({ cmd: dto }, 'Received create-transaction request');

    const created = await this.transactionsPort.create(toCommand(dto));
    if (created.isErr()) throw toHttpException(created.error);

    // create() only returns the Transaction itself — card/reason live on the
    // payments row, only available through the joined read.
    const detail = await this.transactionsPort.getById(created.value.id);
    if (detail.isErr()) throw toHttpException(detail.error);

    const { customer: _customer, delivery: _delivery, ...response } = toTransactionDetailResponse(detail.value);
    return response;
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<TransactionDetailResponse> {
    const result = await this.transactionsPort.getById(id);
    if (result.isErr()) throw toHttpException(result.error);
    return toTransactionDetailResponse(result.value);
  }
}
