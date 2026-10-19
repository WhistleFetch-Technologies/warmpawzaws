jest.mock('../../../../../utils/customer-id-from-auth', () => ({
  resolveCustomerIdFromHonoContext: jest.fn(),
}));
jest.mock('../../../../../utils/customer-coordinates', () => ({
  getCustomerCoordinates: jest.fn(),
}));
jest.mock('../../../../../utils/vendor-listing-photo', () => ({
  getVendorListingPhotoUrl: jest.fn(async () => 'https://cdn.example/logo.jpg'),
}));
jest.mock('../../repos/vendor-feedback-prompt.repo', () => ({
  dbLatestVendorFeedbackCandidate: jest.fn(),
}));
jest.mock('../../repos/vendor-feedback-source.repo', () => ({
  dbFindVendorFeedbackBooking: jest.fn(),
  dbFindVendorFeedbackPayment: jest.fn(),
}));
jest.mock('../../repos/vendor-feedback-write.repo', () => ({
  dbInsertVendorFeedbackReview: jest.fn(),
  dbDismissVendorFeedbackPrompt: jest.fn(),
}));

import { resolveCustomerIdFromHonoContext } from '../../../../../utils/customer-id-from-auth';
import { dbLatestVendorFeedbackCandidate } from '../../repos/vendor-feedback-prompt.repo';
import { dbFindVendorFeedbackPayment } from '../../repos/vendor-feedback-source.repo';
import { dbInsertVendorFeedbackReview } from '../../repos/vendor-feedback-write.repo';
import { executeCustomerVendorFeedbackPromptGet } from '../customer_vendor_feedback_prompt_get.service';
import { executeCustomerVendorFeedbackPost } from '../customer_vendor_feedback_post.service';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const PAYMENT = '22222222-2222-4222-8222-222222222222';
const VENDOR = '33333333-3333-4333-8333-333333333333';

const mockedAuth = resolveCustomerIdFromHonoContext as jest.Mock;
const mockedLatest = dbLatestVendorFeedbackCandidate as jest.Mock;
const mockedPayment = dbFindVendorFeedbackPayment as jest.Mock;
const mockedInsert = dbInsertVendorFeedbackReview as jest.Mock;

function ctx(opts: { query?: Record<string, string>; body?: unknown } = {}) {
  return {
    req: {
      query: (k: string) => opts.query?.[k],
      json: async () => opts.body,
    },
    json: (body: unknown, status = 200) => ({ body, status }),
  } as never;
}

const candidate = {
  source_type: 'payment',
  source_id: PAYMENT,
  booking_id: null,
  payment_id: PAYMENT,
  vendor_id: VENDOR,
  txn_at: '2026-10-01T10:00:00.000Z',
  booking_style: null,
  business_name: 'Amigo Pet Hospital',
  owner_name: null,
  vendor_type: 'clinic',
  metadata: null,
  profile_photo_url: null,
  address: 'Indiranagar',
  city: 'Bengaluru',
  latitude: '12.97',
  longitude: '77.64',
  vendor_status: 'approved',
  legacy_category: null,
  customer_service: null,
  role_category: null,
  role_config: null,
  role_name: 'vet_clinic',
  role_display_name: 'Veterinary Clinic',
  reviewed: false,
  dismissed: false,
};

beforeEach(() => jest.clearAllMocks());

describe('GET /customer/vendor-feedback/prompt', () => {
  it('401 without an authenticated customer', async () => {
    mockedAuth.mockResolvedValue(null);
    const res = (await executeCustomerVendorFeedbackPromptGet(ctx())) as any;
    expect(res.status).toBe(401);
  });

  it('returns null when the latest transaction was already reviewed or dismissed', async () => {
    mockedAuth.mockResolvedValue(CUSTOMER);
    mockedLatest.mockResolvedValue({ ...candidate, dismissed: true });
    const res = (await executeCustomerVendorFeedbackPromptGet(ctx())) as any;
    expect(res.body).toEqual({ success: true, prompt: null });
  });

  it('maps a Warmpawz Pay bill to the vendor card prompt', async () => {
    mockedAuth.mockResolvedValue(CUSTOMER);
    mockedLatest.mockResolvedValue(candidate);
    const res = (await executeCustomerVendorFeedbackPromptGet(
      ctx({ query: { lat: '12.97', lng: '77.59' } })
    )) as any;
    const prompt = res.body.prompt;
    expect(prompt.kind).toBe('warmpawz_pay');
    expect(prompt.title).toBe('Leave a review for your previous Warmpawz Pay transaction');
    expect(prompt.vendor).toMatchObject({
      vendorId: VENDOR,
      name: 'Amigo Pet Hospital',
      categoryLabel: 'Veterinary Clinic',
      isVerified: true,
      address: 'Indiranagar, Bengaluru',
      photoUrl: 'https://cdn.example/logo.jpg',
    });
    expect(prompt.vendor.distanceText).toMatch(/km away$/);
  });

  it('never fails home: repo errors become prompt null', async () => {
    mockedAuth.mockResolvedValue(CUSTOMER);
    mockedLatest.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = (await executeCustomerVendorFeedbackPromptGet(ctx())) as any;
    expect(res.body).toEqual({ success: true, prompt: null });
  });
});

describe('POST /customer/vendor-feedback', () => {
  const body = { sourceType: 'payment', sourceId: PAYMENT, rating: 5, comment: 'Lovely' };

  it('404 when the payment is not the customer’s completed bill', async () => {
    mockedAuth.mockResolvedValue(CUSTOMER);
    mockedPayment.mockResolvedValue(null);
    const res = (await executeCustomerVendorFeedbackPost(ctx({ body }))) as any;
    expect(res.status).toBe(404);
  });

  it('409 when the visit already has a review', async () => {
    mockedAuth.mockResolvedValue(CUSTOMER);
    mockedPayment.mockResolvedValue({ vendor_id: VENDOR, booking_id: null, payment_id: PAYMENT, txn_at: null, booking_style: null });
    mockedInsert.mockResolvedValue(null);
    const res = (await executeCustomerVendorFeedbackPost(ctx({ body }))) as any;
    expect(res.status).toBe(409);
  });

  it('201 and stores the review against the vendor and payment', async () => {
    mockedAuth.mockResolvedValue(CUSTOMER);
    mockedPayment.mockResolvedValue({ vendor_id: VENDOR, booking_id: null, payment_id: PAYMENT, txn_at: '2026-10-01T10:00:00.000Z', booking_style: null });
    mockedInsert.mockResolvedValue({ reviewId: 'review-1' });
    const res = (await executeCustomerVendorFeedbackPost(ctx({ body }))) as any;
    expect(res.status).toBe(201);
    expect(mockedInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER,
        vendorId: VENDOR,
        paymentId: PAYMENT,
        bookingId: null,
        rating: 5,
        comment: 'Lovely',
        reviewSource: 'warmpawz_pay',
      })
    );
  });
});
