/**
 * Stage 4.1 Batch 3 — Admin error disclosure remediation regression.
 */
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../safe-hono-error';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  deleteRows: jest.fn(),
  upsert: jest.fn(),
}));

jest.mock('../error-tracking', () => ({
  captureException: jest.fn(),
}));

jest.mock('../aws/aws-clients', () => ({
  publishToSNS: jest.fn(async () => undefined),
}));

jest.mock('../notification-campaign-audience', () => ({
  estimateCampaignAudience: jest.fn(async () => ({ estimatedRecipients: 0, warnings: [] })),
  buildAudienceFiltersPayload: jest.fn((b: unknown) => b || {}),
  serializeAudienceFilters: jest.fn((b: unknown) => b || {}),
}));

jest.mock('../notification-campaign-processor', () => ({
  executeCampaignDelivery: jest.fn(async () => ({ queued: 0 })),
}));

jest.mock('../notification-campaign-targeting', () => ({
  loadCampaignTargeting: jest.fn(async () => ({})),
}));

jest.mock('../scheduled-notification-drain', () => ({
  processDueScheduledCampaigns: jest.fn(async () => ({ processed: 0 })),
}));

jest.mock('../notification-pipeline-kill-switch', () => ({
  campaignPipelineDisabledResult: jest.fn(() => ({ error: 'pipeline disabled' })),
  cronPipelineSkippedPayload: jest.fn(() => ({ success: true, skipped: true })),
  isNotificationCronEnabled: jest.fn(() => true),
  isNotificationPipelineEnabled: jest.fn(() => true),
}));

jest.mock('../admin-refund-hub', () => ({
  getAdminRefundHubDetail: jest.fn(),
  listAdminRefundHubCases: jest.fn(),
}));

jest.mock('../meal-refund-cases', () => ({
  approveMealRefundCase: jest.fn(),
  backfillMealRefundCaseByOrderRef: jest.fn(),
  rejectMealRefundCase: jest.fn(),
}));

jest.mock('../payments/shop-order-refund', () => ({
  SHOP_MISSING_REFUND_FROM: 'FROM orders o',
  SHOP_MISSING_REFUND_WHERE: 'WHERE 1=0',
  initiateShopOrderRazorpayRefund: jest.fn(),
  reconcileShopRefundById: jest.fn(),
}));

jest.mock('../banner-cta-resolver', () => ({
  listVendorServicesForBannerPicker: jest.fn(),
}));

jest.mock('../banner-destination-options', () => ({
  getBannerDestinationOptions: jest.fn(),
}));

jest.mock('../banner-shop-destination-options', () => ({
  listShopBannerDestinationProducts: jest.fn(),
}));

jest.mock('../banner-s3-image', () => ({
  cleanupBannerImageOnUrlChange: jest.fn(),
  deleteManagedBannerS3Image: jest.fn(),
  extractBannerS3Key: jest.fn(),
  presignBannerImageForDisplay: jest.fn(async (u: string) => u),
}));

jest.mock('../../services/image', () => {
  class ImageProcessingError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = 'ImageProcessingError';
      this.statusCode = statusCode;
    }
  }
  return {
    ImageProcessingError,
    uploadDisplayImage: jest.fn(),
  };
});

import { query, select } from '../../database/rds-connection';
import { listAdminRefundHubCases, getAdminRefundHubDetail } from '../admin-refund-hub';
import {
  approveMealRefundCase,
  backfillMealRefundCaseByOrderRef,
  rejectMealRefundCase,
} from '../meal-refund-cases';
import {
  initiateShopOrderRazorpayRefund,
  reconcileShopRefundById,
} from '../payments/shop-order-refund';
import { getBannerDestinationOptions } from '../banner-destination-options';
import { estimateCampaignAudience } from '../notification-campaign-audience';
import { processDueScheduledCampaigns } from '../scheduled-notification-drain';
import { ImageProcessingError, uploadDisplayImage } from '../../services/image';
import { registerNotificationCampaignEndpoints } from '../../endpoints/admin/endpoints/notification-campaigns';
import { registerAdminGovernanceEnhancedEndpoints } from '../../endpoints/admin/endpoints/admin-governance-enhanced';
import { registerAdminRefundHubEndpoints } from '../../endpoints/admin-refund-hub';
import { registerAdminShopRefundsEndpoints } from '../../endpoints/admin-shop-refunds';

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSelect = select as jest.MockedFunction<typeof select>;
const mockedListHub = listAdminRefundHubCases as jest.MockedFunction<typeof listAdminRefundHubCases>;
const mockedHubDetail = getAdminRefundHubDetail as jest.MockedFunction<typeof getAdminRefundHubDetail>;
const mockedApprove = approveMealRefundCase as jest.MockedFunction<typeof approveMealRefundCase>;
const mockedBackfill = backfillMealRefundCaseByOrderRef as jest.MockedFunction<
  typeof backfillMealRefundCaseByOrderRef
