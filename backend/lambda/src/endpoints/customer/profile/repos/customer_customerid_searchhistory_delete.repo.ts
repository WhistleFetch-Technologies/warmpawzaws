import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridSearchhistoryDelete0(customer) {
  return await select('customers', { id: customer });
}

export async function dbCustomerCustomeridSearchhistoryDelete1(
  customer: string,
  mergedPreferences: Record<string, unknown>
) {
  return await update('customers', { id: customer }, {
        preferences: mergedPreferences,
      });
}

