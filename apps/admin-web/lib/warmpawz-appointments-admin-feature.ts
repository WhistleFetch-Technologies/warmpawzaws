/** Env / runtime flag — default ON (same as Warmpawz Pay). Set false to hide. */
export function isWarmpawzAppointmentsAdminEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (
      window as unknown as {
        __WARMPAWZ_RUNTIME_CONFIG__?: { warmpawzAppointmentsAdminEnabled?: boolean | string };
      }
    ).__WARMPAWZ_RUNTIME_CONFIG__?.warmpawzAppointmentsAdminEnabled;
    if (runtime === false || runtime === 'false') return false;
    if (runtime === true || runtime === 'true') return true;
  }
  if (process.env.NEXT_PUBLIC_WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED === 'false') return false;
  return true;
}
