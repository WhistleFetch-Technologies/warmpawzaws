import { useState, useEffect } from 'react';
import {
  Check,
  X,
  Crown,
  Zap,
  Star,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Award,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface TierFeature {
  name: string;
  included: boolean;
  highlight?: boolean;
}

interface TierPlan {
  tierId: string;
  tierName: string;
  icon: any;
  color: string;
  monthlyFee: number;
  annualFee: number;
  commissionRate: number;
  features: TierFeature[];
  benefits: string[];
  limitations?: string[];
  recommended?: boolean;
}

const TIER_PLANS: TierPlan[] = [
  {
    tierId: 'basic',
    tierName: 'Basic',
    icon: Star,
    color: 'gray',
    monthlyFee: 0,
    annualFee: 0,
    commissionRate: 20,
    features: [
      { name: 'Up to 50 bookings/month', included: true },
      { name: 'Basic profile listing', included: true },
      { name: 'Standard support', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Priority listing', included: false },
      { name: 'Analytics dashboard', included: false },
      { name: 'Marketing tools', included: false },
      { name: 'Dedicated account manager', included: false }
    ],
    benefits: [
      'Get started for free',
      'Accept bookings immediately',
      'Build your reputation'
    ],
    limitations: [
      '20% platform commission',
      'Limited visibility',
      'Basic features only'
    ]
  },
  {
    tierId: 'pro',
    tierName: 'Professional',
    icon: Zap,
    color: 'blue',
    monthlyFee: 999,
    annualFee: 9999, // 2 months free
    commissionRate: 15,
    features: [
      { name: 'Up to 200 bookings/month', included: true },
      { name: 'Enhanced profile with photos', included: true },
      { name: 'Priority support', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Priority listing', included: true, highlight: true },
      { name: 'Analytics dashboard', included: true, highlight: true },
      { name: 'Marketing tools', included: true },
      { name: 'Dedicated account manager', included: false }
    ],
    benefits: [
      'Lower 15% commission',
      'Priority in search results',
      'Advanced analytics',
      'Promotional campaigns',
      'Faster payouts'
    ],
    recommended: true
  },
  {
    tierId: 'enterprise',
    tierName: 'Enterprise',
    icon: Crown,
    color: 'purple',
    monthlyFee: 2499,
    annualFee: 24999, // 2 months free
    commissionRate: 10,
    features: [
      { name: 'Unlimited bookings', included: true, highlight: true },
      { name: 'Premium profile with videos', included: true },
      { name: '24/7 priority support', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Top priority listing', included: true, highlight: true },
      { name: 'Advanced analytics & reports', included: true, highlight: true },
      { name: 'Full marketing suite', included: true, highlight: true },
      { name: 'Dedicated account manager', included: true, highlight: true }
    ],
    benefits: [
      'Lowest 10% commission',
      'Maximum visibility',
      'White-glove service',
      'Custom integrations',
      'Same-day payouts',
      'Co-marketing opportunities'
    ]
  }
];

interface TierUpgradeFlowProps {
  vendorId: string;
  currentTier: string;
  onUpgradeComplete?: () => void;
  onClose?: () => void;
}

export function TierUpgradeFlow({
  vendorId,
  currentTier,
  onUpgradeComplete,
  onClose
}: TierUpgradeFlowProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const handleUpgrade = async () => {
    if (!selectedTier) return;

    try {
      setProcessingPayment(true);
      const tier = TIER_PLANS.find(t => t.tierId === selectedTier);
      if (!tier) return;

      const amount = billingCycle === 'monthly' ? tier.monthlyFee : tier.annualFee;

      // Create upgrade order
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/tier/upgrade`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId,
            newTierId: selectedTier,
            billingCycle,
            amount
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Initiate Razorpay payment
          const options = {
            key: data.razorpayKeyId,
            amount: amount * 100, // paise
            currency: 'INR',
            name: 'Warmpawz',
            description: `Upgrade to ${tier.tierName} - ${billingCycle}`,
            order_id: data.orderId,
            handler: async (response: any) => {
              // Verify payment
              const verifyRes = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/tier/upgrade/verify`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    vendorId,
                    orderId: data.orderId,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature
                  })
                }
              );

              if (verifyRes.ok) {
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                  toast.success('🎉 Tier upgraded successfully!');
                  if (onUpgradeComplete) onUpgradeComplete();
                  if (onClose) onClose();
                } else {
                  toast.error('Payment verification failed');
                }
              }
            },
            prefill: {
              name: data.vendorName,
              email: data.vendorEmail,
              contact: data.vendorPhone
            },
            theme: {
              color: '#FF8C42'
            }
          };

          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
        } else {
          toast.error(data.message || 'Failed to create upgrade order');
        }
      } else {
        toast.error('Failed to initiate upgrade');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('An error occurred during upgrade');
    } finally {
      setProcessingPayment(false);
    }
  };

  const currentTierIndex = TIER_PLANS.findIndex(t => t.tierId === currentTier);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full mb-4">
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">Upgrade Your Tier</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Grow Your Business with Premium Features
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Unlock lower commissions, priority listings, and powerful tools to boost your bookings
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all relative ${
              billingCycle === 'annual'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Annual
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Save 17%
            </span>
          </button>
        </div>

        {/* Tier Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {TIER_PLANS.map((tier, index) => {
            const Icon = tier.icon;
            const isCurrentTier = tier.tierId === currentTier;
            const isUpgrade = index > currentTierIndex;
            const isDowngrade = index < currentTierIndex;

            return (
              <Card
                key={tier.tierId}
                className={`relative p-8 transition-all ${
                  selectedTier === tier.tierId
                    ? 'ring-4 ring-orange-500 shadow-2xl scale-105'
                    : tier.recommended
                    ? 'ring-2 ring-blue-500 shadow-xl'
                    : 'shadow-lg hover:shadow-xl'
                } ${isCurrentTier ? 'opacity-75' : ''}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1">
                      RECOMMENDED
                    </Badge>
                  </div>
                )}

                {isCurrentTier && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-green-600 text-white px-4 py-1">
                      CURRENT TIER
                    </Badge>
                  </div>
                )}

                {/* Tier Header */}
                <div className="text-center mb-6">
                  <div
                    className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-${tier.color}-400 to-${tier.color}-600 flex items-center justify-center`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.tierName}</h3>
                  <div className="text-4xl font-bold text-gray-900 mb-1">
                    ₹{billingCycle === 'monthly' ? tier.monthlyFee : tier.annualFee}
                    {tier.monthlyFee > 0 && (
                      <span className="text-lg text-gray-600 font-normal">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    {tier.commissionRate}% commission on bookings
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {tier.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 ${
                        feature.highlight ? 'text-orange-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm">{feature.name}</span>
                    </div>
                  ))}
                </div>

                {/* Benefits */}
                {tier.benefits && tier.benefits.length > 0 && (
                  <div className="border-t pt-4 mb-6">
                    <p className="font-semibold text-gray-900 mb-2">Key Benefits:</p>
                    <ul className="space-y-1">
                      {tier.benefits.map((benefit, idx) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA Button */}
                {isCurrentTier ? (
                  <Button
                    disabled
                    className="w-full bg-gray-400 text-white"
                  >
                    Current Plan
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    disabled
                    variant="outline"
                    className="w-full"
                  >
                    Downgrade Not Available
                  </Button>
                ) : (
                  <Button
                    onClick={() => setSelectedTier(tier.tierId)}
                    className={`w-full ${
                      selectedTier === tier.tierId
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : tier.recommended
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-800 hover:bg-gray-900'
                    } text-white`}
                  >
                    {selectedTier === tier.tierId ? 'Selected' : 'Select Plan'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        {/* Proceed Button */}
        {selectedTier && selectedTier !== currentTier && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6 shadow-xl">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upgrading to</p>
                <p className="text-xl font-bold text-gray-900">
                  {TIER_PLANS.find(t => t.tierId === selectedTier)?.tierName}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {onClose && (
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleUpgrade}
                  disabled={processingPayment}
                  className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-8 py-6 text-lg"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Proceed to Payment
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
