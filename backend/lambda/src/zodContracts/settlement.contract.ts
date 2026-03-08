import { amountSchema, uuidSchema } from 'src/middleware/validation-middleware';
import { z } from 'zod';

export const processPayoutSchema = z.object({
    settlementId: uuidSchema,
    vendorId: uuidSchema,
    amount: amountSchema,
}).strict();

