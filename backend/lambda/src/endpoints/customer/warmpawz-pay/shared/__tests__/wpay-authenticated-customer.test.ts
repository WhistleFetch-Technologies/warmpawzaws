import { resolveWpayAuthenticatedCustomer } from '../wpay-authenticated-customer';

const AUTH_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

jest.mock('../../../../../utils/customer-id-from-auth', () => ({
  resolveCustomerIdFromHonoContext: jest.fn(),
}));
jest.mock('../../../../../utils/customer-coordinates', () => ({
  resolveCustomerIdFromPhone: jest.fn(),
}));

import { resolveCustomerIdFromHonoContext } from '../../../../../utils/customer-id-from-auth';
import { resolveCustomerIdFromPhone } from '../../../../../utils/customer-coordinates';

const mockedAuth = resolveCustomerIdFromHonoContext as jest.MockedFunction<
  typeof resolveCustomerIdFromHonoContext
>;
const mockedPhone = resolveCustomerIdFromPhone as jest.MockedFunction<typeof resolveCustomerIdFromPhone>;

describe('resolveWpayAuthenticatedCustomer', () => {
  const c = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when JWT does not resolve a customer', async () => {
    mockedAuth.mockResolvedValue(null);
    const result = await resolveWpayAuthenticatedCustomer(c, '9876543210');
    expect(result).toEqual({ ok: false, status: 401, error: 'Authentication required' });
    expect(mockedPhone).not.toHaveBeenCalled();
  });

  it('returns 400 when phone is missing', async () => {
    mockedAuth.mockResolvedValue(AUTH_ID);
    const result = await resolveWpayAuthenticatedCustomer(c, '  ');
    expect(result).toEqual({ ok: false, status: 400, error: 'Phone is required' });
    expect(mockedPhone).not.toHaveBeenCalled();
  });

  it('returns 404 when phone is not a customer', async () => {
    mockedAuth.mockResolvedValue(AUTH_ID);
    mockedPhone.mockResolvedValue(null);
    const result = await resolveWpayAuthenticatedCustomer(c, '9876543210');
    expect(result).toEqual({ ok: false, status: 404, error: 'Customer not found' });
  });

  it('returns 403 when body phone belongs to another customer', async () => {
    mockedAuth.mockResolvedValue(AUTH_ID);
    mockedPhone.mockResolvedValue(OTHER_ID);
    const result = await resolveWpayAuthenticatedCustomer(c, '9876543210');
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'Phone does not match authenticated customer',
    });
  });

  it('returns the JWT customer when phone matches', async () => {
    mockedAuth.mockResolvedValue(AUTH_ID);
    mockedPhone.mockResolvedValue(AUTH_ID);
    const result = await resolveWpayAuthenticatedCustomer(c, '9876543210');
    expect(result).toEqual({ ok: true, customerId: AUTH_ID });
  });
});
