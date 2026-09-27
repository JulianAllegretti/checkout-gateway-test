import { RepositoryError } from '../../domain/errors';

/** Converts anything a Prisma call can reject with into a RepositoryError. */
export function toRepositoryError(e: unknown): RepositoryError {
  return new RepositoryError(e instanceof Error ? e.message : String(e));
}
