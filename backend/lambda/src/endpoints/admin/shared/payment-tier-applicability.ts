/** Shared mapping for /admin/payments/tiers Marketplace / WPay applicability. */

export type PaymentTierApplicability = {
  marketplaceEnabled: boolean;
  warmpawzPayEnabled: boolean;
};

export function parseOptionalBooleanQuery(raw: string | undefined): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function parseTierApplicabilityFlags(
  body: Record<string, unknown>,
  defaults: PaymentTierApplicability,
): PaymentTierApplicability {
  const marketplaceEnabled =
    body.marketplaceEnabled !== undefined
      ? Boolean(body.marketplaceEnabled)
      : body.marketplace_enabled !== undefined
        ? Boolean(body.marketplace_enabled)
        : defaults.marketplaceEnabled;
  const warmpawzPayEnabled =
    body.warmpawzPayEnabled !== undefined
      ? Boolean(body.warmpawzPayEnabled)
      : body.warmpawz_pay_enabled !== undefined
        ? Boolean(body.warmpawz_pay_enabled)
        : defaults.warmpawzPayEnabled;
  return { marketplaceEnabled, warmpawzPayEnabled };
}

export function mapVendorPaymentTierRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.tier_name,
    displayName: row.display_name,
    description: row.description ?? '',
    commissionRate: Number(row.commission_rate) ?? 0,
    payoutPeriodDays: Number(row.payout_period_days) ?? 7,
    monthlyCost: Number(row.monthly_cost) ?? 0,
    yearlyCost: Number(row.yearly_cost) ?? 0,
    isDefault: Boolean(row.is_default),
    isActive: row.is_active !== false,
    features: Array.isArray(row.features) ? row.features : row.features ? [row.features] : [],
    roles: Array.isArray(row.applicable_roles) ? (row.applicable_roles as string[]) : [],
    termsAndConditions: row.terms_and_conditions ?? '',
    termsVersion: row.terms_version ?? '1.0',
    marketplaceEnabled: row.marketplace_enabled !== false,
    warmpawzPayEnabled: row.warmpawz_pay_enabled === true,
  };
}

export function buildPaymentTierListWhere(params: {
  warmpawzPayEnabled?: boolean;
  isActive?: boolean;
}): { sql: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (params.warmpawzPayEnabled === true) {
    values.push(true);
    clauses.push(`warmpawz_pay_enabled = $${values.length}`);
  } else if (params.warmpawzPayEnabled === false) {
    values.push(false);
    clauses.push(`warmpawz_pay_enabled = $${values.length}`);
  }
  if (params.isActive === true) {
    values.push(true);
    clauses.push(`is_active = $${values.length}`);
  } else if (params.isActive === false) {
    values.push(false);
    clauses.push(`is_active = $${values.length}`);
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}
