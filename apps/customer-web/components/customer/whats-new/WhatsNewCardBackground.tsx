'use client';

import { Crown, MapPin, PawPrint, Route, Sparkles } from 'lucide-react';
import type { WhatsNewAnnouncement } from '@/lib/whats-new-announcements';

export function WhatsNewCardBackground({ announcement }: { announcement: WhatsNewAnnouncement }) {
  const isEmergency = announcement.announcementType === 'emergency';
  const isPremium = announcement.announcementType === 'premium';
  const isArticles = announcement.announcementType === 'articles';
  const isFeature = announcement.announcementType === 'feature' || announcement.id === 'ai';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
      {isFeature ? (
        <>
          <Sparkles className="absolute right-6 top-2 h-16 w-16 text-orange-300/35" strokeWidth={1.25} />
          <Sparkles className="absolute right-20 top-8 h-9 w-9 text-orange-200/30" strokeWidth={1.25} />
          <Sparkles className="absolute right-10 bottom-2 h-11 w-11 text-pink-200/25" strokeWidth={1.25} />
        </>
      ) : null}

      {isEmergency ? (
        <>
          <MapPin className="absolute right-8 top-1/2 h-20 w-20 -translate-y-1/2 text-amber-300/30" strokeWidth={1.25} />
          <Route className="absolute right-2 bottom-1 h-14 w-14 text-orange-200/25" strokeWidth={1.25} />
        </>
      ) : null}

      {isPremium ? (
        <Crown className="absolute right-6 top-1/2 h-[5.5rem] w-[5.5rem] -translate-y-1/2 text-purple-300/30" strokeWidth={1.25} />
      ) : null}

      {isArticles ? (
        <>
          <PawPrint className="absolute right-8 top-1/2 h-20 w-20 -translate-y-1/2 text-teal-300/30" strokeWidth={1.25} />
          <PawPrint className="absolute right-24 top-4 h-8 w-8 text-cyan-200/25" strokeWidth={1.25} />
        </>
      ) : null}
    </div>
  );
}
