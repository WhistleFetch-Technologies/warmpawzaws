/**
 * Mirrors customer discovery eligibility (vendor-services-list / by-style filters).
 * Soft-unpublish = is_enabled false + publish_status draft → not customer-facing.
 */
function isVendorServiceCustomerFacing(params: {
  vendorIsActive?: boolean | null;
  vendorStatus?: string | null;
  isEnabled?: boolean | null;
  publishStatus?: string | null;
}): boolean {
  const vendorActive = params.vendorIsActive !== false;
  const status = String(params.vendorStatus || '')
    .trim()
    .toLowerCase();
  const vendorOk = vendorActive && ['approved', 'active', 'activated'].includes(status);
  if (!vendorOk) return false;

  const enabled = params.isEnabled === true || params.isEnabled == null;
  if (!enabled) return false;

  const pub = params.publishStatus == null ? null : String(params.publishStatus).trim().toLowerCase();
  if (pub == null || pub === '') return true;
  return pub === 'published' || pub === 'auto_published';
}

describe('legacy vendor_service soft-unpublish visibility', () => {
  it('treats enabled + published on approved vendor as customer-facing', () => {
    expect(
      isVendorServiceCustomerFacing({
        vendorIsActive: true,
        vendorStatus: 'approved',
        isEnabled: true,
        publishStatus: 'published',
      }),
    ).toBe(true);
  });

  it('hides migration 1091 soft-unpublished legacy rows', () => {
    expect(
      isVendorServiceCustomerFacing({
        vendorIsActive: true,
        vendorStatus: 'approved',
        isEnabled: false,
        publishStatus: 'draft',
      }),
    ).toBe(false);
  });

  it('hides draft even when is_enabled remains true', () => {
    expect(
      isVendorServiceCustomerFacing({
        vendorIsActive: true,
        vendorStatus: 'approved',
        isEnabled: true,
        publishStatus: 'draft',
      }),
    ).toBe(false);
  });
});
