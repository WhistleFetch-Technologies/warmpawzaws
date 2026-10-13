type RuntimeConfig = {
  warmpawzInsuranceEnabled?: boolean;
};

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: RuntimeConfig }).__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

/** Customer insurance discovery stays off until the runtime flag is turned on. */
export function isWarmpawzInsuranceCustomerEnabled(): boolean {
  const rc = getRuntimeConfig().warmpawzInsuranceEnabled;
  if (typeof rc === 'boolean') return rc;
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WARMPAWZ_INSURANCE_ENABLED : undefined;
  return raw === 'true' || raw === '1';
}
