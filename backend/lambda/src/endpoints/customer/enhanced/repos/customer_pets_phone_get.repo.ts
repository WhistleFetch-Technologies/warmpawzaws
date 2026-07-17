import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetsPhoneGet0(param) {
  return await select('pets', { id: param });
}

export async function dbCustomerPetsPhoneGet1(customer) {
  return await select('pets',
        { customer_id: customer.id },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
}

