jest.mock('../../../../utils/jwt-verification', () => ({
  decodeTokenUnsafe: jest.fn(),
}));

jest.mock('../../../../utils/jwt-generator', () => ({
  verifyProductionJWTToken: jest.fn(),
  generateProductionJWTToken: jest.fn(),
  verifyUATJWTToken: jest.fn(),
  generateUATJWTToken: jest.fn(),
}));

jest.mock('../customer-auth-version-support', () => ({
  selectCustomerIdAndAuthVersion: jest.fn(),
}));

jest.mock('../vendor-auth-version-support', () => ({
  selectVendorIdAndAuthVersion: jest.fn(),
}));

jest.mock('../../../../utils/cognito-client', () => ({
  refreshCognitoUserSession: jest.fn(),
}));

import { decodeTokenUnsafe } from '../../../../utils/jwt-verification';
import {
  generateProductionJWTToken,
  verifyProductionJWTToken,
} from '../../../../utils/jwt-generator';
import { selectCustomerIdAndAuthVersion } from '../customer-auth-version-support';
import { selectVendorIdAndAuthVersion } from '../vendor-auth-version-support';
import { executeAuthRefresh } from '../auth-token-refresh';

const CUSTOMER_ID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
const VENDOR_ID = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
const REFRESH_JWT = 'header.payload.signature';

describe('executeAuthRefresh JWT branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (decodeTokenUnsafe as jest.Mock).mockReturnValue({
      iss: 'warmpawz-api',
      token_use: 'refresh',
    });
    (verifyProductionJWTToken as jest.Mock).mockResolvedValue({
      valid: true,
      payload: {
        sub: CUSTOMER_ID,
        'cognito:username': '+919876543210',
        'custom:user_type': 'customer',
        token_use: 'refresh',
      },
    });
    (generateProductionJWTToken as jest.Mock).mockResolvedValue({
      accessToken: 'new-access',
      idToken: 'new-id',
      refreshToken: 'new-refresh',
      expiresIn: 86400,
    });
  });

  it('embeds customer auth_version from DB when refresh JWT has no auth_version claim', async () => {
    (selectCustomerIdAndAuthVersion as jest.Mock).mockResolvedValue({
      id: CUSTOMER_ID,
      auth_version: 2,
    });

    const out = await executeAuthRefresh(REFRESH_JWT);

    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
    expect(selectCustomerIdAndAuthVersion).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(generateProductionJWTToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CUSTOMER_ID,
        role: 'customer',
        authVersion: 2,
      })
    );
    expect(out.body).toEqual(
      expect.objectContaining({
        accessToken: 'new-access',
        idToken: 'new-id',
        expiresIn: 86400,
      })
    );
  });

  it('embeds vendor auth_version from DB for vendor refresh tokens', async () => {
    (verifyProductionJWTToken as jest.Mock).mockResolvedValue({
      valid: true,
      payload: {
        sub: VENDOR_ID,
        'cognito:username': '+919876543211',
        'custom:user_type': 'vendor',
        token_use: 'refresh',
      },
    });
    (selectVendorIdAndAuthVersion as jest.Mock).mockResolvedValue({
      id: VENDOR_ID,
      auth_version: 3,
    });

    const out = await executeAuthRefresh(REFRESH_JWT);

    expect(out.ok).toBe(true);
    expect(selectVendorIdAndAuthVersion).toHaveBeenCalledWith(VENDOR_ID);
    expect(selectCustomerIdAndAuthVersion).not.toHaveBeenCalled();
    expect(generateProductionJWTToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VENDOR_ID,
        role: 'vendor',
        authVersion: 3,
      })
    );
  });
});
