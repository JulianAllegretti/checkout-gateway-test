import { Controller, Get, Inject } from '@nestjs/common';
import { PRODUCTS_PORT, type ProductsPort } from '../../ports/inbound/products.port';
import { toHttpException } from './http-error.mapper';
import { toProductResponse, type ProductResponse } from './products.mapper';

@Controller('products')
export class ProductsController {
  constructor(@Inject(PRODUCTS_PORT) private readonly productsPort: ProductsPort) {}

  @Get('current')
  async getCurrent(): Promise<ProductResponse> {
    const result = await this.productsPort.getCurrent();
    if (result.isErr()) throw toHttpException(result.error);
    return toProductResponse(result.value);
  }
}
