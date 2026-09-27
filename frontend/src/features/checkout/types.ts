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

// Mirror POST /transactions' `customer`/`delivery` request fields (see
// specs/API-CONTRACT.md). Placeholder shapes for now — replaced by
// `z.infer<typeof customerSchema>` / `z.infer<typeof deliverySchema>` once
// schemas.ts exists (next task), per frontend/specs/TDD.md. Neither has any
// card-related field, by design.
export interface CustomerDraft {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface DeliveryDraft {
  address: string
  city: string
  region?: string
  postalCode?: string
  notes?: string
}
