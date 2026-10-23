import { query, withTransaction } from '../../../../database/rds-connection';

type Row = Record<string, unknown>;

const READY_VENDOR = `
  l.status = 'active'
  AND v.is_active = true
  AND lower(COALESCE(v.status, '')) IN ('approved', 'active', 'live')
  AND EXISTS (
    SELECT 1 FROM vendor_availability_v2 va
    WHERE va.vendor_id = v.id
      AND 'tele' = ANY (COALESCE(va.service_styles, ARRAY[]::text[]))
  )
  AND (
    NOT $FORM$
    OR EXISTS (
      SELECT 1 FROM insurance_form_templates t
      WHERE t.vendor_id = v.id
        AND t.company_id = l.company_id
        AND t.status = 'published'
        AND (t.plan_id IS NULL OR t.plan_id = p.id)
    )
  )
`;

function readySql(requireForm: boolean): string {
  return READY_VENDOR.replace('$FORM$', requireForm ? 'true' : 'false');
}

export async function dbListCustomerPlans(requireForm: boolean): Promise<Row[]> {
  const res = await query(
    `SELECT p.id, p.company_id, c.name AS company_name, c.logo_url, p.name, p.product_type,
            p.highlights, p.premium_from, p.premium_unit, p.status, c.status AS company_status,
            (
              SELECT COUNT(*)::int
              FROM insurance_vendor_companies l
              JOIN vendors v ON v.id = l.vendor_id
              WHERE l.company_id = p.company_id AND ${readySql(requireForm)}
            ) AS ready_vendor_count
     FROM insurance_company_plans p
     JOIN insurance_companies c ON c.id = p.company_id
     WHERE p.status = 'published' AND c.status = 'active'
     ORDER BY p.sort_order ASC, p.name ASC`,
  );
  return res.rows as Row[];
}

export async function dbGetCustomerPlan(planId: string, requireForm: boolean): Promise<Row | null> {
  const res = await query(
    `SELECT p.id, p.company_id, c.name AS company_name, c.logo_url, p.name, p.product_type,
            p.highlights, p.premium_from, p.premium_unit, p.cover_options, p.sum_insured_options,
            p.copay_options, p.status, c.status AS company_status
     FROM insurance_company_plans p
     JOIN insurance_companies c ON c.id = p.company_id
     WHERE p.id = $1::uuid`,
    [planId],
  );
  const plan = (res.rows as Row[])[0];
  if (!plan) return null;
  const vendors = await query(
    `SELECT v.id AS vendor_id,
            COALESCE(NULLIF(v.business_name, ''), NULLIF(v.owner_name, ''), 'Insurance advisor') AS vendor_name,
            va.day_of_week,
            to_char(COALESCE(va.time_window_start, va.start_time), 'HH24:MI') AS start_time,
            (
              SELECT json_build_object(
                'vendorServiceId', vs.id,
                'name', vs.service_name,
                'price', COALESCE(vs.custom_price, vs.price, 0),
                'duration', COALESCE(vs.custom_duration, vs.duration_minutes, 30)
              )
              FROM vendor_services vs
              WHERE vs.vendor_id = v.id
                AND vs.service_style = 'tele'
                AND COALESCE(vs.is_enabled, false) = true
                AND (vs.publish_status = 'published' OR vs.publish_status IS NULL)
              ORDER BY CASE WHEN lower(vs.service_name) = 'tele consultation' THEN 0 ELSE 1 END
              LIMIT 1
            ) AS tele_service
     FROM insurance_vendor_companies l
     JOIN vendors v ON v.id = l.vendor_id
     JOIN insurance_company_plans p ON p.company_id = l.company_id AND p.id = $1::uuid
     LEFT JOIN vendor_availability_v2 va
       ON va.vendor_id = v.id
      AND COALESCE(va.is_available, true) = true
      AND COALESCE(va.is_deleted, false) = false
      AND 'tele' = ANY (COALESCE(va.service_styles, ARRAY[]::text[]))
     WHERE ${readySql(requireForm)}
     ORDER BY vendor_name ASC, va.day_of_week ASC, start_time ASC`,
    [planId],
  );
  return { ...plan, vendors: vendors.rows };
}

