import type { Context } from 'hono';
import { z } from 'zod';
import { INSURANCE_KANBAN_COLUMN, normalizeInsuranceStatus, paymentLinkCardSchema, policyDocumentsCardSchema } from '@warmpawz/shared-types';
import { termsInForce } from '../admin/domain/commission';
import { InsuranceAdminError, insuranceAdminError, insuranceAdminOk } from '../admin/shared/insurance-admin-response';
import { dbGetVendorApplication, dbInsertChatCard, dbListVendorApplications } from './cards.repo';
import {
  buildCommissionSnapshot,
  clawbackSnapshot,
  paymentLinkIssues,
  policyDocumentIssues,
  transitionBlockReason,
} from '../shared/lifecycle';
import {
  dbClawback,
  dbCompanyDomains,
  dbConfirmSnapshot,
  dbConfirmSnapshotRow,
  dbDueAutoConfirm,
  dbDueExpiry,
  dbLinkTerms,
  dbListReports,
  dbPolicy,
  dbReviewReport,
  dbSavePaymentLink,
  dbSavePolicy,
  dbSetStatus,
  dbUpsertReport,
} from './lifecycle.repo';
import { query } from '../../../database/rds-connection';

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

async function loadOwned(c: Context) {
  const application = await dbGetVendorApplication(c.req.param('vendorId'), c.req.param('id'));
  if (!application) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Application not found');
  return application;
}

