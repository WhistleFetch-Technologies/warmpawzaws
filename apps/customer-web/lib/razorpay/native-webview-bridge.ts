/**
 * When customer-web runs inside React Native WebView, checkout.js is unreliable.
 * The host app should open react-native-razorpay and inject the result via postMessage.
 */

export const WARMPAWZ_RAZORPAY_NATIVE_MSG = {
  OPEN: 'WARMPAWZ_RAZORPAY_OPEN',
  RESULT: 'WARMPAWZ_RAZORPAY_RESULT',
} as const;

export function isWarmpawzCustomerNativeWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } };
  return typeof w.ReactNativeWebView?.postMessage === 'function';
}

function parseNativeResultData(data: unknown): {
  type: string;
  cancelled?: boolean;
  error?: string;
  payload?: Record<string, string>;
} | null {
  let obj: any = data;
  if (typeof data === 'string') {
    try {
      obj = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object' || obj.type !== WARMPAWZ_RAZORPAY_NATIVE_MSG.RESULT) {
    return null;
  }
  return obj;
}

/** Resolves with Razorpay success fields (snake_case) matching the JS SDK handler. */
export function waitForWarmpawzNativeRazorpayResult(timeoutMs = 320_000): Promise<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      detach();
      reject(new Error('Payment timed out'));
    }, timeoutMs);

    const onMsg = (event: MessageEvent) => {
      const parsed = parseNativeResultData(event.data);
      if (!parsed) return;
      detach();
      if (parsed.cancelled) {
        reject(new Error(parsed.error || 'Payment cancelled'));
        return;
      }
      if (parsed.error) {
        reject(new Error(parsed.error));
        return;
      }
      const p = parsed.payload || {};
      const razorpay_order_id = p.razorpay_order_id || (p as any).razorpayOrderId;
      const razorpay_payment_id = p.razorpay_payment_id || (p as any).razorpayPaymentId;
      const razorpay_signature = p.razorpay_signature || (p as any).razorpaySignature;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        reject(new Error('Invalid native payment response'));
        return;
      }
      resolve({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    };

    const detach = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMsg as EventListener);
      document.removeEventListener('message', onMsg as EventListener);
    };

    window.addEventListener('message', onMsg as EventListener);
    document.addEventListener('message', onMsg as EventListener);
  });
}
