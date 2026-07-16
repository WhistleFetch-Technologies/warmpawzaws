import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerQuestionnairePlanningPost0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerQuestionnairePlanningPost1(phone) {
  return await select('customers', { phone });
}

