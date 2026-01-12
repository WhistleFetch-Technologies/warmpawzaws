import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Check, Crown, Sparkles, Heart, 
  MessageCircle, Calendar, Star, Zap, Shield
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MatingDatingSubscriptionProps {
  phone: string;
  onBack: () => void;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function MatingDatingSubscription({ phone, onBack, onSuccess }: MatingDatingSubscriptionProps) {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTiers();
    loadRazorpayScript();
  }, []);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const loadTiers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/subscription-tiers?tierType=p2p_service&isActive=true`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        const sortedTiers = (result.tiers || []).sort((a: any, b: any) => a.price - b.price);
        setTiers(sortedTiers);
        if (sortedTiers.length > 0) {
          setSelectedTier(sortedTiers[0]);
        }
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedTier) {
      toast.error('Please select a plan');
      return;
    }

    try {
      setProcessing(true);

      // Create Razorpay order
      const orderResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/payment/create-order`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: selectedTier.price * 100, // Convert to paise
            currency: 'INR',
            notes: {
              purpose: 'subscription',
              tierId: selectedTier.id,
              tierName: selectedTier.name,
              userId: phone
            }
          })
        }
      );

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const { orderId } = await orderResponse.json();

      // Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_key',
        amount: selectedTier.price * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: `${selectedTier.name} Subscription`,
        order_id: orderId,
        prefill: {
          contact: phone
        },
        theme: {
          color: '#FF8C42'
        },
        handler: async (response: any) => {
          // Payment successful, activate subscription
          try {
            const subResponse = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/subscriptions/user/subscribe`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId: phone,
                  tierId: selectedTier.id,
                  paymentId: response.razorpay_payment_id,
                  paymentMethod: 'razorpay'
                })
              }
            );

            if (subResponse.ok) {
              toast.success('Subscription activated! 🎉');
              onSuccess();
            } else {
              throw new Error('Failed to activate subscription');
            }
          } catch (error) {
            console.error('Error activating subscription:', error);
            toast.error('Payment successful but subscription activation failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast.info('Payment cancelled');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        setProcessing(false);
        toast.error('Payment failed. Please try again.');
        console.error('Payment failed:', response.error);
      });
      rzp.open();
    } catch (error) {
      console.error('Error processing subscription:', error);
      toast.error('Failed to process subscription');
      setProcessing(false);
    }
  };

  const getBillingLabel = (cycle: string) => {
    switch (cycle) {
      case 'monthly': return 'month';
      case 'quarterly': return '3 months';
      case 'semi_annual': return '6 months';
      case 'annual': return 'year';
      default: return cycle;
    }
  };

  const getSavingsPercent = (tier: any, baseTier: any) => {
    if (!baseTier || tier.billingCycle === 'monthly') return 0;
    
    const monthlyPrice = baseTier.price;
    const effectiveMonthly = tier.billingCycle === 'quarterly' ? tier.price / 3 :
                            tier.billingCycle === 'semi_annual' ? tier.price / 6 :
                            tier.billingCycle === 'annual' ? tier.price / 12 : tier.price;
    
    return Math.round(((monthlyPrice - effectiveMonthly) / monthlyPrice) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  const monthlyTier = tiers.find(t => t.billingCycle === 'monthly');

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Unlock Premium Features
            </h1>
            <p className="text-sm text-gray-600">Choose your plan</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 pb-32">
        {/* Benefits Section */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-6 h-6 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">Premium Benefits</h2>
          </div>
          
          <div className="space-y-3">
            {[
              { icon: MessageCircle, text: 'Unlimited chat with matches', color: 'text-blue-500' },
              { icon: Calendar, text: 'Schedule café meet-ups', color: 'text-purple-500' },
              { icon: Heart, text: 'Request mating appointments', color: 'text-pink-500' },
              { icon: Zap, text: 'Priority matching algorithm', color: 'text-yellow-500' },
              { icon: Star, text: 'See who liked you', color: 'text-orange-500' },
              { icon: Shield, text: 'Verified badge on profile', color: 'text-green-500' }
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg p-2">
                  <benefit.icon className={`w-5 h-5 ${benefit.color}`} />
                </div>
                <span className="text-gray-700">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Plans */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">Choose Your Plan</h3>
          <div className="space-y-3">
            {tiers.map((tier) => {
              const savings = getSavingsPercent(tier, monthlyTier);
              const isSelected = selectedTier?.id === tier.id;
              const isPopular = tier.billingCycle === 'quarterly' || tier.billingCycle === 'semi_annual';

              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier)}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${
                    isSelected 
                      ? 'border-pink-500 bg-gradient-to-r from-pink-50 to-purple-50 shadow-lg scale-105'
                      : 'border-gray-200 bg-white hover:border-pink-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg text-gray-900">{tier.name}</h4>
                        {isPopular && (
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{getBillingLabel(tier.billingCycle)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                        ₹{tier.price}
                      </p>
                      {tier.billingCycle !== 'monthly' && (
                        <p className="text-xs text-gray-500">
                          ₹{Math.round(tier.price / (
                            tier.billingCycle === 'quarterly' ? 3 :
                            tier.billingCycle === 'semi_annual' ? 6 : 12
                          ))}/mo
                        </p>
                      )}
                    </div>
                  </div>

                  {savings > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-green-600">
                        Save {savings}% compared to monthly
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>All premium features</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'border-pink-500 bg-pink-500' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Secure Payment</p>
              <p className="text-xs text-gray-600">
                Protected by Razorpay. Cancel anytime from settings.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-3">Common Questions</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-gray-900">Can I cancel anytime?</p>
              <p className="text-gray-600">Yes, you can cancel from your account settings.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Does it work for all my pets?</p>
              <p className="text-gray-600">Yes! One subscription covers all your pet profiles.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">What payment methods are accepted?</p>
              <p className="text-gray-600">All major cards, UPI, net banking, and wallets via Razorpay.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
        <div className="max-w-md mx-auto space-y-2">
          {selectedTier && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Selected Plan:</span>
              <span className="font-bold text-gray-900">
                {selectedTier.name} - ₹{selectedTier.price}/{getBillingLabel(selectedTier.billingCycle)}
              </span>
            </div>
          )}
          <Button
            onClick={handleSubscribe}
            disabled={!selectedTier || processing}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 text-lg"
          >
            {processing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </div>
            ) : (
              <>
                <Crown className="w-5 h-5 mr-2" />
                Subscribe Now - ₹{selectedTier?.price || 0}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
