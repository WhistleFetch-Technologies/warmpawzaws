import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerProfileIdentifierPut0(customerId, updateData) {
  return await update('customers', { id: customerId }, updateData);
}

export async function dbCustomerProfileIdentifierPut1(customerId) {
  return await select('customers', { id: customerId });
}

