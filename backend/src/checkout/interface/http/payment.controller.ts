import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from './dto/error-response.dto';
import { toHttpException } from './http-error.mapper';
import { AcceptanceTokensResponse, toAcceptanceTokensResponse } from './payment.mapper';
import { PAYMENT_PORT, type PaymentPort } from '../../ports/inbound/payment.port';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(@Inject(PAYMENT_PORT) private readonly paymentPort: PaymentPort) {}

  @Get('acceptance-tokens')
  @ApiOperation({
    summary: 'The pair of habeas-data consent tokens to show as checkboxes before charging.',
    description:
      'Fetched server-side: the gateway’s merchant-info endpoint has no browser CORS support, so the frontend cannot call it directly.',
  })
  @ApiResponse({ status: 200, type: AcceptanceTokensResponse })
  @ApiResponse({ status: 502, type: ErrorResponseDto, description: 'GATEWAY_ERROR' })
  async getAcceptanceTokens(): Promise<AcceptanceTokensResponse> {
    const result = await this.paymentPort.getAcceptanceTokens();
    if (result.isErr()) throw toHttpException(result.error);
    return toAcceptanceTokensResponse(result.value);
  }
}
