import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './sentry-exception.filter';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

function fakeHost(response: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function fakeResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json };
}

const captureException = Sentry.captureException as jest.Mock;

describe('SentryExceptionFilter', () => {
  afterEach(() => captureException.mockClear());

  it('passes an HttpException through untouched, without reporting to Sentry', () => {
    const filter = new SentryExceptionFilter();
    const response = fakeResponse();
    const exception = new HttpException({ statusCode: 404, errorCode: 'PRODUCT_NOT_FOUND', message: 'not found', details: null }, 404);

    filter.catch(exception, fakeHost(response));

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.status.mock.results[0]?.value.json).toHaveBeenCalledWith(exception.getResponse());
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports an unexpected exception to Sentry and responds with a generic 500', () => {
    const filter = new SentryExceptionFilter();
    const response = fakeResponse();
    const exception = new Error('something truly broke');

    filter.catch(exception, fakeHost(response));

    expect(captureException).toHaveBeenCalledWith(exception);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      details: null,
    });
  });

  it('never leaks the raw exception message into the response body', () => {
    const filter = new SentryExceptionFilter();
    const response = fakeResponse();

    filter.catch(new Error('leaked-secret-detail'), fakeHost(response));

    const body = response.status.mock.results[0]?.value.json.mock.calls[0]?.[0];
    expect(JSON.stringify(body)).not.toContain('leaked-secret-detail');
  });
});
