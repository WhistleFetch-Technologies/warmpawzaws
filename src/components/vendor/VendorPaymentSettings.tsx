import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Crown, Building2, Wallet, CheckCircle2, AlertCircle, ChevronRight, Edit2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { TierUpgradeModal } from './TierUpgradeModal';

interface VendorPaymentSettingsProps {
  vendorId: string;
}

export function VendorPaymentSettings({ vendorId }: VendorPaymentSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any>({});
  const [earnings, setEarnings] = useState<any>({});
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tierRes, bankRes, earningsRes] = await Promise.all([
        fetch(`${API_BASE}/vendor/${vendorId}/payment-tier`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
        fetch(`${API_BASE}/vendor/${vendorId}/bank-details`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
        fetch(`${API_BASE}/ecommerce/payments/vendor/${vendorId}/earnings`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } })
      ]);

      if (tierRes.ok) {
        const data = await tierRes.json();
        setTier(data.tier);
      }
      if (bankRes.ok) {
        const data = await bankRes.json();
        setBankDetails(data.bankDetails || {});
      }
      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setEarnings(data.earnings || { total: 0, pending: 0, paidOut: 0 });
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
      toast.error('Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankDetails = async () => {
    setSavingBank(true);
    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/bank-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(bankDetails)
      });

      if (response.ok) {
        toast.success('Bank details updated successfully');
        setIsEditingBank(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update bank details');
      }
    } catch (error) {
      toast.error('Error saving bank details');
    } finally {
      setSavingBank(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payout Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 mb-1">Total Earnings</p>
            <h3 className="text-2xl font-bold text-gray-900">₹{earnings.total?.toLocaleString() || '0'}</h3>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 mb-1">Pending Payout</p>
            <h3 className="text-2xl font-bold text-[#FF8C42]">₹{earnings.pending?.toLocaleString() || '0'}</h3>
            <p className="text-xs text-gray-400 mt-1">Estimated processing: T+{tier?.payoutPeriodDays || 3} days</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500 mb-1">Paid Out</p>
            <h3 className="text-2xl font-bold text-green-600">₹{earnings.paidOut?.toLocaleString() || '0'}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Tier */}
        <Card className="border-2 border-[#FF8C42]/20 bg-orange-50/30">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Crown className="w-6 h-6 text-[#FF8C42]" />
                </div>
                <div>
                  <CardTitle className="text-lg">Current Plan</CardTitle>
                  <p className="text-sm text-gray-600">{tier?.displayName || 'Basic Tier'}</p>
                </div>
              </div>
              <Badge className="bg-[#FF8C42] text-white">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-gray-200/50">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Commission</p>
                <p className="text-xl font-bold text-gray-900">{tier?.commissionRate || 15}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Payout Speed</p>
                <p className="text-xl font-bold text-gray-900">T+{tier?.payoutPeriodDays || 3} Days</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Plan Features:</p>
              <ul className="space-y-2">
                {(tier?.features || ['Basic Support', 'Standard Listing']).map((feat: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={() => setIsUpgradeOpen(true)} className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]">
              Upgrade Plan <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Bank Details</CardTitle>
                  <p className="text-sm text-gray-600">For payouts and settlements</p>
                </div>
              </div>
              {!isEditingBank && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingBank(true)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Account Holder Name</Label>
                <Input 
                  value={bankDetails.accountHolderName || ''} 
                  onChange={e => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                  readOnly={!isEditingBank}
                  className={!isEditingBank ? 'bg-gray-50' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input 
                  value={bankDetails.accountNumber || ''} 
                  onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                  readOnly={!isEditingBank}
                  type={isEditingBank ? 'text' : 'password'}
                  className={!isEditingBank ? 'bg-gray-50' : ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input 
                    value={bankDetails.ifsc || ''} 
                    onChange={e => setBankDetails({...bankDetails, ifsc: e.target.value.toUpperCase()})}
                    readOnly={!isEditingBank}
                    className={!isEditingBank ? 'bg-gray-50' : ''}
                    maxLength={11}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Input 
                    value={bankDetails.accountType || 'Current'} 
                    onChange={e => setBankDetails({...bankDetails, accountType: e.target.value})}
                    readOnly={!isEditingBank}
                    className={!isEditingBank ? 'bg-gray-50' : ''}
                  />
                </div>
              </div>

              {isEditingBank && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditingBank(false)}>Cancel</Button>
                  <Button 
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]" 
                    onClick={handleSaveBankDetails}
                    disabled={savingBank}
                  >
                    {savingBank ? 'Saving...' : 'Save Details'}
                  </Button>
                </div>
              )}

              {!isEditingBank && bankDetails.accountNumber && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 text-green-700 text-xs rounded-md border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bank details verified</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <TierUpgradeModal 
        isOpen={isUpgradeOpen} 
        onClose={() => setIsUpgradeOpen(false)} 
        currentTierId={tier?.id} 
        vendorId={vendorId}
        onSuccess={() => {
          loadData();
          setIsUpgradeOpen(false);
        }}
      />
    </div>
  );
}
