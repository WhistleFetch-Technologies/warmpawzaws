/**
 * ============================================================================
 * ENHANCED TIER UPGRADE MODAL
 * ============================================================================
 * 
 * Complete tier upgrade UI with:
 * - Upfront payment option
 * - Split payment option (3-4 installments)
 * - 6 month and 12 month subscription options
 * - Discount display
 * - Payment processing
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Check, Crown, ArrowRight, CreditCard, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Tier {
  id: string;
  tier_name: string;
  display_name: string;
  description: string;
  commission_rate: number;
  payout_period_days: number;
  monthly_cost: number;
  yearly_cost: number;
  six_month_cost?: number;
  six_month_discount_percentage?: number;
  twelve_month_cost?: number;
  twelve_month_discount_percentage?: number;
  allow_split_payment: boolean;
  split_payment_installments?: number;
  split_payment_interval_days?: number;
  features: string[];
  is_free_tier: boolean;
}

interface TierUpgradeModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  currentTierId: string;
  vendorId: string;
  onSuccess: () => void;
}

export function TierUpgradeModalEnhanced({ 
  isOpen, 
  onClose, 
  currentTierId, 
  vendorId, 
  onSuccess 
}: TierUpgradeModalEnhancedProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'six_month' | 'twelve_month'>('monthly');
  const [paymentType, setPaymentType] = useState<'upfront' | 'split'>('upfront');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pricing, setPricing] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    if (isOpen) {
      loadTiers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTierId && subscriptionType && paymentType) {
      calculatePricing();
    }
  }, [selectedTierId, subscriptionType, paymentType]);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/available-tiers`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTiers(data.tiers || []);
        // Select next tier by default
        const currentTierIndex = (data.tiers || []).findIndex((t: any) => t.id === currentTierId);
        if (currentTierIndex !== -1 && currentTierIndex < data.tiers.length - 1) {
          setSelectedTierId(data.tiers[currentTierIndex + 1].id);
        }
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Failed to load tiers');
    } finally {
      setLoading(false);
    }
  };

  const calculatePricing = async () => {
    if (!selectedTierId) return;

    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/calculate-tier-upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          tierId: selectedTierId,
          subscriptionType,
          paymentType
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPricing(data);
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedTierId || !pricing) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/payment-tier/upgrade-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ 
          targetTierId: selectedTierId,
          subscriptionType,
          paymentType
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // If Razorpay order created, redirect to payment
        if (data.razorpayOrderId) {
          // Initialize Razorpay payment
          const options = {
            key: data.key || Deno.env.get('RAZORPAY_KEY_ID'),
            amount: data.amount * 100, // Convert to paise
            currency: 'INR',
            name: 'WarmPawz',
            description: `Tier Upgrade - ${pricing.tier.displayName}`,
            order_id: data.razorpayOrderId,
            handler: async (response: any) => {
              // Verify payment
              const verifyResponse = await fetch(`${API_BASE}/vendor/${vendorId}/tier-upgrade/verify-payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
                },
                body: JSON.stringify({
                  paymentId: data.paymentId,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                })
              });

              if (verifyResponse.ok) {
                toast.success('Tier upgraded successfully!');
                onSuccess();
                onClose();
              } else {
                toast.error('Payment verification failed');
              }
            },
            prefill: {
              // Prefill customer details if available
            },
            theme: {
              color: '#FF8C42'
            }
          };

          // @ts-ignore - Razorpay types
          const razorpay = new Razorpay(options);
          razorpay.open();
        } else {
          toast.success('Tier upgrade initiated!');
          onSuccess();
          onClose();
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to process upgrade');
      }
    } catch (error) {
      console.error('Tier upgrade error:', error);
      toast.error('Error processing upgrade');
    } finally {
      setProcessing(false);
    }
  };

  const selectedTier = tiers.find(t => t.id === selectedTierId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose a plan and payment option that fits your business needs
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subscription Type Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Subscription Duration</Label>
              <RadioGroup value={subscriptionType} onValueChange={(v: any) => setSubscriptionType(v)}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border rounded-lg p-4 cursor-pointer hover:border-[#FF8C42] data-[state=checked]:border-[#FF8C42] data-[state=checked]:bg-orange-50">
                    <RadioGroupItem value="monthly" id="monthly" className="sr-only" />
                    <Label htmlFor="monthly" className="cursor-pointer">
                      <div className="font-semibold">Monthly</div>
                      <div className="text-sm text-slate-600">
                        {selectedTier?.monthly_cost === 0 ? 'Free' : `₹${selectedTier?.monthly_cost || 0}/mo`}
                      </div>
                    </Label>
                  </div>
                  <div className="border rounded-lg p-4 cursor-pointer hover:border-[#FF8C42] data-[state=checked]:border-[#FF8C42] data-[state=checked]:bg-orange-50 relative">
                    <RadioGroupItem value="six_month" id="six_month" className="sr-only" />
                    <Label htmlFor="six_month" className="cursor-pointer">
                      <Badge className="absolute top-2 right-2 text-[10px]">SAVE {selectedTier?.six_month_discount_percentage || 0}%</Badge>
                      <div className="font-semibold">6 Months</div>
                      <div className="text-sm text-slate-600">
                        {selectedTier?.six_month_cost 
                          ? `₹${selectedTier.six_month_cost}/6mo`
                          : `₹${(selectedTier?.monthly_cost || 0) * 6}/6mo`}
                      </div>
                    </Label>
                  </div>
                  <div className="border rounded-lg p-4 cursor-pointer hover:border-[#FF8C42] data-[state=checked]:border-[#FF8C42] data-[state=checked]:bg-orange-50 relative">
                    <RadioGroupItem value="twelve_month" id="twelve_month" className="sr-only" />
                    <Label htmlFor="twelve_month" className="cursor-pointer">
                      <Badge className="absolute top-2 right-2 text-[10px] bg-green-500">SAVE {selectedTier?.twelve_month_discount_percentage || 0}%</Badge>
                      <div className="font-semibold">12 Months</div>
                      <div className="text-sm text-slate-600">
                        {selectedTier?.twelve_month_cost || selectedTier?.yearly_cost
                          ? `₹${selectedTier.twelve_month_cost || selectedTier.yearly_cost}/yr`
                          : `₹${(selectedTier?.monthly_cost || 0) * 12}/yr`}
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Payment Type Selection */}
            {selectedTier && !selectedTier.is_free_tier && selectedTier.allow_split_payment && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Payment Option</Label>
                <RadioGroup value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-lg p-4 cursor-pointer hover:border-[#FF8C42] data-[state=checked]:border-[#FF8C42] data-[state=checked]:bg-orange-50">
                      <RadioGroupItem value="upfront" id="upfront" className="sr-only" />
                      <Label htmlFor="upfront" className="cursor-pointer flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        <div>
                          <div className="font-semibold">Pay Upfront</div>
                          <div className="text-xs text-slate-600">Full amount now</div>
                        </div>
                      </Label>
                    </div>
                    <div className="border rounded-lg p-4 cursor-pointer hover:border-[#FF8C42] data-[state=checked]:border-[#FF8C42] data-[state=checked]:bg-orange-50">
                      <RadioGroupItem value="split" id="split" className="sr-only" />
                      <Label htmlFor="split" className="cursor-pointer flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        <div>
                          <div className="font-semibold">Split Payment</div>
                          <div className="text-xs text-slate-600">
                            {selectedTier.split_payment_installments || 3} installments
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Pricing Summary */}
            {pricing && (
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Amount:</span>
                  <span className="font-semibold">₹{pricing.pricing.baseAmount.toFixed(2)}</span>
                </div>
                {pricing.pricing.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-₹{pricing.pricing.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {pricing.splitDetails && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-slate-500 mb-1">Split Payment Plan:</div>
                    <div className="text-sm">
                      {pricing.splitDetails.installments} payments of ₹{pricing.splitDetails.installmentAmount.toFixed(2)}
                    </div>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t font-bold text-lg">
                  <span>Total Amount:</span>
                  <span className="text-[#FF8C42]">₹{pricing.pricing.finalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Tier Features */}
            {selectedTier && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Features</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTier.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleUpgrade} 
            disabled={!selectedTierId || processing || loading || !pricing}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            {processing ? 'Processing...' : `Upgrade Now - ₹${pricing?.pricing.finalAmount.toFixed(2) || '0'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

