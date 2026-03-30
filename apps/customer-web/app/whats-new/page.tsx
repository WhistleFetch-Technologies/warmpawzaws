'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  buildWhatsNewAnnouncements,
  navigateWhatsNewFromFullPage,
  type WhatsNewAnnouncement,
} from '@/lib/whats-new-announcements';

// Fix: dynamically import to avoid reference errors in certain static bundling orders
const WhatsNewAnnouncementList = dynamic(
  () =>
    import('@/components/customer/whats-new/WhatsNewAnnouncementList').then(
      (m) => m.WhatsNewAnnouncementList
    ),
  { ssr: false }
);
import { ArrowLeft, Sparkles, Loader2, AlertCircle } from 'lucide-react';

export default function WhatsNewHubPage() {
  const router = useRouter();
  const [items, setItems] = useState<WhatsNewAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/40 via-white to-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-orange-100">
        <div className="max-w-customer mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="p-2 rounded-full hover:bg-orange-50 text-slate-600"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
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
            announcements={items}
            interactionMode="hub"
            onRowPress={(a) => navigateWhatsNewFromFullPage(router, a, 'row')}
            onSosPress={(a) => navigateWhatsNewFromFullPage(router, a, 'sos')}
          />
        )}
      </main>
    </div>
  );
}
