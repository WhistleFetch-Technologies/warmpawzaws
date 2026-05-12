/**
 * Canonical meal subscription lifecycle + delivery session statuses (migration 749).
 * Legacy meal_subscriptions rows may have lifecycle_status NULL.
 */

export const MEAL_SUBSCRIPTION_LIFECYCLE_VALUES = [
  'draft',
  'pending_payment',
  'active',
  'paused',
  'cancelled',
  'expired',
  'completed',
] as const;

export type MealSubscriptionLifecycleStatus = (typeof MEAL_SUBSCRIPTION_LIFECYCLE_VALUES)[number];

export const MEAL_SUBSCRIPTION_DB_STATUS_VALUES = [
  'active',
  'paused',
  'cancelled',
  'expired',
  'pending_payment',
  'draft',
  'completed',
] as const;

export type MealSubscriptionDbStatus = (typeof MEAL_SUBSCRIPTION_DB_STATUS_VALUES)[number];

export const MEAL_SUBSCRIPTION_DELIVERY_STATUS_VALUES = [
  'scheduled',
  'preparing',
  'ready',
  'assigned',
  'out_for_delivery',
  'delivered',
  'skipped',
  'rescheduled',
  'cancelled',
  'failed',
] as const;

export type MealSubscriptionDeliveryStatus = (typeof MEAL_SUBSCRIPTION_DELIVERY_STATUS_VALUES)[number];

export const CANONICAL_RECURRING_PURCHASE_TYPES = ['WEEKLY_PLAN', 'MONTHLY_PLAN'] as const;

export type CanonicalRecurringPurchaseType = (typeof CANONICAL_RECURRING_PURCHASE_TYPES)[number];

/** Default rolling horizon when generating delivery sessions */
export const DEFAULT_SESSION_HORIZON_DAYS = 28;
