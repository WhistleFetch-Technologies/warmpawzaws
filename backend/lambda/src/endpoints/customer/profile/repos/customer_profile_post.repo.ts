import { select, insert, update } from '../../../../database/rds-connection';

export async function updateCustomerProfileRow(
  customerId: string,
  updateData: Record<string, unknown>
) {
  return await update('customers', { id: customerId }, updateData);
}

export async function selectCustomerById(customerId: string) {
  return await select('customers', { id: customerId });
}

export async function insertCustomerRow(payload: Record<string, unknown>) {
  return await insert('customers', payload);
}
