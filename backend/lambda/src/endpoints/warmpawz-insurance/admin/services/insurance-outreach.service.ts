import {
  INSURANCE_STATUS_LABELS,
  INSURANCE_STATUS_STAGE,
  insuranceStatusLabel,
  isInsuranceApplicationStatus,
} from '../domain/application-status';
import type { OutreachQuery } from '../dto/insurance-admin.requests';
import type {
  ApplicationEventDTO,
  InsuranceDashboardDTO,
  OutreachListDTO,
  OutreachRowDTO,
} from '../dto/insurance-admin.responses';
import { dbCountActiveInsuranceCompanies } from '../repos/companies.repo';
import {
  dbApplicationExists,
  dbListApplicationEvents,
  dbListOutreach,
  dbOutreachMetrics,
} from '../repos/outreach.repo';
import { isoDate, isoTs, num, numOrNull, str, vendorDisplayName, type Row } from '../repos/row-mappers';
import { dbCountActiveVendorLinks } from '../repos/vendor-links.repo';
import { insuranceNotFound } from '../shared/insurance-admin-response';

function mapOutreachRow(r: Row): OutreachRowDTO {
  const status = isInsuranceApplicationStatus(r.status) ? r.status : 'consultation_booked';
  const bookingId = str(r.booking_id);
  const applicationId = str(r.application_id);
  const petId = str(r.pet_id);
  const companyId = str(r.company_id);
  return {
    rowId: bookingId ?? applicationId ?? '',
    applicationId,
    bookingId,
    customer: { id: String(r.customer_id), name: str(r.customer_name), phone: str(r.customer_phone) },
    vendor: { id: String(r.vendor_id), name: vendorDisplayName(r) },
    pet: petId ? { id: petId, name: str(r.pet_name), species: str(r.pet_species) } : null,
    company: companyId ? { id: companyId, name: str(r.company_name) ?? 'Unknown company' } : null,
    status,
    statusLabel: INSURANCE_STATUS_LABELS[status],
    stage: INSURANCE_STATUS_STAGE[status],
    statusDerived: r.status_derived === true,
    booking: bookingId
      ? {
          date: isoDate(r.booking_date),
          time: str(r.booking_time),
          status: str(r.booking_status),
          paymentStatus: str(r.booking_payment_status),
          fee: num(r.consultation_fee),
        }
      : null,
    policy: {
      number: str(r.policy_number),
      premium: numOrNull(r.premium_amount),
      issuedAt: isoTs(r.policy_issued_at),
      documentUrl: str(r.policy_document_url),
    },
    reachedOutAt: isoTs(r.reached_out_at) ?? '',
    lastActivityAt: isoTs(r.last_activity_at) ?? '',
  };
}

export async function listInsuranceOutreach(q: OutreachQuery): Promise<OutreachListDTO> {
  const { rows, total } = await dbListOutreach(q);
  return { items: rows.map(mapOutreachRow), page: q.page, pageSize: q.pageSize, total };
}

export async function getInsuranceDashboard(range: { from?: string; to?: string }): Promise<InsuranceDashboardDTO> {
  const [metrics, activeCompanies, activeVendorLinks] = await Promise.all([
    dbOutreachMetrics(range),
    dbCountActiveInsuranceCompanies(),
    dbCountActiveVendorLinks(),
  ]);
  return {
    range: { from: range.from ?? null, to: range.to ?? null },
    outreach: metrics.outreach,
    upcomingConsultations: metrics.upcoming,
    inProgress: metrics.inProgress,
    awaitingExternal: metrics.awaitingExternal,
    policiesIssued: metrics.issued,
    premiumIssued: metrics.premiumIssued,
    cancelled: metrics.cancelled,
    activeCompanies,
    activeVendorLinks,
    generatedAt: new Date().toISOString(),
  };
}

export async function listInsuranceApplicationEvents(applicationId: string): Promise<ApplicationEventDTO[]> {
  if (!(await dbApplicationExists(applicationId))) throw insuranceNotFound('Insurance application');
  const rows = await dbListApplicationEvents(applicationId);
  return rows.map((r) => {
    const fromStatus = str(r.from_status);
    const toStatus = String(r.to_status);
    return {
      id: String(r.id),
      fromStatus,
      fromLabel: fromStatus ? insuranceStatusLabel(fromStatus) : null,
      toStatus,
      toLabel: insuranceStatusLabel(toStatus),
      actorType: String(r.actor_type),
      actorId: str(r.actor_id),
      note: str(r.note),
      createdAt: isoTs(r.created_at) ?? '',
    };
  });
}
