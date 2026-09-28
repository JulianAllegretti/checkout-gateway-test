export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unitPriceAmount: number;
  readonly taxRate: number;
  readonly stock: number;
  readonly imageUrl: string | null;
  readonly isFeatured: boolean;
  readonly currency: string;
}
