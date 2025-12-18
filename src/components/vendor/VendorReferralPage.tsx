import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Coins, Share2, Copy, Users, Check, ChevronRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorReferralPageProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorReferralPage({ vendorId, onBack }: VendorReferralPageProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadLoyaltyProfile();
  }, [vendorId]);

  const loadLoyaltyProfile = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/loyalty/profile/${vendorId}?type=vendor`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      const data = await response.json();
      setProfile(data.profile);
    } catch (error) {
      console.error('Error loading loyalty profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (profile?.referralCode) {
      navigator.clipboard.writeText(profile.referralCode);
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareReferral = async () => {
    if (navigator.share && profile) {
      try {
        await navigator.share({
          title: 'Join Warmpawz as a Vendor!',
          text: `Use my code ${profile.referralCode} to join Warmpawz and get exclusive bonuses!`,
          url: 'https://warmpawz.com/vendor/join'
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-orange-500 text-white p-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            {onBack && (
              <Button onClick={onBack} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
            )}
            <h1 className="text-xl font-bold">Referral & Rewards</h1>
          </div>
          
          <div className="flex flex-col items-center text-center mt-2">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border-4 border-white/30 shadow-inner">
              <Coins className="w-10 h-10 text-yellow-100" />
            </div>
            <h2 className="text-3xl font-bold mb-1">{profile?.pointsBalance || 0}</h2>
            <p className="text-purple-100 font-medium text-sm">Reward Points</p>
            <div className="mt-2 text-xs bg-black/20 px-3 py-1 rounded-full">
              Reduce your payout adjustments
            </div>
          </div>
        </div>
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-10 translate-y-10"></div>
      </div>

      <div className="px-4 -mt-8 relative z-20">
        {/* Referral Card */}
        <Card className="p-6 shadow-xl border-0 bg-white rounded-2xl mb-6">
          <h3 className="text-center text-gray-800 font-bold text-lg mb-2">Grow Your Network</h3>
          <p className="text-center text-gray-500 text-sm mb-6">
            Refer other vendors and customers to earn rewards!
          </p>

          <div className="flex items-center gap-3 bg-gray-50 border border-dashed border-gray-300 p-3 rounded-xl mb-4">
            <div className="flex-1 text-center font-mono text-xl font-bold tracking-wider text-gray-800">
              {profile?.referralCode || 'LOADING...'}
            </div>
            <Button onClick={copyToClipboard}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-500" />}
            </Button>
          </div>

          <Button 
            onClick={shareReferral}
            className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600 text-white shadow-md py-6 rounded-xl text-lg"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share Code
          </Button>
        </Card>

        {/* Earning Opportunities */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-4 px-2">Earning Opportunities</h3>
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-xl flex items-center gap-4 shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">Refer a Vendor</h4>
                <p className="text-xs text-gray-500">When they join & complete first booking</p>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                <Coins className="w-3 h-3 text-yellow-600" />
                <span className="text-xs font-bold text-yellow-700">+200</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl flex items-center gap-4 shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">Refer a Customer</h4>
                <p className="text-xs text-gray-500">Existing customer signs up & books</p>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                <Coins className="w-3 h-3 text-yellow-600" />
                <span className="text-xs font-bold text-yellow-700">+500</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl flex items-center gap-4 shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                ⭐
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">Go Premium</h4>
                <p className="text-xs text-gray-500">Upgrade to premium subscription</p>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                <Coins className="w-3 h-3 text-yellow-600" />
                <span className="text-xs font-bold text-yellow-700">+1000</span>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-4 px-2">Rewards History</h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {profile?.history && profile.history.length > 0 ? (
              <div>
                {profile.history.slice(0, 5).map((txn: any) => (
                  <div key={txn.id} className="p-4 border-b border-gray-50 last:border-0 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-gray-800">{txn.description}</p>
                      <p className="text-xs text-gray-400">{new Date(txn.timestamp).toLocaleDateString()}</p>
                    </div>
                    <span className={`font-bold text-sm ${txn.type === 'earned' ? 'text-green-600' : 'text-red-500'}`}>
                      {txn.type === 'earned' ? '+' : '-'}{txn.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                No rewards yet. Start referring!
              </div>
            )}
          </div>
        </div>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-200">
          <p className="text-sm text-gray-700 text-center">
            <strong>💡 Pro Tip:</strong> Points earned reduce your next payout settlement by the equivalent amount (1 point = ₹1 adjustment).
          </p>
        </Card>
      </div>
    </div>
  );
}
