"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Users, Gift, Copy, CheckCircle2, GiftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileAccountScreenHeader } from '@/components/customer/shared/ProfileAccountScreenHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ReferralSystemPageProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onCloseToHome?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

interface ReferralStats {
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  total_rewards: number;
  referral_code: string;
}

/** Clipboard API + execCommand fallback (Android WebView / older Chrome). */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Android intent URLs are length-sensitive; keep extras under a safe budget. */
const ANDROID_INTENT_TEXT_MAX = 4000;

type WebSharePayload = Pick<ShareData, 'title' | 'text' | 'url'>;

function isNonEmptyWebShareData(data: WebSharePayload): boolean {
  return !!(data.text?.trim() || data.url?.trim() || data.title?.trim());
}

/**
 * Try Web Share with payloads that match iOS/Android system sheets.
 * We always call `navigator.share` when a payload has text/url (do not trust `canShare` alone —
 * Android Chrome often reports false for valid payloads, so the sheet never opened).
 */
async function invokeWebShare(
  payloads: WebSharePayload[]
): Promise<'shared' | 'aborted' | 'failed'> {
  if (typeof navigator.share !== 'function') return 'failed';
  for (const data of payloads) {
    if (!isNonEmptyWebShareData(data)) continue;
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'aborted';
    }
  }
  return 'failed';
}

function triggerAndroidSendIntent(shareTitle: string, textPayload: string) {
  const intent =
    'intent:#Intent;action=android.intent.action.SEND;type=text/plain;' +
    `S.android.intent.extra.TEXT=${encodeURIComponent(textPayload)};` +
    `S.android.intent.extra.SUBJECT=${encodeURIComponent(shareTitle)};end`;
  try {
    const a = document.createElement('a');
    a.href = intent;
    a.rel = 'noreferrer';
    a.style.position = 'fixed';
    a.style.width = '0';
    a.style.height = '0';
    a.style.left = '-9999px';
    a.setAttribute('data-intent', '1');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // fall through
  }
  try {
    window.location.href = intent;
  } catch {
    // ignore
  }
}

