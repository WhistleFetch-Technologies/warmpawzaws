import { termsInForce } from '../domain/commission';
import { todayIst } from '../domain/payout-periods';
import type {
  CommissionTermsInput,
  PayoutScheduleInput,
  VendorLinkCreateInput,
  VendorLinkUpdateInput,
} from '../dto/insurance-admin.requests';
import type {
  CommissionTermsDTO,
  InsuranceVendorCandidateDTO,
  VendorLinkDTO,
} from '../dto/insurance-admin.responses';
import {
  dbInsertCommissionTerms,
  dbListAllCommissionTerms,
  dbListCommissionTerms,
} from '../repos/commission-terms.repo';
import { dbGetInsuranceCompany } from '../repos/companies.repo';
import {
  dbClearLinkPayoutSchedule,
  dbListPayoutScheduleOverrides,
  dbSaveLinkPayoutSchedule,
} from '../repos/payout-schedules.repo';
import {
  dbCreateVendorLinkWithTerms,
  dbGetVendorLink,
  dbIsInsuranceVendor,
  dbListInsuranceVendorCandidates,
  dbListVendorLinks,
  dbUpdateVendorLink,
  type VendorLinkRow,
} from '../repos/vendor-links.repo';
import { auditInsuranceChange } from '../repos/insurance-audit';
import { InsuranceAdminError, insuranceNotFound } from '../shared/insurance-admin-response';
import { toPayoutScheduleDTO } from './schedule-dto';

export async function listVendorLinks(filter: {
  companyId?: string;
  vendorId?: string;
}): Promise<VendorLinkDTO[]> {
  const [links, terms, overrides] = await Promise.all([
    dbListVendorLinks(filter),
    dbListAllCommissionTerms(),
    dbListPayoutScheduleOverrides(),
  ]);
  const today = todayIst();
  return links.map((link) => {
    const linkTerms = terms.get(link.id) ?? [];
    const override = overrides.get(link.id);
    return {
      ...link,
      currentTerms: termsInForce(linkTerms, today) ?? linkTerms[0] ?? null,
      scheduleOverride: override ? toPayoutScheduleDTO(override) : null,
    };
  });
}

async function getVendorLinkDTO(id: string): Promise<VendorLinkDTO> {
  const link = await dbGetVendorLink(id);
  if (!link) throw insuranceNotFound('Vendor link');
  const [linked] = await listVendorLinks({ vendorId: link.vendorId, companyId: link.companyId });
  return linked;
}

async function requireLink(id: string): Promise<VendorLinkRow> {
  const link = await dbGetVendorLink(id);
  if (!link) throw insuranceNotFound('Vendor link');
  return link;
}

export function listInsuranceVendorCandidates(search?: string): Promise<InsuranceVendorCandidateDTO[]> {
  return dbListInsuranceVendorCandidates(search);
}

export async function createVendorLink(
  input: VendorLinkCreateInput,
  actorId: string | null,
): Promise<VendorLinkDTO> {
  if (!(await dbIsInsuranceVendor(input.vendorId))) {
    throw new InsuranceAdminError(422, 'NOT_INSURANCE_VENDOR', 'Only insurance vendors can be linked to a company');
  }
  const company = await dbGetInsuranceCompany(input.companyId);
  if (!company) throw insuranceNotFound('Insurance company');
  if (company.status !== 'active') {
    throw new InsuranceAdminError(422, 'COMPANY_INACTIVE', `${company.name} is inactive — activate it first`);
  }
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new InsuranceAdminError(400, 'INVALID_DATES', 'End date must be on or after the start date');
  }
  const id = await dbCreateVendorLinkWithTerms(input, actorId);
  await auditInsuranceChange({
    entityType: 'insurance_vendor_link',
    entityId: id,
    action: 'create',
    actorId,
    newValues: { vendorId: input.vendorId, companyId: input.companyId, terms: input.terms },
  });
  return getVendorLinkDTO(id);
}

export async function updateVendorLink(
  id: string,
  patch: VendorLinkUpdateInput,
  actorId: string | null,
): Promise<VendorLinkDTO> {
  const link = await requireLink(id);
  const from = patch.effectiveFrom ?? link.effectiveFrom;
  const to = patch.effectiveTo === undefined ? link.effectiveTo : patch.effectiveTo;
  if (to && to < from) {
    throw new InsuranceAdminError(400, 'INVALID_DATES', 'End date must be on or after the start date');
  }
  await dbUpdateVendorLink(id, patch, actorId);
  await auditInsuranceChange({
    entityType: 'insurance_vendor_link',
    entityId: id,
    action: 'update',
    actorId,
    newValues: { ...patch },
  });
  return getVendorLinkDTO(id);
}

export async function listVendorLinkTerms(id: string): Promise<CommissionTermsDTO[]> {
  await requireLink(id);
  return dbListCommissionTerms(id);
}

/** Terms are append-only so past periods keep the rate that applied when each policy was issued. */
export async function addVendorLinkTerms(
  id: string,
  terms: CommissionTermsInput,
  actorId: string | null,
): Promise<CommissionTermsDTO[]> {
  await requireLink(id);
  await dbInsertCommissionTerms(id, terms, actorId);
  await auditInsuranceChange({
    entityType: 'insurance_commission_terms',
    entityId: id,
    action: 'add_terms',
    actorId,
    newValues: { ...terms },
  });
  return dbListCommissionTerms(id);
}

export async function setVendorLinkPayoutSchedule(
  id: string,
  input: PayoutScheduleInput | { useDefault: true },
  actorId: string | null,
): Promise<VendorLinkDTO> {
  await requireLink(id);
  if ('useDefault' in input) await dbClearLinkPayoutSchedule(id);
  else await dbSaveLinkPayoutSchedule(id, input, actorId);
  await auditInsuranceChange({
    entityType: 'insurance_payout_schedule',
    entityId: id,
    action: 'useDefault' in input ? 'use_default_schedule' : 'set_schedule',
    actorId,
    newValues: { ...input },
  });
  return getVendorLinkDTO(id);
}
