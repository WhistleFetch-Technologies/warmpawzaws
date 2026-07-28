/** Env / runtime flag — default false until Warmpawz Appointments admin is enabled. */
export function isWarmpawzAppointmentsAdminEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (
      window as unknown as {
        __WARMPAWZ_RUNTIME_CONFIG__?: { warmpawzAppointmentsAdminEnabled?: boolean | string };
      }
    ).__WARMPAWZ_RUNTIME_CONFIG__?.warmpawzAppointmentsAdminEnabled;
    if (runtime === true || runtime === 'true') return true;
    if (runtime === false || runtime === 'false') return false;
  }
  return process.env.NEXT_PUBLIC_WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED === 'true';
}
