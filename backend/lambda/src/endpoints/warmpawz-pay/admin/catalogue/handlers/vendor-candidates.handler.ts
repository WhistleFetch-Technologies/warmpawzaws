import type { Context } from 'hono';
import { parseVendorCandidatesQuery } from '../dto/catalogue.requests';
import type { VendorCandidateDTO } from '../dto/catalogue.responses';
import type { VendorCandidateRow } from '../../../repositories/interfaces/IVendorEligibilityRepository';
import type { CatalogueAdminRouteDeps } from '../routes/catalogue-admin.routes';
import { catalogueSuccessResponse, mapCatalogueHandlerError } from './catalogue-list.handler';

function mapVendorCandidate(row: VendorCandidateRow): VendorCandidateDTO {
  return {
    vendorId: row.vendorId,
    businessName: row.businessName,
    city: row.city,
    status: row.status,
    payBillEnabled: row.payBillEnabled,
    bankVerified: row.bankVerified,
  };
}

export async function vendorCandidatesHandler(
  c: Context,
  deps: CatalogueAdminRouteDeps,
): Promise<Response> {
  try {
    const query = parseVendorCandidatesQuery(c.req.query());
    const filters = {
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
    };

    const [rows, total] = await Promise.all([
      deps.eligibilityRepository.searchCandidates(filters),
      deps.eligibilityRepository.countCandidates(filters),
    ]);

    return catalogueSuccessResponse(c, {
      items: rows.map(mapVendorCandidate),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    return mapCatalogueHandlerError(c, error);
  }
}
