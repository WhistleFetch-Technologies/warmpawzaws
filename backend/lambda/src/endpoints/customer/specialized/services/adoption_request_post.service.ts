import type { Context } from 'hono';
import * as adoption_request_postRepo from '../repos/adoption_request_post.repo';
import * as adoption_questionnaire_postRepo from '../repos/adoption_questionnaire_post.repo';

export async function executeadoptionRequestPost(c: Context) {
  try {
    const body = await c.req.json();
    const { customerId, customerPhone, petId, message, visitDate, visitTime, vendorId } = body;

    if (!petId) {
      return c.json({ error: 'Pet ID is required' }, 400);
    }

    const pets = await adoption_request_postRepo.dbAdoptionRequestPost0(petId);
    if (pets.rows.length > 0) {
      const pet = pets.rows[0];
      const booking = await adoption_request_postRepo.dbAdoptionRequestPost1(
        customerId,
        customerPhone,
        pet,
        petId,
        visitDate,
        visitTime,
        message
      );
      return c.json({
        success: true,
        booking: booking[0],
        message: 'Adoption request submitted. The shelter will contact you shortly.',
      });
    }

    // Fallback when id is a customer pet (no adoption_listings.vendor_id): store application only
    const application = await adoption_questionnaire_postRepo.dbAdoptionQuestionnairePost2(
      customerId || null,
      customerPhone,
      petId,
      vendorId,
      null,
      null,
      null,
      null,
      message || 'adoption request',
      null
    );

    return c.json({
      success: true,
      applicationId: application[0]?.id,
      message: 'Adoption request submitted. The shelter will contact you shortly.',
    });
  } catch (error: any) {
    console.error('Error creating adoption request:', error);
    return c.json({ error: error.message }, 500);
  }
}
