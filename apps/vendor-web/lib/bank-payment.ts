/** Indian bank IFSC: 4 letters + 0 + 6 alphanumeric (11 chars). */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** UPI VPA: handle@provider */
export const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const ACCOUNT_MIN_LEN = 9;
export const ACCOUNT_MAX_LEN = 18;

export function formatIFSC(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
}

export function formatAccountNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, ACCOUNT_MAX_LEN);
}

export function formatUPI(value: string): string {
  return value.trim().replace(/\s/g, '');
}

export function isValidIFSC(ifsc: string): boolean {
  return IFSC_REGEX.test(ifsc.toUpperCase().trim());
}

export function isValidAccountNumber(acct: string): boolean {
  const digits = acct.replace(/\s/g, '');
  if (isMaskedAccountNumber(digits)) return false;
  return /^\d+$/.test(digits) && digits.length >= ACCOUNT_MIN_LEN && digits.length <= ACCOUNT_MAX_LEN;
}

export function isValidUPI(upi: string): boolean {
  return UPI_REGEX.test(formatUPI(upi));
}

export function isMaskedAccountNumber(value: string): boolean {
  const clean = String(value || '').replace(/\s/g, '');
  return /^\*{3,}\d{1,4}$/.test(clean) || /^[•…]{3,}\d{1,4}$/.test(clean);
}

/** Reject 10-digit values that look like Indian mobile numbers in IFSC field. */
export function looksLikeIndianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
}

export function accountNumberSuffix(value: string): string {
  const clean = value.replace(/\s/g, '');
  if (clean.length < 4) return '';
  return clean.slice(-4);
}

/** Map GET /bank-account (unmasked) or GET /bank-details (often masked) onto the seller payment form. */
export function mapSellerBankFieldsFromApi(
  bank: Record<string, unknown> | null | undefined,
): {
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  hasStoredBankAccount: boolean;
  storedAccountSuffix: string;
} {
  const bankDetails = bank ?? null;
  let hasStoredBankAccount = false;
  let storedAccountSuffix = '';
  let bank_name = '';
  let ifsc_code = '';
  let account_number = '';

  if (bankDetails) {
    bank_name = String(bankDetails.bank_name || bankDetails.bankName || '').trim();
    const rawIfsc = formatIFSC(String(bankDetails.ifsc_code || bankDetails.ifscCode || ''));
    ifsc_code = looksLikeIndianPhone(rawIfsc) || (rawIfsc && !isValidIFSC(rawIfsc)) ? '' : rawIfsc;
    const rawAccount = String(bankDetails.account_number || bankDetails.accountNumber || '').trim();
    if (rawAccount && isMaskedAccountNumber(rawAccount)) {
      hasStoredBankAccount = true;
      storedAccountSuffix = accountNumberSuffix(rawAccount);
      account_number = '';
    } else if (rawAccount && isValidAccountNumber(rawAccount)) {
      hasStoredBankAccount = true;
      storedAccountSuffix = accountNumberSuffix(rawAccount);
      account_number = rawAccount;
    }
  }

  return {
    bank_name,
    account_number,
    ifsc_code,
    hasStoredBankAccount,
    storedAccountSuffix,
  };
}
