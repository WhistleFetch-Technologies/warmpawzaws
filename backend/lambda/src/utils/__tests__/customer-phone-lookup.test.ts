import { findCustomerByPhone, normalizePhoneToLast10 } from '../customer-phone-lookup';

jest.mock('../../database/rds-connection', () => ({
  select: jest.fn(),
  query: jest.fn(),
}));

import { select, query } from '../../database/rds-connection';

const mockSelect = select as jest.MockedFunction<typeof select>;
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('findCustomerByPhone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns exact match when phone matches DB row', async () => {
    const row = { id: 'cust-1', phone: '9876543210' };
    mockSelect.mockResolvedValueOnce([row]);

    const result = await findCustomerByPhone('9876543210');

    expect(result).toEqual(row);
    expect(mockSelect).toHaveBeenCalledWith('customers', { phone: '9876543210' });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('resolves +91 stored phone when request uses 10 digits (prod pet save path)', async () => {
    mockSelect.mockResolvedValueOnce([]);
    const row = { id: 'cust-2', phone: '+919876543210' };
    mockQuery.mockResolvedValueOnce({ rows: [row] } as unknown as Awaited<ReturnType<typeof query>>);

    const result = await findCustomerByPhone('9876543210');

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalled();
    const sqlArgs = mockQuery.mock.calls[0][1] as string[];
    expect(sqlArgs[0]).toEqual(expect.arrayContaining(['9876543210', '+919876543210']));
    expect(sqlArgs[1]).toBe('9876543210');
  });

  it('returns null when no customer matches', async () => {
    mockSelect.mockResolvedValueOnce([]);
    mockQuery.mockResolvedValueOnce({ rows: [] } as unknown as Awaited<ReturnType<typeof query>>);

    const result = await findCustomerByPhone('0000000000');

    expect(result).toBeNull();
  });
});

describe('normalizePhoneToLast10', () => {
  it('strips country code and non-digits', () => {
    expect(normalizePhoneToLast10('+91 98765 43210')).toBe('9876543210');
  });
});
