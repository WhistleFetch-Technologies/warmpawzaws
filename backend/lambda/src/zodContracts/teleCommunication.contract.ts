import { amountSchema, safeStringSchema, uuidSchema } from 'src/middleware/validation-middleware';
import { z } from 'zod';

export const instantTeleRequestSchema = z.object({
    customerId: uuidSchema,
    vendorId: uuidSchema,
    petId: uuidSchema,
    serviceId: uuidSchema.optional(),
    serviceName: safeStringSchema(500).optional(),
    amount: amountSchema.optional(),
}).strict();