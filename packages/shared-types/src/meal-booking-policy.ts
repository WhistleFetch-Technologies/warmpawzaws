/**
 * Meal booking policy — platform / vendor / meal-plan layered rules.
 * @see docs/MEAL_BOOKING_POLICY_MODEL.md
 */

export type MealBookingPolicyScope = 'platform' | 'vendor' | 'meal_plan';

export type MealPurchaseType = 'ONE_OFF' | 'WEEKLY_PLAN' | 'MONTHLY_PLAN' | 'ALL';

/** Who may set lead time at this layer (enforced server-side). */
export interface MealLeadTimeBounds {
  /** Platform default when plan/vendor omits value. */
  defaultHours: number;
  /** Minimum hours before delivery (0 = same-day allowed if cutoff/slots pass). */
  minHours: number;
  maxHours: number;
}

/** Daily batch cutoff in vendor timezone. */
export interface MealOrderCutoffRule {
  /** "HH:mm" 24h, e.g. "18:00" */
  time: string;
  timezone: string;
  /**
   * When true, orders for *today* must be placed before `time`.
   * When false, cutoff applies to *next* calendar day's batch (legacy behaviour).
   */
  appliesToSameDayDelivery?: boolean;
}

export interface MealSameDayRule {
  /** Master switch at this policy layer. */
  enabled: boolean;
  /** Floor when same-day is on (e.g. 2h prep). Ignored if enabled=false. */
  minLeadTimeHours?: number;
  /** Optional stricter cutoff for same-day (e.g. "11:00"). Falls back to orderCutoff. */
  cutoff?: MealOrderCutoffRule;
  /** Cap same-day orders per vendor per calendar day (ops). */
  maxOrdersPerDay?: number | null;
}

export interface MealDeliverySlotRule {
  /** calendar_day | fixed_slots */
  mode: 'calendar_day' | 'fixed_slots';
  excludeWeekends?: boolean;
  /** Required when mode=fixed_slots, e.g. ["14:00","18:00"] */
  slotTimes?: string[];
}

export interface MealBookingTypeOverride {
  purchaseType: MealPurchaseType;
  leadTimeHours?: number;
  sameDay?: Partial<MealSameDayRule>;
  rescheduleMinHoursBefore?: number;
}

/** JSON stored in meal_booking_policies.rules (versioned). */
export interface MealBookingPolicyRulesV1 {
  schemaVersion: 1;
  timezone: string;
  leadTime: MealLeadTimeBounds;
  orderCutoff: MealOrderCutoffRule;
  sameDay: MealSameDayRule;
  deliverySlot?: MealDeliverySlotRule;
  /** Overrides for subscription vs one-off; purchaseType ALL = fallback. */
  byPurchaseType?: MealBookingTypeOverride[];
  messages?: {
    customerBlockTemplate?: string;
    vendorHintTemplate?: string;
  };
  /** Non-production only; ignored when ENV=prod. */
  devBypassLeadTime?: boolean;
}

export interface MealBookingPolicyRecord {
  id: string;
  scope: MealBookingPolicyScope;
  scopeId: string | null;
  rules: MealBookingPolicyRulesV1;
  isActive: boolean;
  effectiveFrom: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

/** Input to resolver (all datetimes ISO UTC; logic uses policy timezone). */
export interface MealBookingPolicyEvaluateInput {
  vendorId: string;
  mealPlanId: string;
  purchaseType: MealPurchaseType;
  requestedDeliveryAt: string;
  now?: string;
}

export type MealBookingPolicyBlockCode =
  | 'LEAD_TIME_TOO_SHORT'
  | 'SAME_DAY_CUTOFF_PASSED'
  | 'SAME_DAY_NOT_ALLOWED'
  | 'WEEKEND_BLOCKED'
  | 'SLOT_NOT_ALLOWED'
  | 'VENDOR_SAME_DAY_CAP'
  | 'OUTSIDE_VENDOR_HOURS';

export interface MealBookingPolicyEvaluateResult {
  allowed: boolean;
  earliestDeliveryAt: string;
  effectiveLeadTimeHours: number;
  effectiveOrderCutoffTime: string;
  sameDayAllowed: boolean;
  blockCode?: MealBookingPolicyBlockCode;
  message?: string;
  /** Which layer supplied the winning lead/cutoff values. */
  source: {
    leadTime: MealBookingPolicyScope;
    sameDay: MealBookingPolicyScope;
    cutoff: MealBookingPolicyScope;
  };
}

/** Snapshot returned to customer preview / vendor settings (no evaluation). */
export interface MealBookingPolicyEffectiveConfig {
  leadTimeHours: number;
  orderCutoffTime: string;
  timezone: string;
  sameDayEnabled: boolean;
  sameDayMinLeadTimeHours: number;
  bounds: MealLeadTimeBounds;
  purchaseType: MealPurchaseType;
}
