import type { Context } from 'hono';
import { ZodError } from 'zod';
import { parseCreateCatalogueRequest } from '../dto/catalogue.requests';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import {
  catalogueSuccessResponse,
  mapCatalogueHandlerError,
  readAdminUserId,
} from './catalogue-list.handler';

export async function catalogueCreateHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return mapCatalogueHandlerError(
        c,
        new ZodError([]),
      );
    }
    const input = parseCreateCatalogueRequest(body);
    const data = await deps.adminService.createEntry(input, readAdminUserId(c) ?? '');
    return catalogueSuccessResponse(c, data, 201);
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