export async function listApplicationsBoardHandler(c: Context) {
  try {
    const rows = await dbListVendorApplications(c.req.param('vendorId'));
    const applications = rows.map((row) => {
      const status = normalizeInsuranceStatus(row.status) || 'consultation_booked';
      return { ...row, status, column: INSURANCE_KANBAN_COLUMN[status] };
    });
    const counts = applications.reduce<Record<string, number>>((acc, row) => {
      acc[row.column] = (acc[row.column] || 0) + 1;
      return acc;
    }, {});
    return insuranceAdminOk(c, { applications, counts });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function applicationDetailHandler(c: Context) {
  try {
    const application = await loadOwned(c);
    const events = await query(
      `SELECT from_status, to_status, actor_type, note, created_at
       FROM insurance_application_events WHERE application_id = $1::uuid ORDER BY created_at`,
      [application.id],
    );
    const policy = await dbPolicy(String(application.id));
    return insuranceAdminOk(c, { application, events: events.rows, policy });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function paymentLinkHandler(c: Context) {
  try {
    const body = z.object({
      url: z.string().min(1),
      amount: z.number().nonnegative(),
      expiresAt: z.string().optional(),
    }).parse(await c.req.json());
    const application = await loadOwned(c);
    const expiresAt = body.expiresAt || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const issues = paymentLinkIssues({
      url: body.url,
      domains: await dbCompanyDomains(String(application.company_id)),
      expiresAt,
      now: new Date(),
    });
    if (issues.length) throw new InsuranceAdminError(422, 'PAYMENT_LINK', issues.join('; '));
    const blocked = transitionBlockReason(String(application.status), 'payment_link_sent');
    if (blocked) throw new InsuranceAdminError(422, 'INVALID_TRANSITION', blocked);
    if (!application.booking_id) throw new InsuranceAdminError(422, 'NO_BOOKING', 'Application has no consultation booking');
    await dbSavePaymentLink(String(application.id), body.url, expiresAt, body.amount);
    const card = paymentLinkCardSchema.parse({
      card: 'payment_link',
      applicationId: String(application.id),
      version: 1,
      url: body.url,
      amount: body.amount,
      expiresAt,
    });
    const saved = await dbInsertChatCard({
      bookingId: String(application.booking_id),
      senderPhone: c.req.param('vendorId'),
      message: 'Payment link',
      card,
      fromStatus: normalizeInsuranceStatus(application.status),
      toStatus: 'payment_link_sent',
      actorId: c.req.param('vendorId'),
    });
    return insuranceAdminOk(c, { messageId: saved.messageId, status: 'payment_link_sent', expiresAt });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function policyUploadHandler(c: Context) {
  try {
    const body = z.object({
      policyNumber: z.string(),
      issuedPremium: z.number(),
      startDate: z.string(),
      endDate: z.string(),
      documents: z.array(z.object({
        s3Key: z.string().min(1),
        name: z.string(),
        mime: z.string(),
        size: z.number().int().nonnegative(),
      })).min(1),
    }).parse(await c.req.json());
    const issues = policyDocumentIssues(body);
    if (issues.length) throw new InsuranceAdminError(422, 'POLICY_DOCUMENT', issues.join('; '));
    const application = await loadOwned(c);
    const blocked = transitionBlockReason(String(application.status), 'policy_uploaded');
    if (blocked) throw new InsuranceAdminError(422, 'INVALID_TRANSITION', blocked);
    if (!application.booking_id) throw new InsuranceAdminError(422, 'NO_BOOKING', 'Application has no consultation booking');
    await dbSavePolicy({ applicationId: String(application.id), ...body });
    const card = policyDocumentsCardSchema.parse({
      card: 'policy_documents',
      applicationId: String(application.id),
      version: 1,
      policyNumber: body.policyNumber.trim(),
      documentCount: body.documents.length,
    });
    const saved = await dbInsertChatCard({
      bookingId: String(application.booking_id),
      senderPhone: c.req.param('vendorId'),
      message: 'Policy documents',
      card,
      fromStatus: normalizeInsuranceStatus(application.status),
      toStatus: 'policy_uploaded',
      actorId: c.req.param('vendorId'),
    });
    return insuranceAdminOk(c, { messageId: saved.messageId, status: 'policy_uploaded' });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function freeLookHandler(c: Context) {
  try {
    const application = await loadOwned(c);
    const blocked = transitionBlockReason(String(application.status), 'free_look_cancelled');
    if (blocked) throw new InsuranceAdminError(422, 'INVALID_TRANSITION', blocked);
    const row = await dbConfirmSnapshotRow(String(application.id));
    if (!row) throw new InsuranceAdminError(422, 'NO_SNAPSHOT', 'This policy has no commission snapshot to reverse');
    await dbClawback(
      String(application.id),
      clawbackSnapshot({
        basis: row.basis as 'percent_of_premium',
        rate: Number(row.rate),
        vendorCommissionRate: row.vendor_commission_rate == null ? null : Number(row.vendor_commission_rate),
        baseAmount: Number(row.base_amount),
        commissionAmount: Number(row.commission_amount),
        gstRate: Number(row.gst_rate),
        gstAmount: Number(row.gst_amount),
        totalAmount: Number(row.total_amount),
        termsId: row.terms_id ? String(row.terms_id) : null,
      }),
      c.req.param('vendorId'),
    );
    return insuranceAdminOk(c, { status: 'free_look_cancelled' });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function submitReportHandler(c: Context) {
  try {
    const body = z.object({
      vendorCompanyId: z.string().uuid(),
      periodStart: z.string(),
      periodEnd: z.string(),
      lines: z.array(z.unknown()).default([]),
      reportedAmount: z.number().nonnegative(),
      submit: z.boolean().default(false),
    }).parse(await c.req.json());
    const link = await query(
      `SELECT id FROM insurance_vendor_companies WHERE id = $1::uuid AND vendor_id = $2::uuid`,
      [body.vendorCompanyId, c.req.param('vendorId')],
    );
    if (!link.rows[0]) throw new InsuranceAdminError(404, 'NOT_FOUND', 'Vendor link not found');
    const expected = await query(
      `SELECT COALESCE(SUM(s.total_amount), 0) AS expected
       FROM insurance_commission_snapshots s
       JOIN insurance_applications a ON a.id = s.application_id
       WHERE a.vendor_id = $1::uuid
         AND a.policy_issued_at >= $2::date
         AND a.policy_issued_at < ($3::date + INTERVAL '1 day')`,
      [c.req.param('vendorId'), body.periodStart, body.periodEnd],
    );
    const report = await dbUpsertReport({
      vendorCompanyId: body.vendorCompanyId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      lines: body.lines,
      expected: Number((expected.rows[0] as { expected: string }).expected),
      reported: body.reportedAmount,
      submit: body.submit,
    });
    if (!report) throw new InsuranceAdminError(422, 'REPORT_LOCKED', 'This report is already submitted');
    return insuranceAdminOk(c, { report });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function runInsuranceJobs(): Promise<{ confirmed: number; expired: number; skipped: string[] }> {
  const skipped: string[] = [];
  let confirmed = 0;
  const due = await dbDueAutoConfirm(7);
  for (const row of due) {
    const termRows = await dbLinkTerms(String(row.vendor_id), String(row.company_id));
    const terms = termRows.map((term) => ({
      id: String(term.id),
      basis: term.basis as 'percent_of_premium',
      rate: Number(term.rate),
      vendorCommissionRate: term.vendor_commission_rate == null ? null : Number(term.vendor_commission_rate),
      gstRate: term.gst_rate == null ? Number.NaN : Number(term.gst_rate),
      effectiveFrom: term.effective_from instanceof Date ? term.effective_from.toISOString().slice(0, 10) : String(term.effective_from).slice(0, 10),
    }));
    const snapshot = buildCommissionSnapshot({
      terms: termsInForce(terms, istToday()),
      premium: Number(row.issued_premium),
      vendorCommissionAmount: row.vendor_commission_amount == null ? null : Number(row.vendor_commission_amount),
    });
    if ('error' in snapshot) {
      skipped.push(String(row.id));
      continue;
    }
    const linkId = termRows[0]?.link_id ? String(termRows[0].link_id) : null;
    await dbConfirmSnapshot({
      applicationId: String(row.id),
      linkId,
      snapshot,
      confirmedBy: 'auto',
    });
    confirmed += 1;
  }
  const expiredRows = await dbDueExpiry();
  for (const row of expiredRows) {
    await dbSetStatus(String(row.id), 'payment_link_expired', 'payment_link_sent', 'system', 'Payment link expired');
  }
  return { confirmed, expired: expiredRows.length, skipped };
}

export async function listReportsHandler(c: Context) {
  try {
    return insuranceAdminOk(c, { reports: await dbListReports() });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}

export async function reviewReportHandler(c: Context) {
  try {
    const body = z.object({
      status: z.enum(['accepted', 'disputed']),
      note: z.string().default(''),
    }).parse(await c.req.json());
    const report = await dbReviewReport(c.req.param('id'), body.status, body.note, 'admin');
    if (!report) throw new InsuranceAdminError(422, 'REPORT_NOT_SUBMITTED', 'Only a submitted report can be reviewed');
    return insuranceAdminOk(c, { report });
  } catch (error) {
    return insuranceAdminError(c, error);
  }
}
