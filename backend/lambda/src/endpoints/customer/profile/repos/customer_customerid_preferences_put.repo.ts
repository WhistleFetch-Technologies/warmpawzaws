import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridPreferencesPut0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerCustomeridPreferencesPut1(customerId) {
  return await update('customers',
        { id: customerId },
        {
          preferences: {
            ...existingPreferences,
            ...newPreferences,
          },
        }
      );
}

