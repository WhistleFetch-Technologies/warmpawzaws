/**
 * Schema for public.pricing_rules
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:17:54.351Z
 */

export const pricing_rulesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL) CHECK (room_id IS NOT NULL) CHECK (vendor_id IS NOT NULL)',
  vendor_id: 'uuid NOT NULL CHECK (vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  room_id: 'uuid NOT NULL CHECK (room_id IS NOT NULL)', // REFERENCES boarding_rooms(id),
  room_name: 'text NOT NULL CHECK (room_name IS NOT NULL)',
  base_night_price: 'numeric(10,2) NOT NULL CHECK (base_night_price IS NOT NULL)',
  size_based_pricing: 'jsonb DEFAULT '{}'',
  seasonal_pricing: 'jsonb DEFAULT '[]'',
  special_offers: 'jsonb DEFAULT '[]'',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - vendor_id -> public.vendors.id
 * - room_id -> public.boarding_rooms.id
 */

/**
 * Indexes:
 * - idx_pricing_rules_active: CREATE INDEX idx_pricing_rules_active ON public.pricing_rules USING btree (vendor_id) WHERE (is_active = true)
 * - idx_pricing_rules_room_id: CREATE INDEX idx_pricing_rules_room_id ON public.pricing_rules USING btree (room_id)
 * - idx_pricing_rules_vendor_id: CREATE INDEX idx_pricing_rules_vendor_id ON public.pricing_rules USING btree (vendor_id)
 */

/**
 * Check Constraints:
 * - 2200_19680_4_not_null: room_name IS NOT NULL
 * - 2200_19680_1_not_null: id IS NOT NULL
 * - 2200_19680_3_not_null: room_id IS NOT NULL
 * - 2200_19680_2_not_null: vendor_id IS NOT NULL
 * - 2200_19680_5_not_null: base_night_price IS NOT NULL
 */