>;
const mockedReject = rejectMealRefundCase as jest.MockedFunction<typeof rejectMealRefundCase>;
const mockedInitiate = initiateShopOrderRazorpayRefund as jest.MockedFunction<
  typeof initiateShopOrderRazorpayRefund
>;
const mockedReconcile = reconcileShopRefundById as jest.MockedFunction<typeof reconcileShopRefundById>;
const mockedDestOptions = getBannerDestinationOptions as jest.MockedFunction<
  typeof getBannerDestinationOptions
>;
const mockedEstimate = estimateCampaignAudience as jest.MockedFunction<typeof estimateCampaignAudience>;
const mockedCron = processDueScheduledCampaigns as jest.MockedFunction<typeof processDueScheduledCampaigns>;
const mockedUpload = uploadDisplayImage as jest.MockedFunction<typeof uploadDisplayImage>;

const srcRoot = path.join(__dirname, '../..');

function read(rel: string) {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

const batch3Files = [
  'endpoints/admin/endpoints/notification-campaigns.ts',
  'endpoints/admin/endpoints/admin-governance-enhanced.ts',
  'endpoints/admin-refund-hub.ts',
  'endpoints/admin-shop-refunds.ts',
];

function assertNoSensitiveLeak(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/relation "|column "|syntax error|pg_|ECONNREFUSED|AccessDenied|stackTrace|at Object\./i);
  expect(text).not.toMatch(/AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|aws_secret|client_secret=/i);
  expect(text).not.toMatch(/Razorpay fund account|secretsmanager|arn:aws:iam/i);
  expect((body as any)?.stack).toBeUndefined();
}

