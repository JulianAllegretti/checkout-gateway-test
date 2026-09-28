import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateTransactionCustomerDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+573001234567' })
  @IsString()
  @MinLength(1)
  phone!: string;
}

export class CreateTransactionDeliveryDto {
  @ApiProperty({ example: 'Calle 123 #45-67' })
  @IsString()
  @MinLength(1)
  address!: string;

  @ApiProperty({ example: 'Bogotá' })
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiPropertyOptional({ example: 'Cundinamarca' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: '110111' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Client-generated UUID. Retrying with the same value returns the existing transaction instead of creating a new one.',
    example: '6c1f6e2e-1b3a-4b3a-9b3a-1b3a4b3a9b3a',
  })
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ example: 'b3f1c2a0-1b3a-4b3a-9b3a-1b3a4b3a9b3a' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'Card token from the gateway’s client-side tokenization — the PAN/CVC never reach this API.',
    example: 'tok_test_...',
  })
  @IsString()
  @MinLength(1)
  cardToken!: string;

  @ApiProperty({ description: 'The `termsToken` from GET /payment/acceptance-tokens.', example: 'eyJhbGciOi...' })
  @IsString()
  @MinLength(1)
  paymentAcceptanceToken!: string;

  @ApiProperty({ description: 'The `personalDataToken` from GET /payment/acceptance-tokens.', example: 'eyJhbGciOi...' })
  @IsString()
  @MinLength(1)
  personalDataAuthToken!: string;

  @ApiProperty({ type: CreateTransactionCustomerDto })
  @ValidateNested()
  @Type(() => CreateTransactionCustomerDto)
  customer!: CreateTransactionCustomerDto;

  @ApiProperty({ type: CreateTransactionDeliveryDto })
  @ValidateNested()
  @Type(() => CreateTransactionDeliveryDto)
  delivery!: CreateTransactionDeliveryDto;
}
