import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridSearchhistoryPost0(customer) {
  return await select('customers', { id: customer });
}

export async function dbCustomerCustomeridSearchhistoryPost1(customer) {
  return await update('customers', { id: customer }, {
        preferences: { ...preferences, searchHistory }
      });
}

