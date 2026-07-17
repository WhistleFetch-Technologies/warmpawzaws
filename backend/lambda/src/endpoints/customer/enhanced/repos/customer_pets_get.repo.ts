import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetsGet0(customer) {
  return await select('pets',
        { customer_id: customer.id },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
}

