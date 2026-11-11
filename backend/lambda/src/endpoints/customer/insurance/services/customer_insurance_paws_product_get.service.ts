import type { Context } from 'hono';
import {
  HEALTH_DECLARATION_FIELDS,
  PAWS_N_CLAWS_PRODUCT,
  PAWS_N_CLAWS_PLAN_SEED_ID,
} from '@warmpawz/shared-types';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { dbFindPawsNClawsPlan } from '../repos/customer-insurance.repo';

function disabled(c: Context): Response {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
}

export async function executecustomerInsurancePawsProductGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) return disabled(c);
  const plan = await dbFindPawsNClawsPlan();
  return c.json({
    success: true,
    data: {
      product: PAWS_N_CLAWS_PRODUCT,
      healthDeclarations: HEALTH_DECLARATION_FIELDS,
      planId: plan ? String(plan.id) : PAWS_N_CLAWS_PLAN_SEED_ID,
      companyId: plan ? String(plan.company_id) : null,
      companyName: plan ? String(plan.company_name || PAWS_N_CLAWS_PRODUCT.providerName) : PAWS_N_CLAWS_PRODUCT.providerName,
      planPublished: Boolean(plan),
      premiumNote:
        'Premium is confirmed by HDFC ERGO after review. Warmpawz does not calculate or display a bindable premium before the insurer quote.',
      demoDisclaimer: PAWS_N_CLAWS_PRODUCT.demoDisclaimer,
    },
  });
}