export function ReferralSystemPage(props: ReferralSystemPageProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadReferralData();
    } else {
      setLoading(false);
    }
  }, [phone]);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/${phone}/referrals`);
      setStats(response.stats || response || {
        total_referrals: 0,
        successful_referrals: 0,
        pending_referrals: 0,
        total_rewards: 0,
        referral_code: phone?.slice(-6).toUpperCase() || 'REF123',
      });
    } catch (error: any) {
      console.error('Error loading referral data:', error);
      // Set default stats if API fails
      setStats({
        total_referrals: 0,
        successful_referrals: 0,
        pending_referrals: 0,
        total_rewards: 0,
        referral_code: phone?.slice(-6).toUpperCase() || 'REF123',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (!stats?.referral_code) return;
    const ok = await copyTextToClipboard(stats.referral_code);
    if (ok) {
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy automatically. Long-press the code to copy it.');
    }
  };

  const shareReferral = async () => {
    if (!stats?.referral_code) return;

    const shareTitle = 'Join Warmpawz';
    const code = stats.referral_code;
    const referralLink = `${window.location.origin}/auth?ref=${encodeURIComponent(code)}`;
    const shareLine = `Join Warmpawz and get amazing pet care services! Use my referral code: ${code}`;
    const combinedBody = `${shareLine}\n${referralLink}`;
    const isAndroid = /Android/i.test(navigator.userAgent);

    const textPayloadForIntent =
      combinedBody.length > ANDROID_INTENT_TEXT_MAX
        ? `${combinedBody.slice(0, ANDROID_INTENT_TEXT_MAX - 20)}…`
        : combinedBody;

    // Android: prefer a single `text` payload first (most reliable with Web Share on Chrome);
    // iOS is fine with title + text + url.
    const sharePayloads: WebSharePayload[] = isAndroid
      ? [
          { text: combinedBody },
          { title: shareTitle, text: shareLine, url: referralLink },
          { title: shareTitle, text: combinedBody },
          { title: shareTitle, url: referralLink },
          { text: `${shareLine} ${referralLink}` },
        ]
      : [
          { title: shareTitle, text: shareLine, url: referralLink },
          { title: shareTitle, text: combinedBody },
          { title: shareTitle, url: referralLink },
          { text: combinedBody },
          { text: `${shareLine} ${referralLink}` },
        ];

    const shareResult = await invokeWebShare(sharePayloads);
    if (shareResult === 'shared' || shareResult === 'aborted') return;

    // Web Share often missing or blocked in in-app WebViews; try SEND chooser via intent.
    if (isAndroid) {
      triggerAndroidSendIntent(shareTitle, textPayloadForIntent);
    }

    const copied = await copyTextToClipboard(combinedBody);
    if (copied) {
      toast.success('Referral message and link copied — paste into your chat or email.');
      return;
    }

    if (isAndroid) {
      // Clipboard after `await` often fails without a fresh user gesture; offer an explicit action.
      toast.info('Could not open share or copy automatically.', {
        description: 'Tap Copy below, then paste into WhatsApp, SMS, or email.',
        action: {
          label: 'Copy message & link',
          onClick: () => {
            void copyTextToClipboard(combinedBody).then((ok) => {
              if (ok) {
                toast.success('Copied! Paste to share with friends.');
              } else {
                toast.error('Copy failed. Long-press the referral link in your browser address bar, or type the code for friends to enter at sign-up.');
              }
            });
          },
        },
      });
      return;
    }

    toast.error('Could not share or copy. Use the copy button next to your referral code.');
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          {props.onCloseToHome ? (
            <ProfileAccountScreenHeader
              onCloseToHome={props.onCloseToHome}
              onBack={props.onBack}
              title="Referral Program"
              className="mb-6"
            />
          ) : (
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold">Referral Program</h1>
            </div>
          )}
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to access referral program</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {props.onCloseToHome ? (
          <ProfileAccountScreenHeader
            onCloseToHome={props.onCloseToHome}
            onBack={props.onBack}
            title="Referral Program"
            className="sticky top-0 z-10"
          />
        ) : (
          <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-white/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold text-white">Referral Program</h1>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Referral Code Card */}
          <Card className="p-6 bg-gradient-to-br from-[#FF8C42] to-[#FF6B9D] text-white">
            <div className="text-center mb-4">
              <GiftIcon className="w-12 h-12 mx-auto mb-3" />
              <h2 className="text-xl font-bold mb-2">Your Referral Code</h2>
              <div className="flex items-center justify-center gap-3 mb-4">
                <code className="text-3xl font-bold bg-white/20 px-4 py-2 rounded-lg">
                  {stats?.referral_code || 'REF123'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyReferralCode}
                  className="text-white hover:bg-white/20"
                >
                  {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <Button
                onClick={shareReferral}
                className="w-full bg-white text-[#FF8C42] hover:bg-gray-100"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Referral Link
              </Button>
            </div>
          </Card>

          {/* Stats */}
          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 text-center">
                  <Users className="w-8 h-8 text-[#FF8C42] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_referrals || 0}</p>
                  <p className="text-xs text-gray-500">Total Referrals</p>
                </Card>
                <Card className="p-4 text-center">
                  <Gift className="w-8 h-8 text-[#FF6B9D] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">₹{stats?.total_rewards || 0}</p>
                  <p className="text-xs text-gray-500">Total Rewards</p>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</div>
                    <p>Share your referral code with friends and family</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</div>
                    <p>They sign up using your code and make their first booking</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</div>
                    <p>You both earn rewards! ₹100 for you, ₹50 for them</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">Referral Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Successful Referrals</span>
                    <Badge className="bg-green-100 text-green-700">{stats?.successful_referrals || 0}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending Referrals</span>
                    <Badge className="bg-amber-100 text-amber-700">{stats?.pending_referrals || 0}</Badge>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
