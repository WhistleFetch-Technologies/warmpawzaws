jest.mock('../repos/vendor-links.repo', () => ({
  dbApplyVendorLinkConfig: jest.fn(),
  dbCreateVendorLinkWithTerms: jest.fn(),
  dbFindVendorLinkByPair: jest.fn(),
  dbGetInsuranceVendorState: jest.fn(),
  dbGetVendorLink: jest.fn(),
  dbListInsuranceVendorCandidates: jest.fn(),
  dbListVendorLinks: jest.fn(),
  dbReactivateVendorLinkWithTerms: jest.fn(),
  dbUpdateVendorLink: jest.fn(),
}));
jest.mock('../repos/commission-terms.repo', () => ({
  dbInsertCommissionTerms: jest.fn(),
  dbListAllCommissionTerms: jest.fn(),
  dbListCommissionTerms: jest.fn(),
}));
jest.mock('../repos/payout-schedules.repo', () => ({
  dbClearLinkPayoutSchedule: jest.fn(),
  dbGetDefaultPayoutSchedule: jest.fn(),
  dbListPayoutScheduleOverrides: jest.fn(),
  dbSaveLinkPayoutSchedule: jest.fn(),
}));
jest.mock('../repos/companies.repo', () => ({ dbGetInsuranceCompany: jest.fn() }));
jest.mock('../repos/insurance-audit', () => ({ auditInsuranceChange: jest.fn() }));

import { termsInForce } from '../domain/commission';
import type { PayoutScheduleConfig } from '../domain/payout-periods';
import type { CommissionTermsDTO } from '../dto/insurance-admin.responses';
import * as links from '../repos/vendor-links.repo';
import * as terms from '../repos/commission-terms.repo';
import * as schedules from '../repos/payout-schedules.repo';
import * as companies from '../repos/companies.repo';
import { createVendorLink, saveVendorLinkConfig } from '../services/insurance-vendor-links.service';

const LINK_ID = '11111111-1111-4111-8111-111111111111';
const VENDOR_ID = '22222222-2222-4222-8222-222222222222';
const COMPANY_ID = '33333333-3333-4333-8333-333333333333';

const linkRow = (status: 'active' | 'suspended' | 'ended' = 'active') => ({
  id: LINK_ID,
  vendorId: VENDOR_ID,
  vendorName: 'Pawsure Insurance Services',
  vendorPhone: '9876543210',
  vendorStatus: 'approved',
  companyId: COMPANY_ID,
  companyName: 'HDFC ERGO',
  authorisationRef: null,
  agencyCode: null,
  effectiveFrom: '2026-10-01',
  effectiveTo: null,
  status,
  notes: null,
  createdAt: '2026-10-01T00:00:00.000Z',
});

const currentTerms: CommissionTermsDTO = {
  id: 't1',
  basis: 'percent_of_premium',
  rate: 25,
  vendorCommissionRate: null,
  gstRate: 18,
  effectiveFrom: '2026-10-01',
  notes: null,
  description: '25% of premium + 18% GST',
  createdAt: '2026-10-01T00:00:00.000Z',
};

const defaultSchedule: PayoutScheduleConfig = {
  frequency: 'monthly',
  anchorDate: '2026-01-01',
  dueDaysAfterPeriodEnd: 7,
  graceDays: 3,
  reminderDaysBefore: [3, 1],
};

const termsInput = (overrides: Partial<{ basis: 'percent_of_premium' | 'fixed_per_policy'; rate: number; gstRate: number }> = {}) => ({
  basis: 'percent_of_premium' as const,
  rate: 25,
  gstRate: 18,
  effectiveFrom: '2026-10-14',
  notes: null,
  ...overrides,
});

function givenLink(status: 'active' | 'suspended' | 'ended' = 'active', override: PayoutScheduleConfig | null = null) {
  jest.mocked(links.dbGetVendorLink).mockResolvedValue(linkRow(status));
  jest.mocked(links.dbListVendorLinks).mockResolvedValue([linkRow(status)]);
  jest.mocked(terms.dbListAllCommissionTerms).mockResolvedValue(new Map([[LINK_ID, [currentTerms]]]));
  jest
    .mocked(schedules.dbListPayoutScheduleOverrides)
    .mockResolvedValue(override ? new Map([[LINK_ID, override]]) : new Map());
  jest.mocked(schedules.dbGetDefaultPayoutSchedule).mockResolvedValue(defaultSchedule);
}

beforeEach(() => jest.clearAllMocks());

