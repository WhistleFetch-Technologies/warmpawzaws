import type { EligibleBenefit, PriorityStrategy } from '../priority-types';

export const maxCustomerSavingsStrategy: PriorityStrategy = {
  key: 'MAX_CUSTOMER_SAVINGS',
  score(benefit: EligibleBenefit): number {
    return benefit.discountAmount;
  },
};
