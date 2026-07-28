import { FeatureFlag } from '../catalogue/feature-flags/feature-flags';
import { requireFeatureFlag } from '../catalogue/middleware/require-feature-flag.middleware';

/** Shared Warmpawz Appointments admin route guards (catalogue, dashboard, …). */
export const requireWarmpawzAppointmentsEnabled = requireFeatureFlag(FeatureFlag.WARMPAWZ_APPOINTMENTS_ENABLED);
export const requireWarmpawzAppointmentsAdminEnabled = requireFeatureFlag(
  FeatureFlag.WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED,
);