describe('saveVendorLinkConfig', () => {
  it('writes nothing when frequency and terms are unchanged', async () => {
    givenLink();
    const result = await saveVendorLinkConfig(LINK_ID, { frequency: 'monthly', terms: termsInput() }, 'admin');
    expect(links.dbApplyVendorLinkConfig).not.toHaveBeenCalled();
    expect(result.changed).toEqual({ terms: false, schedule: false });
  });

  it('appends terms only when the commission changed', async () => {
    givenLink();
    await saveVendorLinkConfig(LINK_ID, { frequency: 'monthly', terms: termsInput({ rate: 20 }) }, 'admin');
    expect(links.dbApplyVendorLinkConfig).toHaveBeenCalledWith(
      LINK_ID,
      { terms: expect.objectContaining({ rate: 20 }), schedule: null },
      'admin',
    );
  });

  it('treats a GST change as a commission change', async () => {
    givenLink();
    const result = await saveVendorLinkConfig(LINK_ID, { frequency: 'monthly', terms: termsInput({ gstRate: 0 }) }, 'admin');
    expect(result.changed.terms).toBe(true);
  });

  it('creates an override from the platform default when frequency moves off it', async () => {
    givenLink();
    await saveVendorLinkConfig(LINK_ID, { frequency: 'weekly', terms: termsInput() }, 'admin');
    expect(links.dbApplyVendorLinkConfig).toHaveBeenCalledWith(
      LINK_ID,
      { terms: null, schedule: { ...defaultSchedule, frequency: 'weekly' } },
      'admin',
    );
  });

  it('keeps the override’s due, grace and reminder settings when changing frequency', async () => {
    const override: PayoutScheduleConfig = { ...defaultSchedule, frequency: 'weekly', dueDaysAfterPeriodEnd: 2, graceDays: 1 };
    givenLink('active', override);
    await saveVendorLinkConfig(LINK_ID, { frequency: 'fortnightly', terms: termsInput() }, 'admin');
    expect(links.dbApplyVendorLinkConfig).toHaveBeenCalledWith(
      LINK_ID,
      { terms: null, schedule: expect.objectContaining({ frequency: 'fortnightly', dueDaysAfterPeriodEnd: 2, graceDays: 1 }) },
      'admin',
    );
  });

  it('clears the override when switching back to the platform default', async () => {
    givenLink('active', { ...defaultSchedule, frequency: 'weekly' });
    await saveVendorLinkConfig(LINK_ID, { frequency: 'default', terms: termsInput() }, 'admin');
    expect(links.dbApplyVendorLinkConfig).toHaveBeenCalledWith(LINK_ID, { terms: null, schedule: 'default' }, 'admin');
  });

  it('rejects edits on an ended link', async () => {
    givenLink('ended');
    await expect(
      saveVendorLinkConfig(LINK_ID, { frequency: 'weekly', terms: termsInput() }, 'admin'),
    ).rejects.toMatchObject({ status: 422, code: 'LINK_ENDED' });
  });
});

describe('createVendorLink', () => {
  const input = {
    vendorId: VENDOR_ID,
    companyId: COMPANY_ID,
    authorisationRef: null,
    agencyCode: null,
    effectiveFrom: '2026-10-14',
    effectiveTo: null,
    notes: null,
    terms: termsInput(),
  };

  beforeEach(() => {
    jest.mocked(companies.dbGetInsuranceCompany).mockResolvedValue({ id: COMPANY_ID, name: 'HDFC ERGO', status: 'active' } as never);
    jest
      .mocked(links.dbGetInsuranceVendorState)
      .mockResolvedValue({ isInsuranceVendor: true, isActive: true, isApproved: true, name: 'Pawsure' });
    jest.mocked(links.dbFindVendorLinkByPair).mockResolvedValue(null);
  });

  it('rejects a vendor that is not active and approved', async () => {
    jest
      .mocked(links.dbGetInsuranceVendorState)
      .mockResolvedValue({ isInsuranceVendor: true, isActive: false, isApproved: true, name: 'Pawsure' });
    await expect(createVendorLink(input, 'admin')).rejects.toMatchObject({ status: 422, code: 'VENDOR_NOT_ACTIVE' });
    expect(links.dbCreateVendorLinkWithTerms).not.toHaveBeenCalled();
  });

  it('rejects a vendor already assigned to the company', async () => {
    jest.mocked(links.dbFindVendorLinkByPair).mockResolvedValue(linkRow('active'));
    await expect(createVendorLink(input, 'admin')).rejects.toMatchObject({ status: 409, code: 'LINK_EXISTS' });
  });

  it('reactivates an ended link instead of creating a duplicate', async () => {
    jest.mocked(links.dbFindVendorLinkByPair).mockResolvedValue(linkRow('ended'));
    givenLink('active');
    await createVendorLink(input, 'admin');
    expect(links.dbReactivateVendorLinkWithTerms).toHaveBeenCalledWith(LINK_ID, input, 'admin');
    expect(links.dbCreateVendorLinkWithTerms).not.toHaveBeenCalled();
  });
});

describe('termsInForce on the same effective date', () => {
  const older = { ...currentTerms, rate: 25, effectiveFrom: '2026-10-14', createdAt: '2026-10-14T05:00:00.000Z' };
  const newer = { ...currentTerms, rate: 20, effectiveFrom: '2026-10-14', createdAt: '2026-10-14T09:00:00.000Z' };

  it('uses the latest edit whatever order the rows arrive in', () => {
    expect(termsInForce([older, newer], '2026-10-14')?.rate).toBe(20);
    expect(termsInForce([newer, older], '2026-10-14')?.rate).toBe(20);
  });
});
