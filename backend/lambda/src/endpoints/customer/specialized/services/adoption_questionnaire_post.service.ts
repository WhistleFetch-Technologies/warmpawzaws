import type { Context } from 'hono';
import * as adoption_questionnaire_postRepo from '../repos/adoption_questionnaire_post.repo';

export async function executeadoptionQuestionnairePost(c: Context) {
  try {
    const body = await c.req.json();
    const {
      customerPhone,
      customerId,
      petId,
      vendorId,
      experience,
      livingSituation,
      otherPets,
      timeCommitment,
      reason,
      additionalInfo,
    } = body;

    if (!customerPhone && !customerId) {
      return c.json({ error: 'Customer phone or ID is required' }, 400);
    }

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && customerPhone) {
      const customers = await adoption_questionnaire_postRepo.dbAdoptionQuestionnairePost0(customerPhone);
      if (customers.rows.length > 0) {
        resolvedCustomerId = customers.rows[0].id;
      }
    }

    let resolvedVendorId = vendorId;
    if (petId && !resolvedVendorId) {
      const pets = await adoption_questionnaire_postRepo.dbAdoptionQuestionnairePost1(petId);
      if (pets.rows.length > 0) {
        resolvedVendorId = pets.rows[0].vendor_id;
      }
    }
    if (!resolvedVendorId) {
      return c.json({ error: 'vendorId is required' }, 400);
    }
    if (!petId) {
      return c.json({ error: 'petId is required' }, 400);
    }

    const application = await adoption_questionnaire_postRepo
      .dbAdoptionQuestionnairePost2(
        resolvedCustomerId,
        customerPhone,
        petId,
        resolvedVendorId,
        experience,
        livingSituation,
        otherPets,
        timeCommitment,
        reason,
        additionalInfo,
        body.serviceId || null
      )
      .catch(async () => {
        await adoption_questionnaire_postRepo.dbAdoptionQuestionnairePost3();
        return adoption_questionnaire_postRepo.dbAdoptionQuestionnairePost4(
          resolvedCustomerId,
          customerPhone,
          petId,
          resolvedVendorId,
          experience,
          livingSituation,
          otherPets,
          timeCommitment,
          reason,
          additionalInfo,
          body.serviceId || null
        );
      });

    return c.json({
      success: true,
      applicationId: application[0]?.id,
      message: 'Adoption application submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting adoption application:', error);
    return c.json({ error: error.message }, 500);
  }
}
