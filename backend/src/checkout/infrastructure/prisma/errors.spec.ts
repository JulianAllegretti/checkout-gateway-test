import { toRepositoryError } from './errors';

describe('toRepositoryError', () => {
  it('uses the message when given an Error', () => {
    const result = toRepositoryError(new Error('connection refused'));
    expect(result.type).toBe('REPOSITORY_ERROR');
    expect(result.reason).toBe('connection refused');
  });

  it('stringifies non-Error rejections', () => {
    const result = toRepositoryError('boom');
    expect(result.reason).toBe('boom');
  });
});
