import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetsPost0(customer, pet) {
  return await select('pets', { customer_id: customer.id, name: pet.name });
}

export async function dbCustomerPetsPost1(existingPets, petData) {
  return await update('pets', { id: existingPets[0].id }, petData);
}

export async function dbCustomerPetsPost2(petData) {
  return await insert('pets', petData);
}

export async function dbCustomerPetsPost3(customer) {
  return await update('customers', { id: customer.id }, { 
          profile_completed: true,
          onboarding_status: 'COMPLETED',
          status: 'active'
        });
}

