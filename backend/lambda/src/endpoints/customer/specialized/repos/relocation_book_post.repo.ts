import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbRelocationBookPost0(quoteId) {
  return await query(`SELECT * FROM relocation_quotes WHERE id = $1`, [quoteId]);
}

export async function dbRelocationBookPost1(customerId, vendorId, quote, paymentMethod, quoteId) {
  return await insert('bookings', {
        customer_id: customerId || quote.customer_id,
        vendor_id: vendorId,
        service_type: 'pet_relocation',
        booking_date: quote.preferred_date || new Date().toISOString().split('T')[0],
        total_amount: quote.total_quote,
        status: 'pending',
        payment_method: paymentMethod || 'online',
        metadata: JSON.stringify({
          quoteId: quoteId,
          origin: quote.origin,
          destination: quote.destination,
          transportType: quote.transport_type,
          petType: quote.pet_type,
          petSize: quote.pet_size,
          numberOfPets: quote.number_of_pets,
          cageRequired: quote.cage_required,
          insuranceRequired: quote.insurance_required,
        }),
      });
}

export async function dbRelocationBookPost2(quoteId, vendorId) {
  return await update('relocation_quotes', { id: quoteId }, { status: 'booked', vendor_id: vendorId });
}

