/** INNER JOIN when WAPPT catalogue-only discovery is enabled. */
export function sqlWapptCatalogueVendorJoin(wapptCatalogueOnly?: boolean): string {
  if (!wapptCatalogueOnly) return '';
  return `
        INNER JOIN warmpawz_appointments_vendor_catalog wappt_c
          ON wappt_c.vendor_id = v.id
          AND wappt_c.publish_status = 'published'`;
}
