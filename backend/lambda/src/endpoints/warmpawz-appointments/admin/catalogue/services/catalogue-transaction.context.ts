import type { PoolClient } from 'pg';
import { CatalogueAuditRepository } from '../../../repositories/catalogue-audit.repository';
import { VendorCatalogRepository } from '../../../repositories/vendor-catalog.repository';
import type { ICatalogueDbClient } from '../../../repositories/interfaces/ICatalogueDbClient';
import { CatalogueAuditService } from './catalogue-audit.service';

export interface CatalogueTransactionContext {
  readonly catalogRepository: VendorCatalogRepository;
  readonly auditService: CatalogueAuditService;
}

export function createCatalogueDbClient(client: PoolClient): ICatalogueDbClient {
  return {
    query: (text: string, params?: unknown[]) => client.query(text, params),
  };
}

export function createCatalogueTransactionContext(
  client: PoolClient,
): CatalogueTransactionContext {
  const db = createCatalogueDbClient(client);
  const auditRepository = new CatalogueAuditRepository(db);

  return {
    catalogRepository: new VendorCatalogRepository(db),
    auditService: new CatalogueAuditService(auditRepository),
  };
}
