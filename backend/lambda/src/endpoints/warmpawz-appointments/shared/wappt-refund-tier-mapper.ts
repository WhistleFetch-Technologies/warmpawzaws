/** Map admin/API refund tier payload to vendor_refund_tiers row (WAPPT-scoped). */
export function mapWapptRefundTierBodyToDb(
  body: Record<string, unknown>,
  opts: { policyScope: 'platform' | 'category'; serviceCategory?: string | null },
): Record<string, unknown> {
  const customerWindowToHours: Record<string, number> = {
    '48_plus': 48,
    '24_plus': 24,
    '24_48': 24,
    '12_plus': 12,
    '12_24': 12,
    '6_plus': 6,
    '6_12': 6,
    under_24_no_show: 0,
    under_12_no_show: 0,
    under_6_no_show: 0,
    after_checkin: 0,
    did_not_join_video: 0,
  };
  const vendorTypes = Array.isArray(body.vendorTypes)
    ? body.vendorTypes
    : Array.isArray(body.vendor_types)
      ? body.vendor_types
      : [];
  const serviceLocationMap: Record<string, string> = {
    at_home: 'home',
    at_center: 'clinic',
    both: 'both',
    tele: 'tele',
    all: 'all',
  };
  const rawLoc = body.serviceLocation ?? body.service_location ?? 'all';
  const service_location = serviceLocationMap[String(rawLoc)] ??
    (['home', 'clinic', 'both', 'tele', 'all'].includes(String(rawLoc)) ? String(rawLoc) : 'all');
  const cancelledBy = body.cancelledBy ?? body.cancelled_by ?? 'pet_parent';
  const cancellationWindow = body.cancellationWindow ?? body.cancellation_window ?? null;
  const vendorCancellationReason = body.vendorCancellationReason ?? body.vendor_cancellation_reason ?? null;
  const hasExplicitHours =
    body.hoursBeforeService != null ||
    body.hours_before_service != null;
  const hasExplicitHoursRule =
    body.hoursOperator != null ||
    body.hours_operator != null ||
    body.hoursThreshold != null ||
    body.hours_threshold != null;
  let hoursBeforeService = Number(body.hoursBeforeService ?? body.hours_before_service ?? 24);
  if (
    !hasExplicitHours &&
    !hasExplicitHoursRule &&
    cancelledBy === 'pet_parent' &&
    cancellationWindow &&
    customerWindowToHours[String(cancellationWindow)] !== undefined
  ) {
    hoursBeforeService = customerWindowToHours[String(cancellationWindow)];
  }
  const cancellationFee = Number(body.cancellationFee ?? body.cancellation_fee ?? 0);
  const maxPartial = body.maxPartialRefundPercentage ?? body.max_partial_refund_percentage;
  const out: Record<string, unknown> = {
    name: body.name ?? '',
    description: body.description ?? null,
    vendor_types: vendorTypes,
    service_location,
    hours_before_service: Number.isFinite(hoursBeforeService) ? hoursBeforeService : 24,
    refund_percentage:
      (body.refundPercentage ?? body.refund_percentage) != null &&
      Number.isFinite(Number(body.refundPercentage ?? body.refund_percentage))
        ? Math.min(100, Math.max(0, Number(body.refundPercentage ?? body.refund_percentage)))
        : 75,
    cancellation_fee: Number.isFinite(cancellationFee) ? Math.max(0, cancellationFee) : 0,
    is_active: body.isActive !== false && body.is_active !== false,
    tier_level: Number(body.tierLevel ?? body.tier_level ?? 0) || 0,
    commerce_mode: 'warmpawz_appointments',
    policy_scope: opts.policyScope,
    service_category: opts.policyScope === 'category' ? (opts.serviceCategory ?? null) : null,
  };
  if ('maxPartialRefundPercentage' in body || 'max_partial_refund_percentage' in body) {
    out.max_partial_refund_percentage =
      maxPartial != null && Number.isFinite(Number(maxPartial))
        ? Math.min(100, Math.max(0, Number(maxPartial)))
        : null;
  }
  const v = String(cancelledBy).toLowerCase();
  out.cancelled_by = ['pet_parent', 'provider'].includes(v) ? v : 'pet_parent';
  if (cancellationWindow != null) out.cancellation_window = String(cancellationWindow);
  if (vendorCancellationReason != null) {
    out.vendor_cancellation_reason = String(vendorCancellationReason).toLowerCase();
  }
  const hoursOp = body.hoursOperator ?? body.hours_operator ?? null;
  const hoursThr = body.hoursThreshold ?? body.hours_threshold ?? null;
  if (hoursOp != null) {
    const op = String(hoursOp).toLowerCase();
    out.hours_operator = ['gte', 'lte', 'gt', 'lt'].includes(op) ? op : null;
  } else if (
    cancelledBy === 'pet_parent' &&
    (hasExplicitHours || hasExplicitHoursRule) &&
    Number.isFinite(hoursBeforeService)
  ) {
    out.hours_operator = 'gte';
  }
  if (hoursThr != null) {
    out.hours_threshold = Number.isFinite(Number(hoursThr)) ? Number(hoursThr) : null;
  } else if (out.hours_operator === 'gte' && Number.isFinite(hoursBeforeService)) {
    out.hours_threshold = hoursBeforeService;
  }
  if (hasExplicitHours || hasExplicitHoursRule) {
    out.cancellation_window = null;
  }
  const rawExt = body.policyExtensions ?? body.policy_extensions;
  if (rawExt && typeof rawExt === 'object' && !Array.isArray(rawExt)) {
    out.policy_extensions = rawExt;
  }
  return out;
}

export function mapDbTierToApi(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    vendorTypes: row.vendor_types,
    serviceLocation: row.service_location,
    hoursBeforeService: row.hours_before_service,
    refundPercentage: row.refund_percentage,
    cancellationFee: row.cancellation_fee,
    isActive: row.is_active,
    tierLevel: row.tier_level,
    cancelledBy: row.cancelled_by,
    cancellationWindow: row.cancellation_window,
    vendorCancellationReason: row.vendor_cancellation_reason,
    hoursOperator: row.hours_operator,
    hoursThreshold: row.hours_threshold,
    maxPartialRefundPercentage: row.max_partial_refund_percentage,
    policyExtensions: row.policy_extensions,
    commerceMode: row.commerce_mode,
    policyScope: row.policy_scope,
    serviceCategory: row.service_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
