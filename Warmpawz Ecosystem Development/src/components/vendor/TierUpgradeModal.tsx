import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Check, Crown, ArrowRight } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface Tier {
  id: string;
  name: string;
  displayName: string;
  description: string;
  commissionRate: number;
  payoutPeriodDays: number;
  monthlyCost: number;
  yearlyCost: number;
  features: string[];
}

interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTierId: string;
  vendorId: string;
  onSuccess: () => void;
}

export function TierUpgradeModal({ isOpen, onClose, currentTierId, vendorId, onSuccess }: TierUpgradeModalProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    if (isOpen) {
      loadTiers();
    }
  }, [isOpen]);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/payments/tiers`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setTiers(data.tiers || []);
        // Select next tier by default if available
        const currentTierIndex = (data.tiers || []).findIndex((t: any) => t.id === currentTierId);
        if (currentTierIndex !== -1 && currentTierIndex < data.tiers.length - 1) {
          setSelectedTierId(data.tiers[currentTierIndex + 1].id);
        }
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedTierId) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/payment-tier/upgrade-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          targetTierId: selectedTierId,
          billingCycle
        })
      });

      if (response.ok) {
        toast.success('Tier upgraded successfully!');
        onSuccess();
        onClose();
      } else {
        toast.error('Failed to process upgrade');
      }
    } catch (error) {
      toast.error('Error processing upgrade');
    } finally {
      setProcessing(false);
    }
  };

  const selectedTier = tiers.find(t => t.id === selectedTierId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>Choose a plan that fits your business needs</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex justify-center">
              <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    billingCycle === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    billingCycle === 'yearly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                  }`}
                >
                  Yearly <span className="text-[10px] text-green-600 font-bold">SAVE 20%</span>
                </button>
              </div>
            </div>

            {/* Tiers Grid */}
            <div className="grid grid-cols-3 gap-4">
              {tiers.map((tier) => {
                const isCurrent = tier.id === currentTierId;
                const isSelected = tier.id === selectedTierId;
                const price = billingCycle === 'monthly' ? tier.monthlyCost : tier.yearlyCost;

                return (
                  <div 
                    key={tier.id}
                    onClick={() => !isCurrent && setSelectedTierId(tier.id)}
                    className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      isCurrent 
                        ? 'border-gray-200 bg-gray-50 opacity-70 cursor-default' 
                        : isSelected 
                          ? 'border-[#FF8C42] bg-orange-50 ring-1 ring-[#FF8C42]' 
                          : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute top-0 right-0 bg-gray-200 text-gray-600 text-[10px] px-2 py-1 rounded-bl-lg font-medium">
                        Current
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 bg-[#FF8C42] text-white text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </div>
                    )}

                    <h3 className="font-bold text-gray-900 mb-1">{tier.displayName}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-gray-900">
                        {price === 0 ? 'Free' : `₹${price.toLocaleString()}`}
                      </span>
                      {price > 0 && (
                        <span className="text-xs text-gray-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Commission</span>
                        <span className="font-bold text-gray-900">{tier.commissionRate}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Payout</span>
                        <span className="font-bold text-gray-900">T+{tier.payoutPeriodDays} days</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {tier.features.slice(0, 3).map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-gray-600">
                          <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleUpgrade} 
            disabled={!selectedTierId || processing || loading}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            {processing ? 'Processing Payment...' : 'Upgrade Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
