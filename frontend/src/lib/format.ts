// All amounts from the backend are integers in the currency's minor-less
// base unit (COP has no decimals) — see specs/API-CONTRACT.md.
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}
