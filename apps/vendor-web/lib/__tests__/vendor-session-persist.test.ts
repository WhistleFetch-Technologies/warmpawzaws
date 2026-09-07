import { parseExpiresInSeconds, getCognitoTokens, storeCognitoTokens } from '../cognito-auth';
import { shouldWipeVendorSessionAfter401 } from '../vendor-session-401';

const memoryStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => (key in memoryStore ? memoryStore[key] : null),
  setItem: (key: string, value: string) => {
    memoryStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStore[key];
  },
  clear: () => {
    for (const key of Object.keys(memoryStore)) delete memoryStore[key];
  },
};

describe('parseExpiresInSeconds', () => {
  it('keeps a positive number', () => {
    expect(parseExpiresInSeconds(3600, 86400)).toBe(3600);
  });

  it('parses a numeric string instead of falling back to 86400', () => {
    expect(parseExpiresInSeconds('3600', 86400)).toBe(3600);
  });

  it('uses fallback for invalid values', () => {
    expect(parseExpiresInSeconds('nope', 86400)).toBe(86400);
    expect(parseExpiresInSeconds(undefined, 86400)).toBe(86400);
    expect(parseExpiresInSeconds(0, 86400)).toBe(86400);
  });
});

describe('shouldWipeVendorSessionAfter401', () => {
  it('wipes only on failed_refresh for the first 401', () => {
    expect(shouldWipeVendorSessionAfter401('failed_refresh', false)).toBe(true);
    expect(shouldWipeVendorSessionAfter401('failed_network', false)).toBe(false);
    expect(shouldWipeVendorSessionAfter401('unchanged', false)).toBe(false);
    expect(shouldWipeVendorSessionAfter401('renewed', false)).toBe(false);
  });

  it('does not wipe when the retried request still 401s', () => {
    expect(shouldWipeVendorSessionAfter401('failed_refresh', true)).toBe(false);
    expect(shouldWipeVendorSessionAfter401('renewed', true)).toBe(false);
    expect(shouldWipeVendorSessionAfter401(undefined, true)).toBe(false);
  });
});

describe('vendor cognito token persistence', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns the bundle when access expiry passed but the 90-day refresh window is open', () => {
    localStorageMock.setItem(
      'vendorCognitoTokens',
      JSON.stringify({
        accessToken: 'access',
        idToken: 'id',
        refreshToken: 'refresh',
        expiresIn: 3600,
      }),
    );
    localStorageMock.setItem('vendorTokenExpiry', String(Date.now() - 60_000));
    localStorageMock.setItem('vendorRefreshTokenExpiry', String(Date.now() + 86_400_000));

    const tokens = getCognitoTokens();
    expect(tokens?.refreshToken).toBe('refresh');
    expect(tokens?.idToken).toBe('id');
  });

  it('does not delete the refresh window when a new login omits refresh token', () => {
    localStorageMock.setItem('vendorRefreshTokenExpiry', '9999999999999');
    storeCognitoTokens(
      {
        accessToken: 'access',
        idToken: 'id',
        refreshToken: '',
        expiresIn: 3600,
      },
      { isNewLogin: true },
    );
    expect(localStorageMock.getItem('vendorRefreshTokenExpiry')).toBe('9999999999999');
  });

  it('stores numeric expiresIn when the API sent a string', () => {
    storeCognitoTokens(
      {
        accessToken: 'access',
        idToken: 'id',
        refreshToken: 'refresh',
        expiresIn: '3600' as unknown as number,
      },
      { isNewLogin: true },
    );
    const stored = JSON.parse(localStorageMock.getItem('vendorCognitoTokens') || 'null');
    expect(stored.expiresIn).toBe(3600);
  });
});
