import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerProfileGet0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerProfileGet1(customers: { id: string }[]) {
  return await query(
          `SELECT 
      id,
      address_type as label,
      full_name as name,
      phone,
      address_line1 as "addressLine1",
      address_line2 as "addressLine2",
      city,
      state,
      pincode,
      landmark,
      coordinates,
      flat_no as "flatNo",
      house_no as "houseNo",
      floor,
      street_name as "streetName",
      apartment_name as "apartmentName",
      is_default as "isDefault",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM customer_addresses
    WHERE customer_id = $1
    ORDER BY is_default DESC, created_at DESC`,
          [customers[0].id]
        );
}

export async function dbCustomerProfileGet2(customer) {
  return await select('pets', { customer_id: customer.id });
}

