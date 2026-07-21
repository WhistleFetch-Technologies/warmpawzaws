import { columnExists } from '../endpoints/customer/discovery/repos/legacy-helpers.repo';

export type DiscoveryVendorListSchemaFlags = {
  hasLogoUrl: boolean;
  hasVendorSpecializationsCol: boolean;
};

let schemaFlagsPromise: Promise<DiscoveryVendorListSchemaFlags> | null = null;

/** One batched schema probe per Lambda container (SQL 0.5 setup dedupe). */
export async function getDiscoveryVendorListSchemaFlags(): Promise<DiscoveryVendorListSchemaFlags> {
  if (!schemaFlagsPromise) {
    schemaFlagsPromise = Promise.all([
      columnExists('vendors', 'logo_url'),
      columnExists('vendors', 'specializations'),
    ]).then(([hasLogoUrl, hasVendorSpecializationsCol]) => ({
      hasLogoUrl,
      hasVendorSpecializationsCol,
    }));
  }
  return schemaFlagsPromise;
}

export function resetDiscoveryVendorListSchemaFlagsForTests(): void {
  schemaFlagsPromise = null;
}
