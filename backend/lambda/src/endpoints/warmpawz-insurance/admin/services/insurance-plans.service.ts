import { isInsuranceFormTemplateRequired } from '../../../../lib/warmpawz-insurance-flags';
import { planPublishBlockers, vendorReadinessBlockers } from '../domain/readiness';
import type { PlanInput } from '../dto/insurance-admin.requests';
import type { InsurancePlanDTO, PlanReadinessDTO } from '../dto/insurance-admin.responses';
import { dbGetInsuranceCompany } from '../repos/companies.repo';
import { auditInsuranceChange } from '../repos/insurance-audit';
import { dbGetPlan, dbInsertPlan, dbListCompanyPlans, dbSetPlanStatus, dbUpdatePlan } from '../repos/plans.repo';
import { dbVendorReadinessFacts } from '../repos/readiness.repo';
import { InsuranceAdminError, insuranceNotFound } from '../shared/insurance-admin-response';

async function requirePlan(id: string): Promise<InsurancePlanDTO> {
  const plan = await dbGetPlan(id);
  if (!plan) throw insuranceNotFound('Insurance plan');
  return plan;
}

export function listCompanyPlans(companyId: string): Promise<InsurancePlanDTO[]> {
  return dbListCompanyPlans(companyId);
}

export async function createCompanyPlan(
  companyId: string,
  input: PlanInput,
  actorId: string | null,
): Promise<InsurancePlanDTO> {
  const company = await dbGetInsuranceCompany(companyId);
  if (!company) throw insuranceNotFound('Insurance company');
  const id = await dbInsertPlan(companyId, input, actorId);
  await auditInsuranceChange({
    entityType: 'insurance_plan',
    entityId: id,
    action: 'create',
    actorId,
    newValues: { companyId, ...input },
  });
  return requirePlan(id);
}

export async function updateCompanyPlan(
  companyId: string,
  planId: string,
  input: PlanInput,
  actorId: string | null,
): Promise<InsurancePlanDTO> {
  const existing = await requirePlan(planId);
  if (existing.companyId !== companyId) throw insuranceNotFound('Insurance plan');
  if (!(await dbUpdatePlan(planId, input, actorId))) throw insuranceNotFound('Insurance plan');
  await auditInsuranceChange({
    entityType: 'insurance_plan',
    entityId: planId,
    action: 'update',
    actorId,
    oldValues: { ...existing },
    newValues: { ...input },
  });
  return requirePlan(planId);
}

export async function getPlanReadiness(companyId: string, planId?: string): Promise<PlanReadinessDTO> {
  const company = await dbGetInsuranceCompany(companyId);
  if (!company) throw insuranceNotFound('Insurance company');
  if (planId) {
    const plan = await requirePlan(planId);
    if (plan.companyId !== companyId) throw insuranceNotFound('Insurance plan');
  }
  const requireForm = isInsuranceFormTemplateRequired();
  const facts = await dbVendorReadinessFacts(companyId, requireForm);
  const vendors = facts.map((row) => {
    const blockers = vendorReadinessBlockers({ ...row, companyActive: company.status === 'active', requirePublishedForm: requireForm });
    return {
      linkId: row.linkId,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      ready: blockers.length === 0,
      blockers,
    };
  });
  const readyVendorCount = vendors.filter((v) => v.ready).length;
  const blockers = planPublishBlockers({ companyActive: company.status === 'active', readyVendorCount });
  return {
    companyId,
    planId: planId ?? null,
    publishable: blockers.length === 0,
    blockers,
    readyVendorCount,
    vendors,
  };
}

export async function publishPlan(planId: string, actorId: string | null): Promise<InsurancePlanDTO> {
  const plan = await requirePlan(planId);
  const readiness = await getPlanReadiness(plan.companyId, plan.id);
  if (!readiness.publishable) {
    throw new InsuranceAdminError(422, 'PLAN_NOT_PUBLISHABLE', readiness.blockers.join('; '));
  }
  await dbSetPlanStatus(planId, 'published', actorId);
  await auditInsuranceChange({
    entityType: 'insurance_plan',
    entityId: planId,
    action: 'publish',
    actorId,
    newValues: { status: 'published' },
  });
  return requirePlan(planId);
}

export async function unpublishPlan(planId: string, actorId: string | null): Promise<InsurancePlanDTO> {
  await requirePlan(planId);
  await dbSetPlanStatus(planId, 'draft', actorId);
  await auditInsuranceChange({
    entityType: 'insurance_plan',
    entityId: planId,
    action: 'unpublish',
    actorId,
    newValues: { status: 'draft' },
  });
  return requirePlan(planId);
}
