import { logAuditEntry } from '../../../../utils/audit-log';

export async function auditInsuranceChange(entry: {
  entityType: 'insurance_company' | 'insurance_plan' | 'insurance_vendor_link' | 'insurance_commission_terms' | 'insurance_payout_schedule';
  entityId: string;
  action: string;
  actorId: string | null;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}): Promise<void> {
  try {
    await logAuditEntry({
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId ?? undefined,
      actorType: 'admin',
      oldValues: entry.oldValues,
      newValues: entry.newValues,
    });
  } catch (error) {
    console.error('[warmpawz-insurance-admin] audit write failed', error);
  }
}
