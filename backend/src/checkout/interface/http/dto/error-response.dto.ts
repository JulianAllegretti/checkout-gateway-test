import { ApiProperty } from '@nestjs/swagger';

/** Swagger-facing shape of every error response — see http-error.mapper.ts. */
export class ErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    example: 'OUT_OF_STOCK',
    enum: [
      'VALIDATION_ERROR',
      'PRODUCT_NOT_FOUND',
      'TRANSACTION_NOT_FOUND',
      'OUT_OF_STOCK',
      'INVALID_TRANSITION',
      'GATEWAY_ERROR',
      'INTERNAL_ERROR',
    ],
  })
  errorCode!: string;

  @ApiProperty({ example: 'Product b3f1c2a0-...-uuid does not have 5 unit(s) available' })
  message!: string;

  @ApiProperty({ example: null, nullable: true, description: 'Field-level messages for VALIDATION_ERROR, otherwise null.' })
  details!: unknown;
}
