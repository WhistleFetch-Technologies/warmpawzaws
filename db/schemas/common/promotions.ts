/**
 * Schema for public.promotions
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:18:44.136Z
 */

export const promotionsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  name: 'text NOT NULL CHECK (name IS NOT NULL)',
  description: 'text',
  promotion_type: 'text NOT NULL CHECK (((promotion_type = ANY (ARRAY['discount'::text, 'cashback'::text, 'loyalty_points'::text, 'free_service'::text, 'flash_sale'::text, 'seasonal'::text, 'buy_x_get_y'::text, 'bundle'::text, 'first_order'::text, 'category_discount'::text, 'loyalty'::text, 'percentage'::text, 'flat'::text, 'bogo'::text, 'combo'::text, 'spotlight'::text])))) CHECK (promotion_type IS NOT NULL)',
  discount_type: 'text CHECK (((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))))',
  discount_value: 'numeric(10,2)',
  min_order_amount: 'numeric(10,2)',
  max_discount_amount: 'numeric(10,2)',
  start_date: 'date NOT NULL CHECK (start_date IS NOT NULL)',
  end_date: 'date NOT NULL CHECK (end_date IS NOT NULL)',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  priority: 'integer DEFAULT 0',
  applicable_services: 'jsonb DEFAULT '[]'',
  applicable_roles: 'jsonb DEFAULT '[]'',
  usage_limit: 'integer',
  usage_count: 'integer DEFAULT 0',
  code: 'character varying(50)'
};

/**
 * Indexes:
 * - idx_promotions_active: CREATE INDEX idx_promotions_active ON public.promotions USING btree (is_active)
 * - idx_promotions_code: CREATE INDEX idx_promotions_code ON public.promotions USING btree (code) WHERE (code IS NOT NULL)
 * - idx_promotions_dates: CREATE INDEX idx_promotions_dates ON public.promotions USING btree (start_date, end_date)
 * - idx_promotions_priority: CREATE INDEX idx_promotions_priority ON public.promotions USING btree (priority DESC)
 */

/**
 * Check Constraints:
 * - promotions_promotion_type_check: ((promotion_type = ANY (ARRAY['discount'::text, 'cashback'::text, 'loyalty_points'::text, 'free_service'::text, 'flash_sale'::text, 'seasonal'::text, 'buy_x_get_y'::text, 'bundle'::text, 'first_order'::text, 'category_discount'::text, 'loyalty'::text, 'percentage'::text, 'flat'::text, 'bogo'::text, 'combo'::text, 'spotlight'::text])))
 * - 2200_17034_10_not_null: end_date IS NOT NULL
 * - 2200_17034_2_not_null: name IS NOT NULL
 * - 2200_17034_4_not_null: promotion_type IS NOT NULL
 * - 2200_17034_9_not_null: start_date IS NOT NULL
 * - 2200_17034_1_not_null: id IS NOT NULL
 * - promotions_discount_type_check: ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])))
 */

