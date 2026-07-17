import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridSearchhistoryGet0(customer) {
  return await select('customers', { id: customer });
}

