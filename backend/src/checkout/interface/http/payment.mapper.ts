import { ApiProperty } from '@nestjs/swagger';
import type { AcceptanceTokens } from '../../ports/outbound/payment-gateway.port';

// A class, not an interface: @nestjs/swagger reads response shapes via
// reflection, and interfaces are erased at compile time — there'd be nothing
// left for it to introspect.
export class AcceptanceTokensResponse {
  @ApiProperty({ description: 'Send back as `acceptanceToken` on POST /transactions.', example: 'eyJhbGciOi...' })
  termsToken!: string;

  @ApiProperty({ description: 'The terms-and-conditions contract text, for the checkbox label to link to.', example: 'https://.../terms.pdf' })
  termsUrl!: string;

  @ApiProperty({ description: 'Send back as `personalDataAuthToken` on POST /transactions.', example: 'eyJhbGciOi...' })
  personalDataToken!: string;

  @ApiProperty({ description: 'The personal-data-handling contract text, for the checkbox label to link to.', example: 'https://.../personal-data.pdf' })
  personalDataUrl!: string;
}

export function toAcceptanceTokensResponse(tokens: AcceptanceTokens): AcceptanceTokensResponse {
  return tokens;
}
