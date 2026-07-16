import type { Context } from 'hono';
import * as relocation_quote_postRepo from '../repos/relocation_quote_post.repo';

export async function executerelocationQuotePost(c: Context) {
  try {
    const body = await c.req.json();
    const {
      customerId,
      customerPhone,
      origin,
      destination,
      transportType,
      petType,
      petSize,
      petWeight,
      numberOfPets,
      preferredDate,
      specialRequirements,
      cageRequired,
      insuranceRequired,
    } = body;

    if (!origin || !destination) {
      return c.json({ error: 'Origin and destination are required' }, 400);
    }

    let basePrice = 5000;
    if (transportType === 'air') basePrice = 15000;
    else if (transportType === 'road') basePrice = 8000;

    let sizeMultiplier = 1;
    if (petSize === 'medium') sizeMultiplier = 1.3;
    if (petSize === 'large') sizeMultiplier = 1.6;
    if (petSize === 'extra_large') sizeMultiplier = 2;

    const cageCost = cageRequired ? 2000 : 0;
    const insuranceCost = insuranceRequired ? 1500 : 0;
    const handlingFee = 500;
    const subtotal = basePrice * sizeMultiplier * (numberOfPets || 1);
    const totalQuote = subtotal + cageCost + insuranceCost + handlingFee;
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const quote = await relocation_quote_postRepo
      .dbRelocationQuotePost0({
        customer_id: customerId,
        customer_phone: customerPhone,
        origin,
        destination,
        transport_type: transportType || 'road',
        pet_type: petType,
        pet_size: petSize,
        pet_weight: petWeight,
        number_of_pets: numberOfPets || 1,
        preferred_date: preferredDate,
        special_requirements: specialRequirements,
        cage_required: cageRequired,
        insurance_required: insuranceRequired,
        base_price: subtotal,
        cage_cost: cageCost,
        insurance_cost: insuranceCost,
        handling_fee: handlingFee,
        total_quote: totalQuote,
        status: 'pending',
        valid_until: validUntil,
      })
      .catch(async () => {
        await relocation_quote_postRepo.dbRelocationQuotePost1();
        const fallbackRow = {
          customer_id: customerId,
          customer_phone: customerPhone,
          origin,
          destination,
          transport_type: transportType || 'road',
          total_quote: totalQuote,
          status: 'pending',
        };
        return relocation_quote_postRepo.dbRelocationQuotePost2(fallbackRow);
      });

    return c.json({
      success: true,
      quote: {
        id: quote[0]?.id,
        origin,
        destination,
        transportType: transportType || 'road',
        breakdown: { basePrice: subtotal, cageCost, insuranceCost, handlingFee },
        totalQuote,
        validUntil,
      },
      message: 'Quote generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating relocation quote:', error);
    return c.json({ error: error.message }, 500);
  }
}
