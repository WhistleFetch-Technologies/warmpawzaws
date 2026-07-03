'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  buildWhatsNewAnnouncements,
  navigateWhatsNewFromFullPage,
  type WhatsNewAnnouncement,
} from '@/lib/whats-new-announcements';
import { filterWhatsNewAnnouncementsForReviewAccount } from '@/lib/app-review-demo-account';

// Fix: dynamically import to avoid reference errors in certain static bundling orders
const WhatsNewAnnouncementList = dynamic(
  () =>
    import('@/components/customer/whats-new/WhatsNewAnnouncementList').then(
      (m) => m.WhatsNewAnnouncementList
    ),
  { ssr: false }
);
const AIChatbotWidget = dynamic(
  () => import('@/components/customer/AIChatbotWidget').then((m) => ({ default: m.AIChatbotWidget })),
  { ssr: false }
);
import { ArrowLeft, Sparkles, Loader2, AlertCircle } from 'lucide-react';

export default function WhatsNewHubPage() {
  const router = useRouter();
  const [items, setItems] = useState<WhatsNewAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [phone, setPhone] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<{ announcements?: any[] }>('/customer/announcements?limit=50');
        const raw = Array.isArray(res?.announcements) ? res.announcements : [];
        if (!cancelled) setItems(buildWhatsNewAnnouncements(raw));
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not load What’s New');
          setItems(buildWhatsNewAnnouncements([]));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone ?? undefined);
  }, []);

  const visibleItems = useMemo(
    () => filterWhatsNewAnnouncementsForReviewAccount(items, phone),
    [items, phone]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/40 via-white to-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-orange-100 cw-header-safe-top">
        <div className="max-w-customer mx-auto flex items-center gap-3 pb-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-orange-50 active:bg-orange-100"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42] shrink-0" />
              What&apos;s New
            </h1>
            <p className="text-xs text-slate-500 truncate">Updates, tips, and highlights for you</p>
          </div>
        </div>
      </header>

      <main className="max-w-customer mx-auto px-4 py-5 pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42]" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-white border border-amber-100 mb-4">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-amber-400" />
            <p className="text-slate-600 text-sm">{error}</p>
            <p className="text-slate-400 text-xs mt-2">Showing defaults below.</p>
          </div>
        ) : null}

        {!loading && (
          <WhatsNewAnnouncementList
            announcements={visibleItems}
            interactionMode="hub"
            onRowPress={(a) => {
              if (a.announcementType === 'emergency') return;
              // Match Home behavior: AI Pet Assistant opens AI assistant widget.
              if (a.id === 'ai' || (a.announcementType === 'feature' && !a.ctaLink?.trim())) {
                setShowAIChat(true);
                return;
              }
              navigateWhatsNewFromFullPage(router, a, 'row');
            }}
            onSosPress={(a) => {
              if (a.comingSoon && a.announcementType === 'emergency') return;
              navigateWhatsNewFromFullPage(router, a, 'sos');
            }}
          />
        )}
      </main>
      {showAIChat && (
        <AIChatbotWidget
          customerPhone={phone}
          onClose={() => setShowAIChat(false)}
          onNavigate={(dest) => {
            if (typeof dest === 'string' && dest.startsWith('/')) {
              setShowAIChat(false);
              router.push(dest);
            }
          }}
        />
      )}
    </div>
  );
}