describe('Stage 4.1 Batch 3 — source contracts', () => {
  it.each(batch3Files)('%s imports SAFE_INTERNAL_ERROR_MESSAGE', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).toMatch(/from ['"].*safe-hono-error['"]/);
  });

  it.each(batch3Files)('%s does not return raw unexpected exception messages', (rel) => {
    const src = read(rel);
    // Strip ImageProcessingError typed branches before checking unexpected disclosures.
    const withoutTypedImageErrors = src.replace(
      /if \(error instanceof ImageProcessingError\)[\s\S]*?return c\.json\(\{\s*error:\s*error\.message\s*\},\s*error\.statusCode[\s\S]*?;/g,
      '',
    );
    expect(withoutTypedImageErrors).not.toMatch(/return c\.json\(\{\s*error:\s*error\.message/);
    expect(withoutTypedImageErrors).not.toMatch(
      /return c\.json\(\{\s*success:\s*false,\s*error:\s*error\.message/,
    );
    expect(withoutTypedImageErrors).not.toMatch(
      /return c\.json\(\{\s*success:\s*false,\s*error:\s*\(e as Error\)\.message/,
    );
    expect(withoutTypedImageErrors).not.toMatch(/return this\.error\(`[^`]*\$\{error\.message\}/);
    expect(withoutTypedImageErrors).not.toMatch(/error:\s*error\.message\s*\|\|/);
    expect(withoutTypedImageErrors).not.toMatch(/const msg = error instanceof Error \? error\.message/);
    expect(withoutTypedImageErrors).not.toMatch(
      /return c\.json\(\{\s*success:\s*true,\s*states:\s*\[\],\s*error:\s*error\.message/,
    );
    expect(withoutTypedImageErrors).not.toMatch(
      /return c\.json\(\{\s*success:\s*true,\s*cities:\s*\[\],\s*error:\s*error\.message/,
    );
  });

  it('notification-campaigns preserves intentional 400/404 business errors', () => {
    const src = read('endpoints/admin/endpoints/notification-campaigns.ts');
    expect(src).toMatch(/return c\.json\(\{\s*error:\s*'Enter a name, phone, UUID, or date range'\s*\},\s*400\)/);
    expect(src).toMatch(/return c\.json\(\{\s*error:\s*'Campaign not found'\s*\},\s*404\)/);
    expect(src).toMatch(/return c\.json\(\{\s*error:\s*'Segment not found'\s*\},\s*404\)/);
  });

  it('governance-enhanced sanitizes nested bulk and degraded 200 errors', () => {
    const src = read('endpoints/admin/endpoints/admin-governance-enhanced.ts');
    expect(src).toMatch(
      /results\.push\(\{\s*vendorId:\s*vendor\.id,\s*status:\s*'error',\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\}\)/,
    );
    expect(src).toMatch(
      /return c\.json\(\{\s*success:\s*true,\s*states:\s*\[\],\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\}\)/,
    );
    expect(src).toMatch(
      /return c\.json\(\{\s*success:\s*true,\s*cities:\s*\[\],\s*error:\s*SAFE_INTERNAL_ERROR_MESSAGE\s*\}\)/,
    );
    // ImageProcessingError typed path preserved
    expect(src).toMatch(
      /if \(error instanceof ImageProcessingError\)[\s\S]{0,120}return c\.json\(\{\s*error:\s*error\.message\s*\},\s*error\.statusCode/,
    );
    // control-flow includes preserved (not client echo of raw DB text as primary error)
    expect(src).toMatch(/error\.message\.includes\('does not exist'\)/);
  });

  it('refund hub preserves intentional business errors and sanitizes catches', () => {
    const src = read('endpoints/admin-refund-hub.ts');
    expect(src).toMatch(/error:\s*'orderNumber or mealOrderId is required'/);
    expect(src).toMatch(/error:\s*'Case not found'/);
    expect(src).toMatch(/error:\s*result\.error/);
    expect(src).toMatch(/error:\s*SAFE_INTERNAL_ERROR_MESSAGE/);
    expect(src).not.toMatch(/\(e as Error\)\.message/);
  });

  it('shop refunds preserves typed business errors and sanitizes catches', () => {
    const src = read('endpoints/admin-shop-refunds.ts');
    expect(src).toMatch(/error:\s*'orderNumber or orderId is required'/);
    expect(src).toMatch(/error:\s*'Shop order not found'/);
    expect(src).toMatch(/error:\s*'Invalid refund amount for order'/);
    expect(src).toMatch(/error:\s*result\.error/);
    expect(src).not.toMatch(/\(e as Error\)\.message/);
  });
});

describe('Stage 4.1 Batch 3 — notification campaigns runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedEstimate.mockReset();
    mockedCron.mockReset();
  });

  it('customer lookup unexpected DB failure returns generic 500', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('relation "customers" does not exist'));
    const app = new Hono();
    registerNotificationCampaignEndpoints(app);
    const res = await app.request(
      'http://localhost/admin/notifications/customer-lookup?q=Ada',
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('estimate-audience unexpected failure does not disclose internals', async () => {
    mockedEstimate.mockRejectedValueOnce(new Error('SNS provider timeout ECONNREFUSED 10.0.0.1'));
    const app = new Hono();
    registerNotificationCampaignEndpoints(app);
    const res = await app.request('http://localhost/admin/notifications/estimate-audience', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('intentional customer lookup validation 400 remains unchanged', async () => {
    const app = new Hono();
    registerNotificationCampaignEndpoints(app);
    const res = await app.request('http://localhost/admin/notifications/customer-lookup');
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Enter a name, phone, UUID, or date range');
  });

  it('campaign get 404 remains intentional', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    const app = new Hono();
    registerNotificationCampaignEndpoints(app);
    const res = await app.request(
      'http://localhost/admin/notifications/campaigns/11111111-1111-4111-8111-111111111111',
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Campaign not found');
  });

  it('cron unexpected failure returns sanitized success:false 500', async () => {
    mockedCron.mockRejectedValueOnce(new Error('provider delivery queue unavailable'));
    const app = new Hono();
    registerNotificationCampaignEndpoints(app);
    const res = await app.request('http://localhost/admin/notifications/campaigns/process-scheduled', {
      method: 'POST',
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });
});

describe('Stage 4.1 Batch 3 — governance enhanced runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSelect.mockReset();
    mockedDestOptions.mockReset();
    mockedUpload.mockReset();
  });

  it('tax calculate unexpected failure is sanitized', async () => {
    const app = new Hono();
    registerAdminGovernanceEnhancedEndpoints(app);
    const res = await app.request('http://localhost/admin/tax/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('destination-options unexpected failure is sanitized', async () => {
    mockedDestOptions.mockRejectedValueOnce(
      new Error('column "banner_destinations" does not exist'),
    );
    const app = new Hono();
    registerAdminGovernanceEnhancedEndpoints(app);
    const res = await app.request('http://localhost/admin/banners/destination-options');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(body.categories).toEqual([]);
    assertNoSensitiveLeak(body);
  });

  it('capability refresh nested bulk errors do not expose raw exception text', async () => {
    mockedSelect.mockImplementation(async (table: string, where?: any) => {
      if (table === 'vendors' && where?.status === 'active') {
        return [{ id: 'v-1', status: 'active' }] as any;
      }
      if (table === 'vendors' && where?.id === 'v-1') {
        return [{ id: 'v-1' }] as any; // missing role_id → throws inside refresh
      }
      return [] as any;
    });
    const app = new Hono();
    registerAdminGovernanceEnhancedEndpoints(app);
    const res = await app.request('http://localhost/admin/capabilities/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results[0].status).toBe('error');
    expect(body.results[0].error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    expect(body.results[0].error).not.toMatch(/role assigned|Vendor not found/i);
    assertNoSensitiveLeak(body);
  });

  it('capability refresh outer unexpected failure is sanitized', async () => {
    mockedSelect.mockRejectedValueOnce(new Error('connection terminated unexpectedly'));
    const app = new Hono();
    registerAdminGovernanceEnhancedEndpoints(app);
    const res = await app.request('http://localhost/admin/capabilities/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vendorId: 'v-missing' }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    const err = body.error || body.message || body.data?.error;
    expect(String(err)).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('vendorId validation on services remains intentional 400', async () => {
    const app = new Hono();
    registerAdminGovernanceEnhancedEndpoints(app);
    // Empty vendorId path — route param always present; use body validation via tax missing fields
    const res = await app.request('http://localhost/admin/tax/calculate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/amount and gstRate are required/i);
  });

  it('ImageProcessingError typed behavior is preserved on banner image upload', async () => {
    mockedSelect.mockResolvedValueOnce([{ id: 'b1', type: 'main', image_url: null }] as any);
    mockedUpload.mockRejectedValueOnce(new ImageProcessingError('Unsupported image format', 400));
    const app = new Hono();
    registerAdminGovernanceEnhancedEndpoints(app);

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'x.png');

    const res = await app.request('http://localhost/admin/banners/b1/image', {
      method: 'POST',
      body: form as any,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Unsupported image format');
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });
});

describe('Stage 4.1 Batch 3 — refund hub runtime', () => {
  beforeEach(() => {
    mockedListHub.mockReset();
    mockedHubDetail.mockReset();
    mockedApprove.mockReset();
    mockedBackfill.mockReset();
    mockedReject.mockReset();
  });

  it('list unexpected failure returns generic message', async () => {
    mockedListHub.mockRejectedValueOnce(new Error('relation "refunds" does not exist'));
    const app = new Hono();
    registerAdminRefundHubEndpoints(app);
    const res = await app.request('http://localhost/admin/refund-cases');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('approve unexpected provider failure returns generic message', async () => {
    mockedApprove.mockRejectedValueOnce(new Error('Razorpay refund HTTP 500: gateway_timeout'));
    const app = new Hono();
    registerAdminRefundHubEndpoints(app);
    const res = await app.request('http://localhost/admin/refund-cases/meal_case/c1/approve', {
      method: 'POST',
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('intentional backfill validation 400 remains unchanged', async () => {
    const app = new Hono();
    registerAdminRefundHubEndpoints(app);
    const res = await app.request('http://localhost/admin/refund-cases/meal-backfill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('orderNumber or mealOrderId is required');
  });

  it('intentional case not found 404 remains unchanged', async () => {
    mockedHubDetail.mockResolvedValueOnce(null as any);
    const app = new Hono();
    registerAdminRefundHubEndpoints(app);
    const res = await app.request('http://localhost/admin/refund-cases/refund/abc');
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Case not found');
  });

  it('approve business result.error remains intentional', async () => {
    mockedApprove.mockResolvedValueOnce({
      ok: false,
      error: 'Case already processed',
      alreadyProcessed: true,
    } as any);
    const app = new Hono();
    registerAdminRefundHubEndpoints(app);
    const res = await app.request('http://localhost/admin/refund-cases/meal_case/c1/approve', {
      method: 'POST',
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Case already processed');
    expect(body.error).not.toBe(SAFE_INTERNAL_ERROR_MESSAGE);
  });
});

describe('Stage 4.1 Batch 3 — shop refunds runtime', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedInitiate.mockReset();
    mockedReconcile.mockReset();
  });

  it('list unexpected DB failure returns generic message', async () => {
    mockedQuery.mockRejectedValue(new Error('column "refund_status" does not exist'));
    const app = new Hono();
    registerAdminShopRefundsEndpoints(app);
    const res = await app.request('http://localhost/admin/shop-refunds');
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('initiate unexpected provider exception is sanitized', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'o1',
          customer_id: 'c1',
          vendor_id: 'v1',
          total_amount: '100',
          payment_amount: '100',
          order_number: 'ORD-1',
        },
      ],
    } as any);
    mockedInitiate.mockRejectedValueOnce(
      new Error('Razorpay createRefund failed: INVALID_KEY raw payload {...}'),
    );
    const app = new Hono();
    registerAdminShopRefundsEndpoints(app);
    const res = await app.request('http://localhost/admin/shop-refunds/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'o1' }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.error).toBe(SAFE_INTERNAL_ERROR_MESSAGE);
    assertNoSensitiveLeak(body);
  });

  it('initiate missing order ref remains intentional 400', async () => {
    const app = new Hono();
    registerAdminShopRefundsEndpoints(app);
    const res = await app.request('http://localhost/admin/shop-refunds/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('orderNumber or orderId is required');
  });

  it('reconcile not-found typed business error preserved', async () => {
    mockedReconcile.mockResolvedValueOnce({
      success: false,
      error: 'Shop refund not found',
    } as any);
    const app = new Hono();
    registerAdminShopRefundsEndpoints(app);
    const res = await app.request('http://localhost/admin/shop-refunds/r1/reconcile', {
      method: 'POST',
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Shop refund not found');
  });

  it('initiate success contract remains unchanged when service returns result.error', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'o1',
          customer_id: 'c1',
          vendor_id: 'v1',
          total_amount: '50',
          payment_amount: '50',
          order_number: 'ORD-2',
        },
      ],
    } as any);
    mockedInitiate.mockResolvedValueOnce({
      success: false,
      refundStatus: 'failed',
      refundId: null,
      razorpayRefundId: null,
      alreadyProcessed: false,
      error: 'Payment already fully refunded',
    } as any);
    const app = new Hono();
    registerAdminShopRefundsEndpoints(app);
    const res = await app.request('http://localhost/admin/shop-refunds/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderNumber: 'ORD-2' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.orderNumber).toBe('ORD-2');
    expect(body.error).toBe('Payment already fully refunded');
    expect(body.success).toBe(false);
  });
});
