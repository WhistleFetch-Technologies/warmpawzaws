import type { RefObject } from 'react';
import RazorpayCheckout from 'react-native-razorpay';
import type { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

/** Must match apps/customer-web/lib/razorpay/native-webview-bridge.ts */
export const WARMPAWZ_RAZORPAY_NATIVE_MSG = {
  OPEN: 'WARMPAWZ_RAZORPAY_OPEN',
  RESULT: 'WARMPAWZ_RAZORPAY_RESULT',
} as const;

function injectJsonResult(webRef: RefObject<WebView | null>, payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const js = `;(function(){try{var p=${json};window.postMessage(typeof p==='string'?p:JSON.stringify(p),'*');}catch(e){}})();true;`;
  webRef.current?.injectJavaScript(js);
}

/**
 * Handle postMessage from customer-web when it requests native Razorpay.
 * Return true if the message was handled (caller should not process further).
 */
export async function handleCustomerWebHybridRazorpayMessage(
  event: WebViewMessageEvent,
  webRef: RefObject<WebView | null>
): Promise<boolean> {
  let data: { type?: string; payload?: Record<string, unknown> };
  try {
    data = JSON.parse(event.nativeEvent.data);
  } catch {
    return false;
  }
  if (data?.type !== WARMPAWZ_RAZORPAY_NATIVE_MSG.OPEN || !data.payload) {
    return false;
  }
  try {
    const r = (await RazorpayCheckout.open(data.payload as any)) as Record<string, string>;
    injectJsonResult(webRef, {
      type: WARMPAWZ_RAZORPAY_NATIVE_MSG.RESULT,
      payload: {
        razorpay_order_id: r.razorpay_order_id,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature,
      },
    });
  } catch (e: any) {
    const desc = e?.error?.description || e?.message || 'Payment cancelled';
    const code = e?.error?.code || e?.code;
    injectJsonResult(webRef, {
      type: WARMPAWZ_RAZORPAY_NATIVE_MSG.RESULT,
      cancelled: true,
      error: typeof desc === 'string' ? desc : String(desc),
      code,
    });
  }
  return true;
}
