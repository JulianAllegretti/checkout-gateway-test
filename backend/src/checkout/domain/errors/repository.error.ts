export class RepositoryError {
  readonly type = 'REPOSITORY_ERROR' as const;

  constructor(readonly reason: string) {}

  get message(): string {
    return `Repository error: ${this.reason}`;
  }
}
