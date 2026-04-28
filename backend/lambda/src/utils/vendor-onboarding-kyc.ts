/**
 * Server-side gate: onboarding must not submit until Aadhaar OTP + PAN flows set verified flags.
 */

export function assertApplicationKycComplete(
  payload: Record<string, unknown>
): { ok: true } | { ok: false; message: string } {
  const aadhaarFieldNames = [
    'aadhaarNumber',
    'ownerAadhaarNumber',
    'authorisedSignatoryAadhaar',
    'authorizedSignatoryAadhaar',
  ];
  const panFieldNames = ['panNumber', 'organizationPan', 'orgPan'];

  const aadhaarFilled = aadhaarFieldNames.some((n) => {
    const v = payload[n];
    return typeof v === 'string' && v.replace(/\D/g, '').length >= 12;
  });
  const panFilled = panFieldNames.some((n) => {
    const v = payload[n];
    return typeof v === 'string' && v.replace(/\s/g, '').length >= 10;
  });

  const aadhaarVerified =
    aadhaarFieldNames.some((n) => payload[`${n}_verified`] === true) ||
    payload.isAadharVerified === true ||
    payload.is_aadhar_verified === true;
  const panVerified =
    panFieldNames.some((n) => payload[`${n}_verified`] === true) ||
    payload.isPanVerified === true ||
    payload.is_pan_verified === true;

  if (aadhaarFilled && !aadhaarVerified) {
    return {
      ok: false,
      message: 'Complete Aadhaar OTP verification before submitting your application.',
    };
  }
  if (panFilled && !panVerified) {
    return {
      ok: false,
      message: 'Complete PAN verification before submitting your application.',
    };
  }
  return { ok: true };
}
