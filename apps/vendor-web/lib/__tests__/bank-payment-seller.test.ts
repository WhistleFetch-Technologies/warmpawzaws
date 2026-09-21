import {
  mapSellerBankFieldsFromApi,
  looksLikeIndianPhone,
} from '../bank-payment';

describe('mapSellerBankFieldsFromApi', () => {
  it('keeps a full account number and valid IFSC', () => {
    const mapped = mapSellerBankFieldsFromApi({
      bank_name: 'SBI',
      account_number: '12345678901',
      ifsc_code: 'SBIN0001234',
    });
    expect(mapped.account_number).toBe('12345678901');
    expect(mapped.ifsc_code).toBe('SBIN0001234');
    expect(mapped.hasStoredBankAccount).toBe(true);
    expect(mapped.storedAccountSuffix).toBe('8901');
  });

  it('does not put a phone number into IFSC', () => {
    expect(looksLikeIndianPhone('9876543210')).toBe(true);
    const mapped = mapSellerBankFieldsFromApi({
      account_number: '12345678901',
      ifsc_code: '9876543210',
    });
    expect(mapped.ifsc_code).toBe('');
    expect(mapped.account_number).toBe('12345678901');
  });

  it('clears masked account numbers so the seller can re-enter digits', () => {
    const mapped = mapSellerBankFieldsFromApi({
      account_number: '****3210',
      ifsc_code: 'HDFC0001234',
    });
    expect(mapped.account_number).toBe('');
    expect(mapped.hasStoredBankAccount).toBe(true);
    expect(mapped.storedAccountSuffix).toBe('3210');
    expect(mapped.ifsc_code).toBe('HDFC0001234');
  });
});
