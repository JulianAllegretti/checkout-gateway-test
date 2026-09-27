import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TRANSACTIONS_PORT, type TransactionsPort } from '../../ports/inbound/transactions.port';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ErrorResponseDto } from './dto/error-response.dto';
import { toHttpException } from './http-error.mapper';
import { toCommand, toTransactionDetailResponse, TransactionDetailResponse, TransactionResponse } from './transactions.mapper';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(TRANSACTIONS_PORT) private readonly transactionsPort: TransactionsPort,
    @InjectPinoLogger(TransactionsController.name) private readonly logger: PinoLogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create the customer, delivery and a PENDING transaction (reserving stock atomically), then charge the card.',
    description: 'Retrying with the same idempotencyKey returns the existing transaction instead of creating a new one.',
  })
  @ApiResponse({ status: 201, type: TransactionResponse })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'PRODUCT_NOT_FOUND' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'OUT_OF_STOCK or INVALID_TRANSITION' })
  @ApiResponse({ status: 422, type: ErrorResponseDto, description: 'PAYMENT_DECLINED' })
  @ApiResponse({ status: 502, type: ErrorResponseDto, description: 'GATEWAY_ERROR' })
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
  @ApiOperation({ summary: 'Poll while PENDING, or recover the current step/result after a page refresh.' })
  @ApiParam({ name: 'id', example: '8a2e...-uuid' })
  @ApiResponse({ status: 200, type: TransactionDetailResponse })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'TRANSACTION_NOT_FOUND' })
  async getById(@Param('id') id: string): Promise<TransactionDetailResponse> {
    const result = await this.transactionsPort.getById(id);
    if (result.isErr()) throw toHttpException(result.error);
    return toTransactionDetailResponse(result.value);
  }
}
