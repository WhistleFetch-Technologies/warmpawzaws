import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3BrowserUploadClient } from '../../../../utils/s3-presign-upload';
import { todayIst } from '../domain/payout-periods';
import { buildReconciliationRows, reconciliationCsv, summarizeReconciliation } from '../domain/reconciliation';
import type { ReconciliationExportQuery, ReconciliationQuery } from '../dto/insurance-admin.requests';
import type {
  PolicyDocumentsDTO,
  ReconciliationDTO,
  ReconciliationExportDTO,
  ReconciliationPolicyDTO,
} from '../dto/insurance-admin.responses';
import { dbGetPolicyDocuments, dbListCompletedPolicies } from '../repos/reconciliation.repo';
import { insuranceNotFound } from '../shared/insurance-admin-response';
import { loadPayoutLedger } from './insurance-payouts.service';

/** Keeps every settled period, so ranges older than the payout page's one-year window still resolve. */
const FULL_HISTORY_DAYS = 36_500;
const DOCUMENT_URL_TTL_SECONDS = 3600;

function resolveRange(q: { from?: string; to?: string }): { from: string; to: string } {
  const today = todayIst();
  return { from: q.from ?? `${today.slice(0, 7)}-01`, to: q.to ?? today };
}

async function loadRows(q: ReconciliationExportQuery, range: { from: string; to: string }): Promise<ReconciliationPolicyDTO[]> {
  const [records, ledger] = await Promise.all([
    dbListCompletedPolicies({ ...range, companyId: q.companyId, vendorId: q.vendorId, search: q.search }),
    loadPayoutLedger(todayIst(), FULL_HISTORY_DAYS),
  ]);
  return buildReconciliationRows(records, ledger.periods);
}

export async function getReconciliation(q: ReconciliationQuery): Promise<ReconciliationDTO> {
  const range = resolveRange(q);
  const rows = await loadRows(q, range);
  const start = (q.page - 1) * q.pageSize;
  return {
    range,
    summary: summarizeReconciliation(rows),
    items: rows.slice(start, start + q.pageSize),
    page: q.page,
    pageSize: q.pageSize,
    total: rows.length,
  };
}

export async function exportReconciliation(q: ReconciliationExportQuery): Promise<ReconciliationExportDTO> {
  const range = resolveRange(q);
  const rows = await loadRows(q, range);
  return {
    filename: `warmpawz-insurance-policies-${range.from}-to-${range.to}.csv`,
    csv: reconciliationCsv(rows),
    rowCount: rows.length,
  };
}

export async function getPolicyDocuments(applicationId: string): Promise<PolicyDocumentsDTO> {
  const row = await dbGetPolicyDocuments(applicationId);
  if (!row) throw insuranceNotFound('Insurance policy');
  const bucket = process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || '';
  const documents = await Promise.all(
    row.documents.map(async (d) => ({
      name: d.name,
      mime: d.mime,
      url: bucket
        ? await getSignedUrl(s3BrowserUploadClient, new GetObjectCommand({ Bucket: bucket, Key: d.s3Key }), {
            expiresIn: DOCUMENT_URL_TTL_SECONDS,
          })
        : null,
    })),
  );
  if (documents.length === 0 && row.legacyDocumentUrl) {
    documents.push({ name: 'Policy document', mime: null, url: row.legacyDocumentUrl });
  }
  return {
    applicationId: row.applicationId,
    policyNumber: row.policyNumber,
    startDate: row.startDate,
    endDate: row.endDate,
    documents,
  };
}
