import {
  FEATURE_FLAG_ENV_KEYS,
  FeatureFlag,
  type FeatureFlagId,
} from './feature-flags';

const TRUTHY_ENV_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSY_ENV_VALUES = new Set(['false', '0', 'no', 'off']);

function parseEnvBoolean(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUTHY_ENV_VALUES.has(normalized)) {
    return true;
  }
  if (FALSY_ENV_VALUES.has(normalized)) {
    return false;
  }

  return false;
}

export class FeatureFlagService {
  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  isWarmpawzAppointmentsEnabled(): boolean {
    return this.readFlag(FeatureFlag.WARMPAWZ_APPOINTMENTS_ENABLED);
  }

  isWarmpawzAppointmentsAdminEnabled(): boolean {
    return this.readFlag(FeatureFlag.WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED);
  }

  private readFlag(flag: FeatureFlagId): boolean {
    const envKey = FEATURE_FLAG_ENV_KEYS[flag];
    return parseEnvBoolean(this.env[envKey]);
  }
}
