import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from './dto/error-response.dto';
import { toHttpException } from './http-error.mapper';
import { PRODUCTS_PORT, type ProductsPort } from '../../ports/inbound/products.port';
import { ProductResponse, toProductResponse } from './products.mapper';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(@Inject(PRODUCTS_PORT) private readonly productsPort: ProductsPort) {}

  @Get('current')
  @ApiOperation({ summary: 'The single product shown on the storefront, plus the fixed fees used in the checkout summary.' })
  @ApiResponse({ status: 200, type: ProductResponse })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'PRODUCT_NOT_FOUND — no featured product configured.' })
  async getCurrent(): Promise<ProductResponse> {
    const result = await this.productsPort.getCurrent();
    if (result.isErr()) throw toHttpException(result.error);
    return toProductResponse(result.value);
  }
}
