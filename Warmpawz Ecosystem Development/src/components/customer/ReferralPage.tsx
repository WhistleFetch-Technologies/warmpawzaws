/**
 * Referral Program Page - Invite friends and earn rewards
 */

import { useState, useEffect } from 'react';
import { Share2, Copy, Check, Gift, Users, TrendingUp, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { mockCustomerAPI } from '../../lib/mockAPI';
import { toast } from 'sonner';

export function ReferralPage() {
  const [referralCode, setReferralCode] = useState('WARM123');
  const [copiedCode, setCopiedCode] = useState(false);
  const [referralStats, setReferralStats] = useState({
    totalReferred: 12,
    successfulSignups: 8,
    pointsEarned: 800,
    pendingRewards: 400
  });

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    // Mock referral data
    // In real app, fetch from mockCustomerAPI
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    toast.success('Referral code copied to clipboard!');
    
    setTimeout(() => {
      setCopiedCode(false);
    }, 2000);
  };

  const shareReferral = (platform: string) => {
    const message = `Join Warmpawz and get 50% off on your first booking! Use my referral code: ${referralCode}`;
    const url = `https://warmpawz.com/signup?ref=${referralCode}`;
    
    let shareUrl = '';
    
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message + ' ' + url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
        break;
    }
    
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <Gift className="w-20 h-20 mx-auto mb-6" />
            <h1 className="text-5xl font-bold mb-4">
              Refer & Earn Rewards!
            </h1>
            <p className="text-2xl opacity-90 mb-8">
              Invite your friends and both of you get ₹150 worth of rewards
            </p>
            
            {/* Referral Code Card */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
              <CardContent className="p-8">
                <p className="text-white/80 mb-3 text-lg">Your Referral Code</p>
                <div className="flex items-center gap-3 max-w-md mx-auto">
                  <div className="flex-1 bg-white rounded-lg px-6 py-4">
                    <div className="font-mono text-3xl font-bold text-orange-600">
                      {referralCode}
                    </div>
                  </div>
                  <Button
                    size="lg"
                    onClick={copyReferralCode}
                    className="bg-white text-orange-600 hover:bg-gray-100 gap-2"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-5 h-5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-3" />
              <div className="text-4xl font-bold mb-1">{referralStats.totalReferred}</div>
              <div className="text-sm opacity-90">Friends Invited</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardContent className="p-6 text-center">
              <Star className="w-8 h-8 mx-auto mb-3" />
              <div className="text-4xl font-bold mb-1">{referralStats.successfulSignups}</div>
              <div className="text-sm opacity-90">Successful Signups</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-3" />
              <div className="text-4xl font-bold mb-1">₹{referralStats.pointsEarned}</div>
              <div className="text-sm opacity-90">Total Earned</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <CardContent className="p-6 text-center">
              <Gift className="w-8 h-8 mx-auto mb-3" />
              <div className="text-4xl font-bold mb-1">₹{referralStats.pendingRewards}</div>
              <div className="text-sm opacity-90">Pending Rewards</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Share on Social Media */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Share2 className="w-6 h-6 text-orange-600" />
                <h2 className="text-xl font-bold">Share on Social Media</h2>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => shareReferral('whatsapp')}
                  className="w-full bg-green-500 hover:bg-green-600 gap-3 h-12"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Share on WhatsApp
                </Button>

                <Button
                  onClick={() => shareReferral('facebook')}
                  className="w-full bg-blue-600 hover:bg-blue-700 gap-3 h-12"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Share on Facebook
                </Button>

                <Button
                  onClick={() => shareReferral('twitter')}
                  className="w-full bg-sky-500 hover:bg-sky-600 gap-3 h-12"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                  Share on Twitter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-6">How It Works</h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Share Your Code</h3>
                    <p className="text-sm text-gray-600">
                      Invite your friends using your unique referral code
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xl">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">They Sign Up</h3>
                    <p className="text-sm text-gray-600">
                      Your friend signs up and gets ₹150 welcome bonus
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">You Both Win!</h3>
                    <p className="text-sm text-gray-600">
                      After their first booking, you get ₹150 reward points
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 font-medium">
                  💡 Tip: The more friends you refer, the more you earn! There's no limit.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Referrals */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-6">Recent Referrals</h2>
            
            <div className="space-y-4">
              {[
                { name: 'Priya Sharma', date: '2 days ago', status: 'completed', points: 150 },
                { name: 'Rahul Verma', date: '5 days ago', status: 'pending', points: 0 },
                { name: 'Anjali Mehta', date: '1 week ago', status: 'completed', points: 150 },
                { name: 'Vikram Singh', date: '2 weeks ago', status: 'completed', points: 150 }
              ].map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                      {referral.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{referral.name}</p>
                      <p className="text-sm text-gray-500">{referral.date}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {referral.status === 'completed' ? (
                      <>
                        <Badge className="bg-green-500 mb-1">Completed</Badge>
                        <p className="text-sm font-semibold text-green-600">
                          +₹{referral.points} earned
                        </p>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-yellow-500">Pending</Badge>
                        <p className="text-xs text-gray-500">
                          Awaiting first booking
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {referralStats.totalReferred === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">You haven't referred anyone yet</p>
                <Button
                  onClick={() => shareReferral('whatsapp')}
                  className="bg-gradient-to-r from-orange-500 to-pink-500"
                >
                  Start Referring Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
