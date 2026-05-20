import { describe, expect, it } from '@jest/globals';

import { parseAuthCallbackUrl } from './authService';

describe('parseAuthCallbackUrl', () => {
  it('parses the ElyonX Windows protocol callback', () => {
    expect(
      parseAuthCallbackUrl('elyonx://auth/callback?token=jwt-token&expires_in=3600'),
    ).toEqual({
      token: 'jwt-token',
      expires_in: '3600',
      error: undefined,
    });
  });

  it('parses encoded auth errors from the callback', () => {
    expect(
      parseAuthCallbackUrl('elyonx://auth/callback?error=access_denied%3A%20cancelled'),
    ).toEqual({
      token: undefined,
      expires_in: undefined,
      error: 'access_denied: cancelled',
    });
  });
});
