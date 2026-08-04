import type { Context } from 'hono';
import {
  mapWapptAdminHandlerError,
  WapptAdminSuccessResponse,
} from '../../shared/wappt-admin-response.helpers';
import { getRequiredAdminUserId } from '../../catalogue/middleware/require-admin-permission.middleware';
import { toOptionalAdminActorUuid } from '../../catalogue/utils/admin-actor-id';
import { wapptPoliciesAdminService } from '../services/wappt-policies-admin.service';

export async function wapptPoliciesListHandler(c: Context) {
  try {
    const scope = c.req.query('scope') as 'platform' | 'category' | undefined;
    const category = c.req.query('category') ?? undefined;
    const tiers = await wapptPoliciesAdminService.listTiers({
      policyScope: scope,
      category,
    });
    return WapptAdminSuccessResponse(c, { tiers, categories: wapptPoliciesAdminService.listCategories() });
  } catch (e) {
    return mapWapptAdminHandlerError(c, e);
  }
}

export async function wapptPoliciesPlatformGetHandler(c: Context) {
  try {
    const tiers = await wapptPoliciesAdminService.getPlatformDefaultTiers();
    return WapptAdminSuccessResponse(c, { tiers });
  } catch (e) {
    return mapWapptAdminHandlerError(c, e);
  }
}

export async function wapptPoliciesPlatformPutHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const tiers = Array.isArray(body.tiers) ? body.tiers : [];
    const actorId = toOptionalAdminActorUuid(getRequiredAdminUserId(c));
    const saved = await wapptPoliciesAdminService.replacePlatformDefaultTiers(tiers, actorId);
    return WapptAdminSuccessResponse(c, { tiers: saved });
  } catch (e) {
    return mapWapptAdminHandlerError(c, e);
  }
}

export async function wapptPoliciesCategoryGetHandler(c: Context) {
  try {
    const category = c.req.param('category');
    const tiers = await wapptPoliciesAdminService.getCategoryTiers(category);
    return WapptAdminSuccessResponse(c, { category, tiers });
  } catch (e) {
    return mapWapptAdminHandlerError(c, e);
  }
}

export async function wapptPoliciesCategoryPutHandler(c: Context) {
  try {
    const category = c.req.param('category');
    const body = await c.req.json().catch(() => ({}));
    const tiers = Array.isArray(body.tiers) ? body.tiers : [];
    const actorId = toOptionalAdminActorUuid(getRequiredAdminUserId(c));
    const saved = await wapptPoliciesAdminService.replaceCategoryTiers(category, tiers, actorId);
    return WapptAdminSuccessResponse(c, { category, tiers: saved });
  } catch (e) {
    return mapWapptAdminHandlerError(c, e);
  }
}

export async function wapptPoliciesTierDeleteHandler(c: Context) {
  try {
    const tierId = c.req.param('tierId');
    const actorId = toOptionalAdminActorUuid(getRequiredAdminUserId(c));
    const deleted = await wapptPoliciesAdminService.deleteTier(tierId, actorId);
    if (!deleted) return c.json({ success: false, error: { message: 'Tier not found' } }, 404);
    return WapptAdminSuccessResponse(c, { deleted: true, tierId });
  } catch (e) {
    return mapWapptAdminHandlerError(c, e);
  }
}
