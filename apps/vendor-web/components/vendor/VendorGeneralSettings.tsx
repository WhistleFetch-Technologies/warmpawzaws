'use client';

import { useState, useEffect } from 'react';
import { MapPin, Phone, User, Settings, Loader2, Save, Gift, Copy, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { hasVendorRole } from '@/lib/vendor-utils';

interface VendorGeneralSettingsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface EmergencyContact {
  name: string;
  phone: string;
}

interface VendorConfig {
  service_radius?: number; // in km
  emergency_contact?: EmergencyContact;
  max_dogs_per_walk?: number; // for walkers
  walk_durations?: string[]; // for walkers
  other_config?: Record<string, any>;
}

export function VendorGeneralSettings({ vendorId, vendorData, onBack }: VendorGeneralSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<VendorConfig>({
    service_radius: undefined,
    emergency_contact: { name: '', phone: '' },
    max_dogs_per_walk: undefined,
    walk_durations: [],
    other_config: {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isWalker = hasVendorRole(vendorData, 'walker');

  // Referral state
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralList, setReferralList] = useState<any[]>([]);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [sendingReferral, setSendingReferral] = useState(false);
  const [referralPhone, setReferralPhone] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Points and rewards state
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  // Load points and rewards when modal opens
  useEffect(() => {
    if (showReferralModal) {
      loadPointsAndRewards();
    }
  }, [showReferralModal, vendorId]);

  // Debug: Log when referralCode changes
  useEffect(() => {
    console.log('[REFERRAL] referralCode state changed to:', referralCode);
  }, [referralCode]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/vendor/${vendorId}/settings`) as any;
      
      if (response && response.success && response.settings) {
        setConfig({
          service_radius: response.settings.service_radius,
          emergency_contact: response.settings.emergency_contact || { name: '', phone: '' },
          max_dogs_per_walk: response.settings.max_dogs_per_walk,
          walk_durations: response.settings.walk_durations || [],
          other_config: response.settings.other_config || {},
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      // If 404, settings don't exist yet - that's fine
      if (error.status !== 404) {
        toast.error('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.emergency_contact) {
      if (!config.emergency_contact.name.trim()) {
        newErrors.emergency_contact_name = 'Emergency contact name is required';
      }
      if (!config.emergency_contact.phone.trim()) {
        newErrors.emergency_contact_phone = 'Emergency contact phone is required';
      } else if (!/^[6-9]\d{9}$/.test(config.emergency_contact.phone.replace(/\D/g, ''))) {
        newErrors.emergency_contact_phone = 'Invalid phone number (10 digits, starting with 6-9)';
      }
    }

    if (config.service_radius !== undefined && config.service_radius < 0) {
      newErrors.service_radius = 'Service radius must be positive';
    }

    if (isWalker) {
      if (config.max_dogs_per_walk !== undefined && config.max_dogs_per_walk < 1) {
        newErrors.max_dogs_per_walk = 'Must be at least 1';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.put(`/vendor/${vendorId}/settings`, {
        service_radius: config.service_radius,
        emergency_contact: config.emergency_contact,
        max_dogs_per_walk: config.max_dogs_per_walk,
        walk_durations: config.walk_durations,
        other_config: config.other_config,
      }) as any;

      if (response && response.success) {
        toast.success('Settings saved successfully!');
      } else {
        throw new Error(response?.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleWalkDurationToggle = (duration: string) => {
    setConfig(prev => ({
      ...prev,
      walk_durations: prev.walk_durations?.includes(duration)
        ? prev.walk_durations.filter(d => d !== duration)
        : [...(prev.walk_durations || []), duration],
    }));
  };

  const loadReferralData = async () => {
    try {
      setLoadingReferral(true);
      const [codeRes, listRes] = await Promise.all([
        apiClient.get(`/vendor/${vendorId}/referral`) as any,
        apiClient.get(`/vendor/${vendorId}/referral/list?limit=1000`) as any, // Fetch all referrals
      ]);

      console.log('[REFERRAL] Code response:', codeRes);
      console.log('[REFERRAL] Code response type:', typeof codeRes);
      console.log('[REFERRAL] Code response keys:', Object.keys(codeRes || {}));
      console.log('[REFERRAL] codeRes.success:', codeRes?.success);
      console.log('[REFERRAL] codeRes.referralCode:', codeRes?.referralCode);

      // Handle different response formats - be very explicit
      let referralCodeValue = '';
      
      // Try multiple ways to extract the code
      if (codeRes) {
        // Method 1: Standard response with success flag
        if (codeRes.success === true && codeRes.referralCode) {
          referralCodeValue = String(codeRes.referralCode).trim();
          console.log('[REFERRAL] ✅ Found code via success path:', referralCodeValue);
        }
        // Method 2: Direct referralCode property (even without success flag)
        else if (codeRes.referralCode && !referralCodeValue) {
          referralCodeValue = String(codeRes.referralCode).trim();
          console.log('[REFERRAL] ✅ Found code via direct path:', referralCodeValue);
        }
        // Method 3: Wrapped in data property
        else if (codeRes.data?.referralCode && !referralCodeValue) {
          referralCodeValue = String(codeRes.data.referralCode).trim();
          console.log('[REFERRAL] ✅ Found code via data path:', referralCodeValue);
        }
        // Method 4: Check for error
        else if (codeRes.error) {
          console.error('[REFERRAL] ❌ Error fetching code:', codeRes.error);
          toast.error(`Failed to load referral code: ${codeRes.error}`);
        }
        // Method 5: Log unexpected format
        else {
          console.warn('[REFERRAL] ⚠️ Unexpected response format:', JSON.stringify(codeRes, null, 2));
        }
      }

      // Set the state if we found a code
      if (referralCodeValue && referralCodeValue.length > 0) {
        console.log('[REFERRAL] ✅✅✅ Setting referral code state to:', referralCodeValue);
        console.log('[REFERRAL] Current referralCode state before update:', referralCode);
        setReferralCode(referralCodeValue);
        console.log('[REFERRAL] setReferralCode called with:', referralCodeValue);
      } else {
        console.warn('[REFERRAL] ❌❌❌ No referral code found in response');
        console.warn('[REFERRAL] Full response:', JSON.stringify(codeRes, null, 2));
        console.warn('[REFERRAL] codeRes type:', typeof codeRes);
        console.warn('[REFERRAL] codeRes.success:', codeRes?.success);
        console.warn('[REFERRAL] codeRes.referralCode:', codeRes?.referralCode);
        console.warn('[REFERRAL] codeRes.referralCode type:', typeof codeRes?.referralCode);
      }
      
      if (listRes?.success && listRes.referrals) {
        // Filter out placeholder referrals (REFERRER_* phone numbers)
        const realReferrals = listRes.referrals.filter((r: any) => 
          !r.referred_phone?.startsWith('REFERRER_')
        );
        setReferralList(realReferrals);
        console.log(`[REFERRAL] Loaded ${realReferrals.length} referrals (filtered from ${listRes.referrals.length} total)`);
      } else if (listRes?.referrals) {
        // Handle direct referrals array
        const realReferrals = listRes.referrals.filter((r: any) => 
          !r.referred_phone?.startsWith('REFERRER_')
        );
        setReferralList(realReferrals);
      } else if (listRes?.error) {
        console.error('[REFERRAL] Error fetching list:', listRes.error);
      }
    } catch (error: any) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoadingReferral(false);
    }
  };

  const handleCopyReferralCode = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast.success('Referral code copied to clipboard!');
    }
  };

  const handleSendReferral = async () => {
    if (!referralPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    const phoneDigits = referralPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSendingReferral(true);
      const response = await apiClient.post(`/vendor/${vendorId}/referral/send`, {
        phone: phoneDigits,
      }) as any;

      if (response?.success) {
        toast.success('Referral code sent successfully!');
        setReferralPhone('');
        loadReferralData(); // Refresh stats
      } else {
        throw new Error(response?.error || 'Failed to send referral code');
      }
    } catch (error: any) {
      console.error('Error sending referral:', error);
      toast.error(error.message || 'Failed to send referral code');
    } finally {
      setSendingReferral(false);
    }
  };

  const loadPointsAndRewards = async () => {
    try {
      setLoadingPoints(true);
      const rewardsResponse = await apiClient.get(`/vendor/${vendorId}/referral/rewards`) as any;
      
      if (rewardsResponse?.rewards && Array.isArray(rewardsResponse.rewards)) {
        // Calculate total points
        const totalPoints = rewardsResponse.rewards.reduce((sum: number, reward: any) => {
          return sum + (parseInt(reward.points) || 0);
        }, 0);
        
        setLoyaltyPoints(totalPoints);
        setPointsHistory(rewardsResponse.rewards);
      } else {
        setLoyaltyPoints(0);
        setPointsHistory([]);
      }
    } catch (error: any) {
      console.error('Error loading points and rewards:', error);
      setLoyaltyPoints(0);
      setPointsHistory([]);
    } finally {
      setLoadingPoints(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">General Settings</h2>
            <p className="text-sm text-gray-600 mt-1">Configure your service settings and preferences</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Service Radius */}
        <div>
          <Label htmlFor="service_radius" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Service Radius (km)
          </Label>
          <Input
            id="service_radius"
            type="number"
            value={config.service_radius || ''}
            onChange={(e) => setConfig({ ...config, service_radius: e.target.value ? parseFloat(e.target.value) : undefined })}
            placeholder="Enter service radius in kilometers"
            className={`mt-1 ${errors.service_radius ? 'border-red-500' : ''}`}
            min="0"
            step="0.1"
          />
          {errors.service_radius && (
            <p className="text-xs text-red-600 mt-1">{errors.service_radius}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Maximum distance you're willing to travel for service delivery
          </p>
        </div>

        {/* Emergency Contact */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Emergency Contact
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="emergency_contact_name" className="text-sm font-semibold text-gray-700">
                Contact Name *
              </Label>
              <Input
                id="emergency_contact_name"
                value={config.emergency_contact?.name || ''}
                onChange={(e) => setConfig({
                  ...config,
                  emergency_contact: { ...config.emergency_contact!, name: e.target.value },
                })}
                placeholder="Enter emergency contact name"
                className={`mt-1 ${errors.emergency_contact_name ? 'border-red-500' : ''}`}
              />
              {errors.emergency_contact_name && (
                <p className="text-xs text-red-600 mt-1">{errors.emergency_contact_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergency_contact_phone" className="text-sm font-semibold text-gray-700">
                Contact Phone *
              </Label>
              <Input
                id="emergency_contact_phone"
                type="tel"
                value={config.emergency_contact?.phone || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setConfig({
                    ...config,
                    emergency_contact: { ...config.emergency_contact!, phone: value },
                  });
                }}
                placeholder="Enter 10-digit phone number"
                className={`mt-1 ${errors.emergency_contact_phone ? 'border-red-500' : ''}`}
                maxLength={10}
              />
              {errors.emergency_contact_phone && (
                <p className="text-xs text-red-600 mt-1">{errors.emergency_contact_phone}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Emergency contact for safety and support purposes
              </p>
            </div>
          </div>
        </div>


        {/* Walker-Specific Settings */}
        {isWalker && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Walker Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="max_dogs_per_walk" className="text-sm font-semibold text-gray-700">
                  Maximum Dogs Per Walk
                </Label>
                <Input
                  id="max_dogs_per_walk"
                  type="number"
                  value={config.max_dogs_per_walk || ''}
                  onChange={(e) => setConfig({ ...config, max_dogs_per_walk: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Enter maximum number of dogs"
                  className={`mt-1 ${errors.max_dogs_per_walk ? 'border-red-500' : ''}`}
                  min="1"
                />
                {errors.max_dogs_per_walk && (
                  <p className="text-xs text-red-600 mt-1">{errors.max_dogs_per_walk}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of dogs you can walk simultaneously
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Walk Durations Offered
                </Label>
                <div className="flex flex-wrap gap-2">
                  {['15', '30', '45', '60', '90', '120'].map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => handleWalkDurationToggle(duration)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        config.walk_durations?.includes(duration)
                          ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42] font-semibold'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {duration} min
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select all walk durations you offer
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Referral Program Button */}
        <div className="border-t border-gray-200 pt-6">
          <Button
            onClick={() => {
              setShowReferralModal(true);
              loadReferralData();
            }}
            variant="outline"
            className="w-full border-2 border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
          >
            <Gift className="w-4 h-4 mr-2" />
            View Referral Program
          </Button>
        </div>

        {/* Save Button */}
        <div className="border-t border-gray-200 pt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Referral Program Modal */}
      <Dialog open={showReferralModal} onOpenChange={setShowReferralModal}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
          <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900">
                <div className="p-2 bg-orange-100 rounded-lg">
              <Gift className="w-6 h-6 text-[#FF8C42]" />
                </div>
              Referral Program
            </DialogTitle>
              <DialogDescription className="text-gray-600 mt-2">
              Refer other vendors and earn rewards when they join and get approved!
            </DialogDescription>
          </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingReferral ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
            </div>
          ) : (
              <div className="space-y-5">
                {/* Referral Code Section */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border-2 border-orange-200 shadow-sm">
                  <Label className="text-base font-semibold text-gray-800 mb-3 block">
                      Your Referral Code
                    </Label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-orange-300 font-mono text-lg font-bold text-[#FF8C42] tracking-wider shadow-sm">
                        {loadingReferral ? 'Loading...' : (referralCode || 'No code available')}
                      </div>
                  <Button
                    onClick={handleCopyReferralCode}
                    variant="outline"
                      size="lg"
                      className="border-2 border-orange-300 text-[#FF8C42] hover:bg-orange-50 font-semibold px-5 h-11 flex-shrink-0"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                  <p className="text-sm text-gray-700 mt-3 leading-relaxed">
                    Share this code with other vendors. You'll earn <span className="font-bold text-[#FF8C42]">200 points</span> when they join and get approved!
                </p>
              </div>

                {/* Send Referral Section */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <Label className="text-base font-semibold text-gray-800 mb-3 block">
                  Send Referral Code via SMS
                </Label>
                  <div className="flex gap-3">
                  <Input
                    type="tel"
                    value={referralPhone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setReferralPhone(value);
                    }}
                    placeholder="Enter 10-digit phone number"
                      className="flex-1 h-11 text-base"
                    maxLength={10}
                  />
                  <Button
                    onClick={handleSendReferral}
                    disabled={sendingReferral || !referralPhone.trim()}
                      size="lg"
                      className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold px-5 h-11 flex-shrink-0"
                  >
                    {sendingReferral ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>

                {/* Referral List Section */}
                <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="flex-shrink-0 p-4 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                    <h4 className="text-base font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-1.5 bg-[#FF8C42] rounded-lg">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      All Referrals Sent
                      <span className="ml-auto px-3 py-1 bg-[#FF8C42] text-white text-sm font-bold rounded-full">
                        {referralList.length}
                      </span>
                  </h4>
                </div>
                {referralList.length > 0 ? (
                    <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr className="border-b-2 border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              Sent
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              Applied
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              Approved
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {referralList.map((referral: any, index: number) => {
                            const vendorName = referral.referred_vendor_name?.trim() || null;
                            const displayName = vendorName || 'Unknown Vendor';
                            
                            const formatDate = (dateString: string) => {
                              if (!dateString) return '-';
                              return new Date(dateString).toLocaleDateString('en-IN', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                            };
                            
                            const sentDate = formatDate(referral.created_at);
                            const appliedDate = formatDate(referral.applied_at);
                            const approvedDate = formatDate(referral.approved_at);

                            return (
                              <tr 
                                key={referral.id} 
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs">
                                  <div className="truncate" title={displayName}>
                                    {displayName}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {sentDate}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600">
                                  {appliedDate}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                                  {approvedDate}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                                    referral.status === 'approved' 
                                      ? 'bg-green-50 text-green-800 border-green-300'
                                      : referral.status === 'applied'
                                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                                      : 'bg-yellow-50 text-yellow-800 border-yellow-300'
                                  }`}>
                                    {referral.status === 'approved' ? (
                                      <>
                                        <span className="text-green-600">✓</span>
                                        Approved
                                      </>
                                    ) : referral.status === 'applied' ? (
                                      <>
                                        <span className="text-blue-600">→</span>
                                        Applied
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-yellow-600">⏳</span>
                                        Pending
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                        <Gift className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">No referrals sent yet</p>
                      <p className="text-xs text-gray-500">Start referring vendors to earn rewards!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Points & Rewards Section */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#FF8C42]" />
                Points & Rewards
              </h3>
              
              {loadingPoints ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
                  <span className="ml-2 text-gray-600">Loading points...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Points Summary - Single Card */}
                  <div className="flex justify-center">
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border-2 border-orange-200 w-full max-w-md">
                      <p className="text-sm text-gray-600 mb-1 text-center">Loyalty Points</p>
                      <p className="text-4xl font-bold text-[#FF8C42] text-center">{loyaltyPoints.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-2 text-center">100 points = ₹1</p>
                    </div>
                  </div>

                  {/* Points History */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Rewards History</h4>
                    {pointsHistory.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pointsHistory.map((reward: any, index: number) => (
                          <div key={reward.id || index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                                  {reward.referred_vendor_name || reward.referral_code || reward.description || 'Referral Reward'}
                              </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {reward.created_at ? new Date(reward.created_at).toLocaleDateString('en-IN', {
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                  }) : 'N/A'}
                              </p>
                            </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-green-600">+{reward.points || 0} pts</p>
                                <p className="text-xs text-gray-500">₹{((reward.points || 0) / 100).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-500">No points earned yet</p>
                        <p className="text-xs text-gray-400 mt-1">Earn points when your referrals get approved!</p>
                  </div>
                )}
              </div>
            </div>
          )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
