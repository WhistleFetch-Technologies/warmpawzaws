import { chatCardSchema, type ChatCard } from '@warmpawz/shared-types';
import { withTransaction } from '../../../database/rds-connection';
import { query } from '../../../database/rds-connection';

type Row = Record<string, unknown>;

export async function dbGetVendorApplication(vendorId: string, applicationId: string): Promise<Row | null> {
  const res = await query(
    `SELECT * FROM insurance_applications WHERE id = $1::uuid AND vendor_id = $2::uuid`,
    [applicationId, vendorId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbListVendorApplications(vendorId: string): Promise<Row[]> {
  const res = await query(
    `SELECT a.id, a.booking_id, a.status, a.plan_id, a.pet_id, a.customer_id, a.company_id, a.updated_at,
            a.payment_link_expires_at,
            b.status AS booking_status,
            p.name AS plan_name,
            co.name AS company_name,
            cu.full_name AS customer_name,
            pet.name AS pet_name,
            pet.species AS pet_species,
            pet.breed AS pet_breed
     FROM insurance_applications a
     LEFT JOIN bookings b ON b.id = a.booking_id
     LEFT JOIN insurance_company_plans p ON p.id = a.plan_id
     LEFT JOIN insurance_companies co ON co.id = a.company_id
     LEFT JOIN customers cu ON cu.id = a.customer_id
     LEFT JOIN pets pet ON pet.id = a.pet_id
     WHERE a.vendor_id = $1::uuid
     ORDER BY a.updated_at DESC`,
    [vendorId],
  );
  return res.rows as Row[];
}

export async function dbGetBookingStatus(bookingId: string): Promise<string | null> {
  const res = await query(`SELECT status FROM bookings WHERE id = $1::uuid`, [bookingId]);
  const row = (res.rows as Row[])[0];
  return row?.status != null ? String(row.status) : null;
}

export async function dbInsertChatCard(input: {
  bookingId: string;
  senderPhone: string;
  message: string;
  card: ChatCard;
  fromStatus: string | null;
  toStatus: string;
  actorId: string;
}): Promise<{ messageId: string }> {
  const parsed = chatCardSchema.parse(input.card);
  return withTransaction(async (client) => {
    const message = await client.query(
      `INSERT INTO chat_messages
         (booking_id, sender_phone, sender_type, message, message_type, metadata, is_read)
       VALUES ($1::uuid, $2, 'vendor', $3, 'card', $4::jsonb, false)
       RETURNING id`,
      [input.bookingId, input.senderPhone, input.message, JSON.stringify(parsed)],
    );
    await client.query(
      `UPDATE insurance_applications SET status = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [parsed.applicationId, input.toStatus],
    );
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, actor_id, note)
       VALUES ($1::uuid, $2, $3, 'vendor', $4, $5)`,
      [parsed.applicationId, input.fromStatus, input.toStatus, input.actorId, parsed.card],
    );
    return { messageId: String(message.rows[0].id) };
  });
}

export async function dbPinTemplateVersion(applicationId: string, templateVersionId: string): Promise<void> {
  await query(
    `UPDATE insurance_applications SET template_version_id = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`,
    [applicationId, templateVersionId],
  );
}

export async function dbPublishedVersionForVendor(vendorId: string, templateId: string): Promise<Row | null> {
  const res = await query(
    `SELECT v.*
     FROM insurance_form_templates t
     JOIN insurance_form_template_versions v ON v.id = t.current_version_id
     WHERE t.id = $1::uuid AND t.vendor_id = $2::uuid AND t.status = 'published'`,
    [templateId, vendorId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbSetChangeNotes(applicationId: string, notes: Record<string, string>): Promise<void> {
  await query(
    `UPDATE insurance_form_submissions
     SET status = 'changes_requested', change_notes = $2::jsonb
     WHERE id = (
       SELECT id FROM insurance_form_submissions
       WHERE application_id = $1::uuid
       ORDER BY revision DESC LIMIT 1
     )`,
    [applicationId, JSON.stringify(notes)],
  );
}
