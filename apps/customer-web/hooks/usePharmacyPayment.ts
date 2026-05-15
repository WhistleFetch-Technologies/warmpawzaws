import { useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { openRazorpayCheckout } from '@/lib/razorpay/razorpay-utils';

interface UsePharmacyPaymentOptions {
  onPaymentSuccess?: () => void;
  customerPhone?: string;
}

export const usePharmacyPayment = (options: UsePharmacyPaymentOptions = {}) => {
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const completePayment = async (orderId: string, amount: number, orderNumber?: string) => {
    if (!orderId || !amount) {
      toast.error('Order details not available');
      return;
    }

    setProcessingPayment(orderId);

    try {
      // Create Razorpay order
      const paymentRes = await apiClient.post<any>('/razorpay/create-order', {
        orderId,
        amount,
        customerId: options.customerPhone,
        type: 'pharmacy_order',
      });

      if (!paymentRes.orderId) {
        throw new Error('Failed to create payment order');
      }

      // Open Razorpay checkout 
      await openRazorpayCheckout({
        orderId: paymentRes.orderId,
        amount: paymentRes.amount || amount,
        currency: paymentRes.currency || 'INR',
        description: `Pharmacy Order - ${orderNumber || orderId.slice(0, 8)}`,
        customerPhone: options.customerPhone,
        keyId: paymentRes.keyId, // Pass keyId from API response
        onSuccess: async (response: any) => {
          try {
            // Verify payment
            await apiClient.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast.success('Payment successful!');
            options.onPaymentSuccess?.();
          } catch (err: any) {
            console.error('Payment verification failed:', err);
            toast.error(err.message || 'Payment verification failed');
            throw err;
          } finally {
            setProcessingPayment(null);
          }
        },
        onDismiss: () => {
          setProcessingPayment(null);
          toast.info('Payment cancelled');
        },
      });
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Payment failed');
      setProcessingPayment(null);
    }
  };

  return {
    completePayment,
    processingPayment,
  };
};
