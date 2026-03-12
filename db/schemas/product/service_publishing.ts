/**
 * Schema for public.service_publishing
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:24:27.613Z
 */

export const service_publishingSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL) CHECK (service_id IS NOT NULL) CHECK (vendor_id IS NOT NULL) CHECK (((service_style = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text, 'at_clinic'::text, 'video_consultation'::text, 'home_visit'::text]))))',
  service_id: 'uuid NOT NULL CHECK (service_id IS NOT NULL)', // REFERENCES services(id),
  vendor_id: 'uuid NOT NULL CHECK (vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  publish_status: 'text NOT NULL DEFAULT 'draft' CHECK (publish_status IS NOT NULL) CHECK (((publish_status = ANY (ARRAY['draft'::text, 'pending'::text, 'published'::text, 'rejected'::text]))))',
  service_style: 'text NOT NULL CHECK (service_style IS NOT NULL) CHECK (((service_style = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text, 'at_clinic'::text, 'video_consultation'::text, 'home_visit'::text]))))',
  published_at: 'timestamptz',
  rejected_at: 'timestamptz',
  rejection_reason: 'text',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - service_id -> public.services.id
 * - vendor_id -> public.vendors.id
 */

/**
 * Unique Constraints:
 * - service_publishing_service_id_vendor_id_service_style_key: (service_id, vendor_id, service_style)
 */

/**
 * Indexes:
 * - idx_service_publishing_style_status: CREATE INDEX idx_service_publishing_style_status ON public.service_publishing USING btree (service_style, publish_status)
 * - idx_service_publishing_vendor_status: CREATE INDEX idx_service_publishing_vendor_status ON public.service_publishing USING btree (vendor_id, publish_status)
 * - service_publishing_service_id_vendor_id_service_style_key: CREATE UNIQUE INDEX service_publishing_service_id_vendor_id_service_style_key ON public.service_publishing USING btree (service_id, vendor_id, service_style)
 */

/**
 * Check Constraints:
 * - 2200_19210_4_not_null: publish_status IS NOT NULL
 * - 2200_19210_1_not_null: id IS NOT NULL
 * - service_publishing_publish_status_check: ((publish_status = ANY (ARRAY['draft'::text, 'pending'::text, 'published'::text, 'rejected'::text])))
 * - 2200_19210_2_not_null: service_id IS NOT NULL
 * - 2200_19210_5_not_null: service_style IS NOT NULL
 * - 2200_19210_3_not_null: vendor_id IS NOT NULL
 * - service_publishing_service_style_check: ((service_style = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text, 'at_clinic'::text, 'video_consultation'::text, 'home_visit'::text])))
 */

