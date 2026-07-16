import type { Context } from 'hono';
import * as breeder_reserve_postRepo from '../repos/breeder_reserve_post.repo';

export async function executebreederReservePost(c: Context) {
  try {
    const body = await c.req.json();
    const { customerId, puppyId, depositAmount } = body;

    if (!puppyId || !customerId) {
      return c.json({ error: 'Puppy ID and Customer ID are required' }, 400);
    }

    const puppies = await breeder_reserve_postRepo.dbBreederReservePost0(puppyId);
    if (puppies.rows.length === 0) {
      return c.json({ error: 'Puppy not found' }, 404);
    }

    const puppy = puppies.rows[0];

    if (puppy.status !== 'available') {
      return c.json({ error: 'This puppy is no longer available' }, 400);
    }

    await breeder_reserve_postRepo.dbBreederReservePost1(puppyId, customerId);

    const reservation = await breeder_reserve_postRepo.dbBreederReservePost2(
      customerId,
      puppy,
      puppyId,
      depositAmount
    );

    return c.json({
      success: true,
      reservation: reservation[0],
      message: `Puppy ${puppy.name} reserved! Please complete the deposit payment.`,
    });
  } catch (error: any) {
    console.error('Error reserving puppy:', error);
    return c.json({ error: error.message }, 500);
  }
}
