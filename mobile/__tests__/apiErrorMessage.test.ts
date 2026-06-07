/**
 * FlowOS mobile - __tests__/apiErrorMessage.test.ts
 * The shared error-message extractor: API error envelope > axios message > generic.
 */
import { AxiosError } from 'axios';
import { apiErrorMessage } from '../src/api/client';

describe('apiErrorMessage', () => {
  it('extracts the API error envelope message', () => {
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
      data: { error: { message: 'This business is not currently accepting customers' } },
    });
    expect(apiErrorMessage(err)).toBe('This business is not currently accepting customers');
  });

  it('falls back to the axios error message when there is no envelope', () => {
    const err = new AxiosError('Network Error');
    expect(apiErrorMessage(err)).toBe('Network Error');
  });

  it('handles a plain Error', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('handles an unknown value', () => {
    expect(apiErrorMessage('weird')).toBe('Something went wrong');
  });
});