export async function dbFindApplicationByBooking(bookingId: string): Promise<Row | null> {
  const res = await query(`SELECT * FROM insurance_applications WHERE booking_id = $1::uuid LIMIT 1`, [bookingId]);
  return (res.rows as Row[])[0] || null;
}

export async function dbFindOpenApplication(petId: string, planId: string): Promise<Row | null> {
  const res = await query(
    `SELECT * FROM insurance_applications
     WHERE pet_id = $1::uuid AND plan_id = $2::uuid
       AND status NOT IN ('free_look_cancelled', 'dropped', 'cancelled')
     LIMIT 1`,
    [petId, planId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbGetBooking(bookingId: string): Promise<Row | null> {
  const res = await query(
    `SELECT id, customer_id, vendor_id, pet_id, notes, service_type, service_style,
            service_category, status
     FROM bookings WHERE id = $1::uuid`,
    [bookingId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbVendorDefaultPlan(vendorId: string): Promise<Row | null> {
  const res = await query(
    `SELECT p.id, p.company_id, p.status, c.status AS company_status
     FROM insurance_vendor_companies l
     JOIN insurance_company_plans p ON p.company_id = l.company_id AND p.status = 'published'
     JOIN insurance_companies c ON c.id = p.company_id AND c.status = 'active'
     WHERE l.vendor_id = $1::uuid AND l.status = 'active'
     ORDER BY p.sort_order ASC NULLS LAST, p.name ASC
     LIMIT 1`,
    [vendorId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbFirstCustomerPet(customerId: string): Promise<Row | null> {
  const res = await query(
    `SELECT id FROM pets
     WHERE customer_id = $1::uuid
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1`,
    [customerId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbPromoteConsultationBooked(applicationId: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE insurance_applications
       SET status = 'consulted', updated_at = NOW()
       WHERE id = $1::uuid AND status = 'consultation_booked'
       RETURNING id`,
      [applicationId],
    );
    if (!updated.rows[0]) return false;
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, note)
       VALUES ($1::uuid, 'consultation_booked', 'consulted', 'system', 'Tele marked complete')`,
      [applicationId],
    );
    return true;
  });
}

export async function dbInsertApplication(input: {
  bookingId: string;
  customerId: string;
  vendorId: string;
  companyId: string;
  planId: string | null;
  petId: string | null;
}): Promise<Row> {
  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO insurance_applications
         (booking_id, customer_id, vendor_id, company_id, plan_id, pet_id, status, template_version_id)
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'consultation_booked',
         (
           SELECT t.current_version_id
           FROM insurance_form_templates t
           WHERE t.vendor_id = $3::uuid
             AND t.company_id = $4::uuid
             AND t.status = 'published'
             AND t.current_version_id IS NOT NULL
             AND (t.plan_id IS NULL OR t.plan_id = $5::uuid)
           ORDER BY (t.plan_id IS NOT NULL) DESC
           LIMIT 1
         )
       )
       RETURNING *`,
      [input.bookingId, input.customerId, input.vendorId, input.companyId, input.planId, input.petId],
    );
    const row = inserted.rows[0] as Row;
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, actor_id, note)
       VALUES ($1::uuid, NULL, 'consultation_booked', 'system', NULL, 'Consultation booked')`,
      [row.id],
    );
    return row;
  });
}

export async function dbPlanCompany(planId: string): Promise<Row | null> {
  const res = await query(
    `SELECT p.id, p.company_id, p.status, c.status AS company_status
     FROM insurance_company_plans p
     JOIN insurance_companies c ON c.id = p.company_id
     WHERE p.id = $1::uuid`,
    [planId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbVendorReadyForPlan(vendorId: string, planId: string, requireForm: boolean): Promise<boolean> {
  const res = await query(
    `SELECT 1
     FROM insurance_vendor_companies l
     JOIN vendors v ON v.id = l.vendor_id
     JOIN insurance_company_plans p ON p.company_id = l.company_id AND p.id = $2::uuid
     WHERE l.vendor_id = $1::uuid AND ${readySql(requireForm)}
     LIMIT 1`,
    [vendorId, planId],
  );
  return (res.rows as Row[]).length > 0;
}

export async function dbGetApplication(id: string): Promise<Row | null> {
  const res = await query(`SELECT * FROM insurance_applications WHERE id = $1::uuid`, [id]);
  return (res.rows as Row[])[0] || null;
}

export async function dbSlugProfile(customerId: string, petId: string | null): Promise<{
  customer: Row | null;
  address: Row | null;
  pet: Row | null;
}> {
  const customer = await query(`SELECT * FROM customers WHERE id = $1::uuid`, [customerId]);
  const address = await query(
    `SELECT * FROM customer_addresses WHERE customer_id = $1::uuid
     ORDER BY COALESCE(is_default, false) DESC, created_at ASC NULLS LAST LIMIT 1`,
    [customerId],
  ).catch(async () =>
    query(`SELECT * FROM customer_addresses WHERE customer_id = $1::uuid LIMIT 1`, [customerId]),
  );
  const pet = petId
    ? await query(`SELECT * FROM pets WHERE id = $1::uuid AND customer_id = $2::uuid`, [petId, customerId])
    : { rows: [] };
  return {
    customer: (customer.rows as Row[])[0] || null,
    address: (address.rows as Row[])[0] || null,
    pet: (pet.rows as Row[])[0] || null,
  };
}

export async function dbTemplateVersion(id: string): Promise<Row | null> {
  const res = await query(`SELECT * FROM insurance_form_template_versions WHERE id = $1::uuid`, [id]);
  return (res.rows as Row[])[0] || null;
}

export async function dbLatestSubmission(applicationId: string): Promise<Row | null> {
  const res = await query(
    `SELECT * FROM insurance_form_submissions
     WHERE application_id = $1::uuid
     ORDER BY revision DESC LIMIT 1`,
    [applicationId],
  );
  return (res.rows as Row[])[0] || null;
}

function answerLines(answers: unknown): string[] {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return [];
  return Object.entries(answers as Record<string, unknown>)
    .slice(0, 8)
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.map(String).join(', ') : String(value ?? '');
      const trimmed = text.trim();
      return trimmed ? `${key}: ${trimmed.slice(0, 80)}` : '';
    })
    .filter(Boolean);
}

export async function dbInsertSubmission(input: {
  applicationId: string;
  templateVersionId: string;
  revision: number;
  answers: unknown;
  prefilledSlugs: string[];
  consentAt: string;
}): Promise<Row> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE insurance_form_submissions
       SET status = 'superseded'
       WHERE application_id = $1::uuid AND status <> 'superseded'`,
      [input.applicationId],
    );
    const inserted = await client.query(
      `INSERT INTO insurance_form_submissions
         (application_id, template_version_id, revision, answers, prefilled_slugs, consent_at, status)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::text[], $6::timestamptz, 'submitted')
       RETURNING *`,
      [
        input.applicationId,
        input.templateVersionId,
        input.revision,
        JSON.stringify(input.answers),
        input.prefilledSlugs,
        input.consentAt,
      ],
    );
    await client.query(
      `UPDATE insurance_applications
       SET status = 'form_submitted', updated_at = NOW()
       WHERE id = $1::uuid`,
      [input.applicationId],
    );
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, note)
       VALUES ($1::uuid, NULL, 'form_submitted', 'customer', $2)`,
      [input.applicationId, `Revision ${input.revision}`],
    );
    const row = inserted.rows[0] as Row;
    const summary = answerLines(input.answers);
    await client.query(
      `INSERT INTO chat_messages
         (booking_id, sender_phone, sender_type, message, message_type, metadata, is_read)
       SELECT a.booking_id, a.customer_id::text, 'customer', 'Information form submitted', 'card', $2::jsonb, false
       FROM insurance_applications a
       WHERE a.id = $1::uuid AND a.booking_id IS NOT NULL`,
      [input.applicationId, JSON.stringify({
        card: 'form_submission',
        applicationId: input.applicationId,
        version: 1,
        submissionId: String(row.id),
        revision: input.revision,
        summary,
      })],
    );
    return row;
  });
}
