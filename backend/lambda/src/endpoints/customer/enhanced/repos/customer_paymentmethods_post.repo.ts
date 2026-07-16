import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentmethodsPost0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerPaymentmethodsPost1(phone) {
  return await select('customers', { phone });
}

export async function dbCustomerPaymentmethodsPost2(customer) {
  return await query(
          `UPDATE customer_payment_methods SET is_default = false WHERE customer_id = $1`,
          [customer.id]
        )
}

export async function dbCustomerPaymentmethodsPost3(customer, type, razorpayToken, last4, brand, upiId, bankName, isDefault) {
  return await insert('customer_payment_methods', {
        customer_id: customer.id,
        payment_type: type,
        razorpay_token: razorpayToken,
        card_last4: last4,
        card_brand: brand,
        upi_id: upiId,
        bank_name: bankName,
        is_default: isDefault || false,
        is_active: true,
      });
}

