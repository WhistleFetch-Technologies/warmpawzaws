import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { addPetHandler } from './handler-instances.service';

export async function executecustomerCustomeridPetsPost(c: Context) {
    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await addPetHandler.execute(event, context);
    const body = JSON.parse(result.body);
    // Flatten loyalty fields for action_sources middleware (expects top-level customerId, petCreated, etc.)
    const data = body?.data && typeof body.data === 'object' ? body.data : {};
    const flattened = {
      ...body,
      ...(body?.success && data
        ? {
            customerId: data.customerId ?? c.req.param('customerId'),
            petId: data.petId ?? data.pet?.id,
            petCreated: data.petCreated,
            petProfileCompleted: data.petProfileCompleted,
            vaccinationUpdated: data.vaccinationUpdated,
            loyaltyEligibleCreates: data.loyaltyEligibleCreates,
            loyaltyEligibleVaccinationUpdates: data.loyaltyEligibleVaccinationUpdates,
          }
        : {}),
    };
    return c.json(flattened, result.statusCode);
}
