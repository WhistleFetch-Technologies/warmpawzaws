import { requireAuth } from '../auth-middleware';

function createCtx(path: string, method = 'POST') {
  const next = jest.fn(async () => undefined);
  const json = jest.fn((body: unknown, status: number) => ({ body, status }));
  const c = {
    req: {
      path,
      method,
      header: () => undefined,
    },
    json,
    set: jest.fn(),
  };
  return { c, next, json };
}

describe('requireAuth Razorpay webhook vs protected APIs', () => {
  test('POST /razorpay/webhook does not require a Warmpawz JWT', async () => {
    const { c, next, json } = createCtx('/razorpay/webhook', 'POST');
    await requireAuth()(c as any, next);
    expect(next).toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  test('normal protected APIs still require JWT', async () => {
    const protectedPaths = [
      '/customer/profile',
      '/customer/warmpawz-pay/initiate',
      '/admin/payments',
      '/payments/razorpay/webhook',
      '/razorpay/verify-payment',
    ];
    for (const path of protectedPaths) {
      const { c, next, json } = createCtx(path, 'POST');
      await requireAuth()(c as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_REQUIRED' }),
        401
      );
    }
  });
});
