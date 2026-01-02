import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Crown, Building2, Wallet, CheckCircle2, AlertCircle, ChevronRight, Edit2, Landmark, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
// ✅ FIX: Removed Supabase imports - using API Gateway now
import { TierUpgradeModal } from './TierUpgradeModal';
import { BankAccountValidation } from './BankAccountValidation';
import { CenterProfileManager } from './CenterProfileManager';
import { FacilityManagement } from './FacilityManagement';
import { VendorPayoutRecords } from './VendorPayoutRecords';
import { useVendorCapabilities } from './hooks/useVendorCapabilities';

interface VendorPaymentSettingsProps {
  vendorId: string;
  vendorData?: any;
}

export function VendorPaymentSettings({ vendorId, vendorData }: VendorPaymentSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<any>(null);
  const [bankDetails, setBankDetails] = useState<any>({});
  const [earnings, setEarnings] = useState<any>({});
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCenterProfile, setShowCenterProfile] = useState(false);
  const [showFacilityManagement, setShowFacilityManagement] = useState(false);

  // 🔌 Load capabilities to determine if vendor has facility management
  const { capabilities } = useVendorCapabilities(vendorData?.roleId);
  const hasFacilityCapability = (capabilities as any).facility || capabilities.facility_management || false;

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      const [tierData, bankData, earningsData] = await Promise.allSettled([
        apiCallJson<any>(`${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/payment-tier`),
        apiCallJson<any>(`${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/bank-details`),
        apiCallJson<any>(`${API_GATEWAY_URL}/make-server-3dd53475/ecommerce/payments/vendor/${vendorId}/earnings`)
      ]);

      if (tierData.status === 'fulfilled' && tierData.value.success) {
        setTier(tierData.value.tier);
      }
      if (bankData.status === 'fulfilled' && bankData.value.success) {
        setBankDetails(bankData.value.bankDetails || {});
      }
      if (earningsData.status === 'fulfilled' && earningsData.value.success) {
        setEarnings(earningsData.value.earnings || { total: 0, pending: 0, paidOut: 0 });
      }
    } catch (error: any) {
      console.error('Error loading payment data:', error);
      toast.error(error?.message || 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleBankSaved = (data: any) => {
    setBankDetails(data);
    toast.success('Bank details verified and saved successfully!');
    loadData(); // Reload to get updated data
  };

  // ✅ If showing center profile manager
  if (showCenterProfile && vendorData) {
    return (
      <CenterProfileManager
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => setShowCenterProfile(false)}
      />
    );
  }

  // ✅ If showing facility management
  if (showFacilityManagement && vendorData) {
    return (
      <FacilityManagement
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => setShowFacilityManagement(false)}
      />
    );
  }

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

      {/* Tabs for Payment Settings and Bank Verification */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Crown className="w-4 h-4 mr-2" />
            Tier & Earnings
          </TabsTrigger>
          <TabsTrigger value="payouts">
            <Wallet className="w-4 h-4 mr-2" />
            Payout Records
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Landmark className="w-4 h-4 mr-2" />
            Bank Verification
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* ✅ NEW: Facility Management Section (Only for vendors with facility capability) */}
          {hasFacilityCapability && (
            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Center Profile & Facility</CardTitle>
                    <p className="text-sm text-gray-600">Manage your center details, timing, and specializations</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Configure your center profile with operating hours, specializations, amenities, and photos to attract more customers.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => setShowCenterProfile(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Center Profile
                  </Button>
                  <Button 
                    onClick={() => setShowFacilityManagement(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Facility Details
                  </Button>
                </div>
                <div className="bg-blue-100 border border-blue-200 rounded-lg p-3 mt-3">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Tip:</strong> Complete your center profile before adding services. This helps customers find and trust your business.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

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

            {/* Quick Bank Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Bank Account Status</CardTitle>
                    <p className="text-sm text-gray-600">Payout account verification</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankDetails.accountNumber ? (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md border border-green-200">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Bank details verified</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Account Holder</span>
                        <span className="font-medium">{bankDetails.accountHolderName}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Bank Name</span>
                        <span className="font-medium">{bankDetails.bankName || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">IFSC Code</span>
                        <span className="font-medium">{bankDetails.ifsc}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Account Number</span>
                        <span className="font-medium">****{bankDetails.accountNumber?.slice(-4)}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setActiveTab('bank')}
                    >
                      Update Bank Details
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Bank details not verified</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Complete bank verification to receive payouts directly to your account.
                    </p>
                    <Button 
                      className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]" 
                      onClick={() => setActiveTab('bank')}
                    >
                      <Landmark className="w-4 h-4 mr-2" />
                      Complete Bank Verification
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <VendorPayoutRecords vendorId={vendorId} />
        </TabsContent>

        <TabsContent value="bank" className="mt-6">
          <BankAccountValidation 
            vendorId={vendorId}
            initialData={{
              accountHolderName: bankDetails.accountHolderName,
              accountNumber: bankDetails.accountNumber,
              ifscCode: bankDetails.ifsc,
              bankName: bankDetails.bankName,
              branchName: bankDetails.branchName
            }}
            onSave={handleBankSaved}
          />
        </TabsContent>
      </Tabs>

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