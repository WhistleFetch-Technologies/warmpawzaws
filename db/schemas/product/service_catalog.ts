/**
 * Schema for public.service_catalog
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:23:54.552Z
 */

export const service_catalogSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL) CHECK (service_id IS NOT NULL) CHECK (specialization_ids IS NOT NULL)',
  service_id: 'text NOT NULL UNIQUE CHECK (service_id IS NOT NULL)',
  service_name: 'text NOT NULL CHECK (service_name IS NOT NULL)',
  display_name: 'text',
  description: 'text',
  category_id: 'text',
  category_name: 'text',
  sub_category_id: 'text',
  sub_category_name: 'text',
  applicable_roles: 'text[] NOT NULL DEFAULT '{}' CHECK (applicable_roles IS NOT NULL)',
  service_style: 'text CHECK (((service_style = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text, 'all'::text]))))',
  base_price: 'numeric(10,2) DEFAULT 0',
  duration_minutes: 'integer DEFAULT 30',
  status: 'text NOT NULL DEFAULT 'active' CHECK (((publish_status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))) CHECK (status IS NOT NULL) CHECK (((status = ANY (ARRAY['active'::text, 'archived'::text, 'draft'::text]))))',
  publish_status: 'text DEFAULT 'published' CHECK (((publish_status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))))',
  metadata: 'jsonb',
  display_order: 'integer DEFAULT 0',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  specialization_ids: 'text[] NOT NULL DEFAULT '{}' CHECK (specialization_ids IS NOT NULL)',
  tax_category_id: 'uuid', // REFERENCES tax_categories(id),
  hsn_code_id: 'uuid', // REFERENCES hsn_codes(id)
};

/**
 * Foreign Keys:
 * - tax_category_id -> public.tax_categories.id
 * - hsn_code_id -> public.hsn_codes.id
 */

/**
 * Indexes:
 * - idx_service_catalog_applicable_roles: CREATE INDEX idx_service_catalog_applicable_roles ON public.service_catalog USING gin (applicable_roles)
 * - idx_service_catalog_category: CREATE INDEX idx_service_catalog_category ON public.service_catalog USING btree (category_id)
 * - idx_service_catalog_hsn_code: CREATE INDEX idx_service_catalog_hsn_code ON public.service_catalog USING btree (hsn_code_id) WHERE (hsn_code_id IS NOT NULL)
 * - idx_service_catalog_service_style: CREATE INDEX idx_service_catalog_service_style ON public.service_catalog USING btree (service_style)
 * - idx_service_catalog_specialization_ids: CREATE INDEX idx_service_catalog_specialization_ids ON public.service_catalog USING gin (specialization_ids)
 * - idx_service_catalog_status: CREATE INDEX idx_service_catalog_status ON public.service_catalog USING btree (status, publish_status)
 * - idx_service_catalog_sub_category: CREATE INDEX idx_service_catalog_sub_category ON public.service_catalog USING btree (sub_category_id)
 * - idx_service_catalog_tax_category: CREATE INDEX idx_service_catalog_tax_category ON public.service_catalog USING btree (tax_category_id) WHERE (tax_category_id IS NOT NULL)
 * - service_catalog_service_id_key: CREATE UNIQUE INDEX service_catalog_service_id_key ON public.service_catalog USING btree (service_id)
 */

/**
 * Check Constraints:
 * - service_catalog_service_style_check: ((service_style = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text, 'all'::text])))
 * - 2200_19945_10_not_null: applicable_roles IS NOT NULL
 * - 2200_19945_1_not_null: id IS NOT NULL
 * - 2200_19945_3_not_null: service_name IS NOT NULL
 * - service_catalog_publish_status_check: ((publish_status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
 * - 2200_19945_2_not_null: service_id IS NOT NULL
 * - 2200_19945_20_not_null: specialization_ids IS NOT NULL
 * - 2200_19945_14_not_null: status IS NOT NULL
 * - service_catalog_status_check: ((status = ANY (ARRAY['active'::text, 'archived'::text, 'draft'::text])))
 */

