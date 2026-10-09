/**
 * Promotion Engine v1 types (HLD + master plan).
 * Distinct from legacy platform promotions / coupons.
 */

import type { PromoCustomerCopy } from './customer-copy';
import type { BenefitCapNotice } from './benefit-cap/gate';

export type PromoEngineStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type StackingPolicy =
  | 'NONE'
  | 'ORDER_LEVEL'
  | 'SERVICE_LEVEL'
  | 'CATEGORY_LEVEL'
  | 'DISCOUNT_WITH_CASHBACK'
  | 'FULL_STACKING';

export type PromoFundingType = 'WARMPAWZ' | 'VENDOR' | 'SHARED';

export type ServiceCategory =
  | 'GROOMING'
  | 'VET'
  | 'TRAINING'
  | 'BOARDING'
  | 'WALKING'
  | 'ECOMMERCE';

export type PromoRuleType = 'GENERIC' | 'CUSTOMER_JOURNEY';

export interface PromoEngineCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface PromoEngineConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<PromoEngineCondition | PromoEngineConditionGroup>;
}

export interface PromoEngineBenefit {
  type: 'DISCOUNT' | 'CASHBACK';
  /** Admin UI uses PERCENT | FIXED; HLD uses PERCENTAGE | FIXED_AMOUNT — accept both */
  value_type?: 'PERCENTAGE' | 'FIXED' | 'FIXED_AMOUNT' | 'PERCENT';
  mode?: 'PERCENT' | 'FIXED';
  value?: number;
  max_amount?: number;
  maxAmount?: number;
  expiry_days?: number;
  expiryDays?: number;
  redeem_scope?: { services?: ServiceCategory[] };
  redeemScope?: ServiceCategory[];
}

export interface PromoEnginePromotionRow {
  id: string;
  code: string | null;
  name: string;
  status: PromoEngineStatus;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  stacking_policy: StackingPolicy | null;
  funding_type: PromoFundingType | null;
  funding_split: Record<string, unknown> | null;
  budget_limit: number | null;
  budget_consumed: number;
  commercial_campaign_id: string | null;
  service_categories: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PromoBenefitMode = 'discount' | 'cashback' | 'both';

/**
 * One rule row = one bill-amount range of its promotion. Range columns are null on
 * pre-range rows; null falls back to the promotion-level setting.
 */
export interface PromoEngineRuleRow {
  id: string;
  promotion_id: string;
  priority: number;
  condition_json: PromoEngineConditionGroup;
  benefit_json: PromoEngineBenefit[];
  rule_type: PromoRuleType;
  is_active: boolean;
  label?: string | null;
  sort_order?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  benefit_mode?: PromoBenefitMode | null;
  customer_copy?: Record<string, unknown> | null;
  per_user_limit?: number | null;
  daily_limit?: number | null;
  campaign_limit?: number | null;
  budget_limit?: number | null;
  budget_consumed?: number;
  archived_at?: string | null;
}

export interface PromoEngineLimitsRow {
  promotion_id: string;
  per_user: number | null;
  per_transaction: number | null;
  daily_limit: number | null;
  campaign_limit: number | null;
  budget_limit: number | null;
}

export interface BehaviourServiceSlice {
  completed_count?: number;
  last_completed_at?: string | null;
  total_spend?: number;
}

export interface CustomerBehaviourProfile {
  user_id: string;
  overall: {
    completed_orders?: number;
    total_spend?: number;
    average_order_value?: number;
    [key: string]: unknown;
  };
  services: Record<string, BehaviourServiceSlice>;
  updated_at?: string;
}

export interface EvaluateTransactionLine {
  id?: string;
  service_category?: string;
  amount: number;
}

export interface EvaluateTransaction {
  type?: string;
  service_category?: string;
  service_type?: string;
  vendor_id?: string;
  vendorId?: string;
  /** service_categories.id when already resolved on the server */
  categoryId?: string;
  channel?: 'tele' | 'appointment' | 'paybill' | 'ecommerce';
  city?: string;
  state?: string;
  amount?: number;
  package?: string;
  quantity?: number;
  /** Optional line items for SERVICE_LEVEL / CATEGORY_LEVEL stacking. */
  lines?: EvaluateTransactionLine[];
  [key: string]: unknown;
}

export interface EvaluateRequest {
  user_id: string;
  transaction: EvaluateTransaction;
  /** Optional override for simulator */
  behaviour_override?: Partial<CustomerBehaviourProfile>;
  /** Persist evaluation row for commit. Default true. Display quotes should pass false. */
  persist?: boolean;
  /** Admin simulator only — the HTTP route strips it for everyone else. */
  skip_benefit_cap?: boolean;
}

export interface ConditionExplainFailure {
  field: string;
  operator: string;
  required: unknown;
  actual: unknown;
  reason: string;
}

export interface AppliedBenefit {
  promotion_id: string;
  rule_id: string;
  benefit_type: 'DISCOUNT' | 'CASHBACK';
  amount: number;
  expiry_days?: number;
  redeem_scope?: ServiceCategory[];
  /** V/C/F redeem copied onto the wallet row at commit */
  redeem?: {
    letter: 'V' | 'C' | 'F';
    vendorId?: string;
    /** Multi-vendor redeem (letter V). Prefer this; `vendorId` kept as first for back-compat. */
    vendorIds?: string[];
    categoryId?: string;
    /** Multi-category redeem (letter C). Prefer this; `categoryId` kept as first for back-compat. */
    categoryIds?: string[];
    ecommerceCategoryId?: string;
    channels: Array<'tele' | 'appointment' | 'paybill' | 'ecommerce'>;
  };
  benefit_index: number;
}

export interface EvaluateResult {
  eligible: boolean;
  evaluation_id: string;
  winner_promotion_id?: string | null;
  /** Bill-amount range (rule row) of the winning promotion. */
  winner_rule_id?: string | null;
  range?: { id: string; label: string | null; min: number | null; max: number | null } | null;
  /** Admin-configured wording for the winning promotion, range overrides merged on top. */
  customer_copy?: PromoCustomerCopy | null;
  benefits: AppliedBenefit[];
  summary: {
    gross_amount: number;
    discount: number;
    payable: number;
    cashback: number;
  };
  explain: {
    failures: ConditionExplainFailure[];
    matched_promotions: string[];
    rejected_promotions: Array<{ promotion_id: string; reason: string }>;
  };
  /** Present only when the customer is at the global benefit cap for the current window. */
  benefit_cap?: BenefitCapNotice | null;
}

export interface CommitRequest {
  evaluation_id: string;
  transaction_id: string;
  payment_id?: string;
  user_id?: string;
  /** Invoice the cashback percent was quoted on. With wallet_used, cashback is scaled down. */
  invoice_amount?: number;
  /** Wallet balance spent on this same payment. Does not change the instant discount. */
  wallet_used?: number;
}

export interface ReverseRequest {
  transaction_id: string;
  evaluation_id?: string;
  user_id?: string;
  reason?: string;
}
