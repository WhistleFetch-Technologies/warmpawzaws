import type { Context } from 'hono';
import { z } from 'zod';
import { reconciliationExportQuerySchema, reconciliationQuerySchema } from '../dto/insurance-admin.requests';
import {
  exportReconciliation,
  getPolicyDocuments,
  getReconciliation,
} from '../services/insurance-reconciliation.service';
import { respond } from './respond';

const idParam = z.string().uuid();

export const reconciliationHandler = (c: Context) =>
  respond(c, () => getReconciliation(reconciliationQuerySchema.parse(c.req.query())));

export const reconciliationExportHandler = (c: Context) =>
  respond(c, () => exportReconciliation(reconciliationExportQuerySchema.parse(c.req.query())));

export const policyDocumentsHandler = (c: Context) =>
  respond(c, () => getPolicyDocuments(idParam.parse(c.req.param('id'))));
