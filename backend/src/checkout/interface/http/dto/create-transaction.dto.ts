import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateTransactionCustomerDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  phone!: string;
}

export class CreateTransactionDeliveryDto {
  @IsString()
  @MinLength(1)
  address!: string;

  @IsString()
  @MinLength(1)
  city!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTransactionDto {
  @IsUUID()
  idempotencyKey!: string;

  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(1)
  cardToken!: string;

  @IsString()
  @MinLength(1)
  paymentAcceptanceToken!: string;

  @ValidateNested()
  @Type(() => CreateTransactionCustomerDto)
  customer!: CreateTransactionCustomerDto;

  @ValidateNested()
  @Type(() => CreateTransactionDeliveryDto)
  delivery!: CreateTransactionDeliveryDto;
}
