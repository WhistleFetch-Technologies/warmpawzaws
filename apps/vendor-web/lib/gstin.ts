/** Standard 15-character Indian GSTIN format. */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGSTIN(gst: string): boolean {
  return GSTIN_REGEX.test(gst);
}

/** Uppercase, strip non-alphanumeric, cap at 15 characters. */
export function formatGSTIN(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
}

export type GSTVerificationData = {
  verified: boolean;
  gstin: string;
  legalName: string;
  tradeName?: string;
  status: 'Active' | 'Cancelled' | 'Suspended' | 'unknown';
  stateCode: string;
  stateName: string;
  registrationDate?: string;
  businessType?: string;
  address?: string;
};
