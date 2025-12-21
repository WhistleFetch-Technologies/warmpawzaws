import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, DollarSign, TrendingUp, Users, Calendar, Target, CheckCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface Campaign {
  id: string;
  name: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  donationCount: number;
}

interface DonationCampaignViewProps {
  vendorId: string;
  vendorName?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export function DonationCampaignView({ 
  vendorId, 
  vendorName, 
  customerId, 
  customerName, 
  customerPhone, 
  onBack, 
  onSuccess 
}: DonationCampaignViewProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCampaigns();
  }, [vendorId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/donations/${vendorId}/campaigns`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const campaignsList = data.campaigns || data.data?.campaigns || [];
        setCampaigns(campaignsList);
        console.log('✅ Loaded donation campaigns:', campaignsList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load campaigns:', errorData);
        setCampaigns([]);
      }
    } catch (error: any) {
      console.error('Error loading campaigns:', error);
      const errorMessage = error?.message || 'Failed to load donation campaigns';
      toast.error(errorMessage);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async () => {
    if (!selectedCampaign) return;
    
    const amount = parseFloat(donationAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    if (!customerId || !customerName || !customerPhone) {
      toast.error('Customer information is required');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_BASE}/customer/donations/${vendorId}/contribute`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            campaignId: selectedCampaign.id,
            customerId,
            customerName,
            customerPhone,
            amount,
            paymentMethod: 'online', // TODO: Integrate with payment gateway
            message: donationMessage
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success(`Thank you for your donation of ₹${amount}!`);
          setShowDonationForm(false);
          setSelectedCampaign(null);
          setDonationAmount('');
          setDonationMessage('');
          await loadCampaigns(); // Reload to update raised amount
          if (onSuccess) onSuccess();
        } else {
          const errorMessage = data.error || data.message || 'Failed to process donation';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to process donation';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error processing donation:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const progressPercentage = (campaign: Campaign) => {
    if (campaign.goalAmount === 0) return 0;
    return Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (showDonationForm && selectedCampaign) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <button 
              onClick={() => {
                setShowDonationForm(false);
                setSelectedCampaign(null);
              }} 
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-lg">Make a Donation</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Campaign Info */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h2 className="font-semibold text-lg mb-2">{selectedCampaign.name}</h2>
            <p className="text-sm text-gray-600">{selectedCampaign.description}</p>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Raised</span>
                <span className="font-semibold">₹{selectedCampaign.raisedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Goal</span>
                <span className="font-semibold">₹{selectedCampaign.goalAmount.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-pink-500 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercentage(selectedCampaign)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Donation Form */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
            <div>
              <Label htmlFor="amount">Donation Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div>
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                value={donationMessage}
                onChange={(e) => setDonationMessage(e.target.value)}
                placeholder="Add a message with your donation..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleDonate}
              disabled={submitting || !donationAmount}
              className="w-full bg-pink-500 hover:bg-pink-600"
              size="lg"
            >
              {submitting ? 'Processing...' : `Donate ₹${donationAmount || '0'}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Donation Campaigns</h1>
            {vendorName && <p className="text-sm text-gray-600">{vendorName}</p>}
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="p-4 space-y-3">
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No active campaigns</p>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-white rounded-xl p-4 border border-gray-200"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{campaign.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Raised</span>
                    <span className="font-semibold text-pink-600">
                      ₹{campaign.raisedAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Goal</span>
                    <span className="font-semibold">
                      ₹{campaign.goalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-pink-500 h-2 rounded-full transition-all"
                      style={{ width: `${progressPercentage(campaign)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {progressPercentage(campaign).toFixed(1)}% funded
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{campaign.donationCount} donations</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Ends {formatDate(campaign.endDate)}</span>
                  </div>
                </div>

                {/* Donate Button */}
                <Button
                  onClick={() => {
                    setSelectedCampaign(campaign);
                    setShowDonationForm(true);
                  }}
                  className="w-full bg-pink-500 hover:bg-pink-600"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Donate Now
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

