// Matches GET /products/current's response shape — see specs/API-CONTRACT.md.
export interface Product {
  id: string
  name: string
  description: string
  unitPrice: number
  taxRate: number
  taxAmount: number
  price: number
  stock: number
  imageUrl: string
  baseFee: number
  deliveryFee: number
  currency: string
}

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR'
