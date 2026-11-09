/**
 * UAT_MODE must not elevate real JWTs to admin / skip signature verification.
 */
import type { Context } from 'hono';

jest.mock('../../utils/jwt-verification', () => ({
  extractAndVerifyAuthToken: jest.fn(),
}));

import { extractAndVerifyAuthToken } from '../../utils/jwt-verification';
import { requireAuth } from '../auth-middleware';

const mockedVerify = extractAndVerifyAuthToken as jest.MockedFunction<
  typeof extractAndVerifyAuthToken
>;

function fakeCtx(authHeader?: string): Context {
  const store: Record<string, unknown> = {};
  return {
    req: {
      path: '/settlements/vendor/abc',
      method: 'GET',
      header: (name: string) => {
        const n = name.toLowerCase();
        if (n === 'authorization' && authHeader) return authHeader;
        return undefined;
      },
    },
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
    get: (k: string) => store[k],
    json: (body: unknown, status?: number) => ({ body, status }),
  } as unknown as Context;
}

describe('requireAuth UAT_MODE JWT handling', () => {
  const prev = process.env.UAT_MODE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UAT_MODE = 'true';
  });

  afterAll(() => {
    process.env.UAT_MODE = prev;
  });

  it('does not mint anonymous admin when Bearer is missing (UAT_MODE=true)', async () => {
    const c = fakeCtx(undefined);
    const mw = requireAuth();
    const res: any = await mw(c, async () => undefined);
    expect(res?.status).toBe(401);
    expect(c.get('userRole')).toBeUndefined();
  });

  it('verifies real JWTs even when UAT_MODE=true (does not default to admin)', async () => {
    mockedVerify.mockResolvedValue({
      valid: true,
      payload: {
        sub: 'vendor-real-id',
        iss: 'warmpawz-uat',
        'custom:user_type': 'vendor',
        'cognito:groups': ['vendor'],
      },
    } as any);

    const c = fakeCtx('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real.jwt');
    const mw = requireAuth();
    let nextCalled = false;
    await mw(c, async () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(mockedVerify).toHaveBeenCalled();
    expect(c.get('userId')).toBe('vendor-real-id');
    expect(c.get('userRole')).toBe('vendor');
    expect(c.get('userRole')).not.toBe('admin');
  });

  it('accepts explicit synthetic uat-token-vendor-* only', async () => {
    const c = fakeCtx('Bearer uat-token-vendor-123');
    const mw = requireAuth();
    let nextCalled = false;
    await mw(c, async () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(mockedVerify).not.toHaveBeenCalled();
    expect(c.get('userRole')).toBe('vendor');
    expect(c.get('userId')).toBe('uat-vendor-user');
  });

  it('rejects synthetic uat-token without role segment', async () => {
    const c = fakeCtx('Bearer uat-token-unknown-123');
    const mw = requireAuth();
    const res: any = await mw(c, async () => undefined);
    expect(res?.status).toBe(401);
  });
});
