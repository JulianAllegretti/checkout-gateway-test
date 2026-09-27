export class ValidationError {
  readonly type = 'VALIDATION_ERROR' as const;

  constructor(
    readonly message: string,
    readonly details?: unknown,
  ) {}
}
