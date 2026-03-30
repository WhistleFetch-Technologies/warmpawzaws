/**
 * Razorpay Payment Utilities
 * Centralized functions for Razorpay payment processing
 */

export interface RazorpayOrderResponse {
  orderId: string;
  keyId?: string;
  amount?: number;
  currency?: string;
}

export interface RazorpayCheckoutOptions {
  orderId: string;
  amount: number;
  currency?: string;
  description: string;
  customerPhone?: string;
  keyId?: string; // Razorpay key ID from API response
  onSuccess: (response: any) => Promise<void>;
  onDismiss?: () => void;
}

/**
 * Load Razorpay checkout script dynamically
 */
export const loadRazorpayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not available'));
      return;
    }

    // If already loaded, resolve immediately
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if ((window as any).Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
        }
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Razorpay script'));
      });
      return;
    }

    // Create and load new script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      setTimeout(() => {
        if ((window as any).Razorpay) {
          resolve();
        } else {
          reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
        }
      }, 100);
    };

    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };

    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay checkout modal
 */
export const openRazorpayCheckout: any = async (options: RazorpayCheckoutOptions): Promise<void> => {
  // Load script if needed
  await loadRazorpayScript();

  if (!(window as any).Razorpay) {
    throw new Error('Razorpay is not available');
  }

  // Use keyId from API response, fallback to environment variable
  const razorpayKey = options.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY;

  if (!razorpayKey) {
    throw new Error('Razorpay key is missing. Please provide keyId or set NEXT_PUBLIC_RAZORPAY_KEY environment variable.');
  }

  const razorpayOptions = {
    key: razorpayKey,
    amount: Math.round(options.amount * 100), // Convert to paise
    currency: options.currency || 'INR',
    name: 'Warmpawz',
    description: options.description,
    order_id: options.orderId,
    handler: options.onSuccess,
    prefill: options.customerPhone ? {
      contact: options.customerPhone.replace(/[^0-9]/g, ''),
    } : undefined,
    theme: {
      color: '#FF8C42',
    },
    modal: {
      ondismiss: options.onDismiss || (() => { }),
    },
  };

  const razorpay = new (window as any).Razorpay(razorpayOptions);
  razorpay.open();
};
