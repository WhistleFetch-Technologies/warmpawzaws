'use client';

import { ChevronRight } from 'lucide-react';
import { getWhatsNewIconImage, type WhatsNewAnnouncement } from '@/lib/whats-new-announcements';
import { WhatsNewCardBackground } from './WhatsNewCardBackground';

interface WhatsNewAnnouncementListProps {
  announcements: WhatsNewAnnouncement[];
  /** Non-emergency row tap (home: only if ctaLink set). */
  onRowPress?: (announcement: WhatsNewAnnouncement) => void;
  onSosPress?: (announcement: WhatsNewAnnouncement) => void;
  className?: string;
  /** `hub`: full list page — premium row opens subscriptions even without ctaLink. */
  interactionMode?: 'home' | 'hub';
}

export function WhatsNewAnnouncementList({
  announcements,
  onRowPress,
  onSosPress,
  className = '',
  interactionMode = 'home',
}: WhatsNewAnnouncementListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {announcements.map((announcement) => {
        const isEmergency = announcement.announcementType === 'emergency';
        const emergencySoon = isEmergency && announcement.comingSoon;
        const isPremium = announcement.announcementType === 'premium';
        const premiumSoon = isPremium && announcement.comingSoon;
        const isArticles = announcement.announcementType === 'articles';
        const bgGradient = emergencySoon
          ? 'from-stone-50 to-orange-50/40 border-amber-100'
          : premiumSoon
            ? 'from-stone-50 to-purple-50/35 border-amber-100'
            : isEmergency
          ? 'from-red-50 to-orange-50 border-red-100'
          : isPremium
            ? 'from-purple-50 to-indigo-50 border-purple-100'
            : isArticles
              ? 'from-teal-50 to-cyan-50 border-teal-100'
              : 'from-orange-50 to-pink-50 border-orange-100';
        const badgeColor =
          announcement.badgeColor === 'red'
            ? 'bg-red-500'
            : announcement.badgeColor === 'amber'
              ? 'bg-amber-500'
              : announcement.badgeColor === 'purple'
                ? 'bg-purple-500'
                : announcement.badgeColor === 'blue'
                  ? 'bg-blue-500'
                  : announcement.badgeColor === 'teal'
                    ? 'bg-teal-600'
                    : 'bg-green-500';
        const iconImage = getWhatsNewIconImage(announcement);

        const hubPremium = interactionMode === 'hub' && announcement.announcementType === 'premium';
        const hubFeature = interactionMode === 'hub' && (announcement.announcementType === 'feature' || announcement.id === 'ai');
        const rowClickable =
          !isEmergency &&
          !premiumSoon &&
          !!onRowPress &&
          (!!announcement.ctaLink || hubPremium || hubFeature);

        return (
          <div
            key={announcement.id}
            role={rowClickable ? 'button' : undefined}
            tabIndex={rowClickable ? 0 : undefined}
            className={`relative overflow-hidden bg-gradient-to-r ${bgGradient} rounded-2xl p-4 border flex items-center gap-4 ${
              rowClickable ? 'cursor-pointer' : ''
            }`}
            onClick={() => {
              if (rowClickable) onRowPress!(announcement);
            }}
            onKeyDown={(e) => {
              if (rowClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowPress!(announcement);
              }
            }}
          >
            <WhatsNewCardBackground announcement={announcement} />
            <div
              className={`relative z-[1] flex h-16 w-16 flex-shrink-0 items-center justify-center ${
                isEmergency && !emergencySoon ? 'animate-pulse' : ''
              }`}
            >
              {iconImage ? (
                <img
                  src={iconImage}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : announcement.icon ? (
                <span className="text-2xl">{announcement.icon}</span>
              ) : null}
            </div>
            <div className="relative z-[1] flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs ${badgeColor} text-white px-2 py-0.5 rounded-full font-medium ${
                    isEmergency && !emergencySoon ? 'font-bold animate-pulse' : ''
                  }`}
                >
                  {announcement.badgeText || 'NEW'}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{announcement.title}</h3>
              <p className="text-xs text-gray-600">{announcement.subtitle}</p>
            </div>
            {isEmergency && announcement.ctaText ? (
              emergencySoon ? (
                <button
                  type="button"
                  disabled
                  className="relative z-[1] bg-slate-400 text-white px-4 py-2 rounded-full text-xs font-bold shadow shrink-0 cursor-not-allowed opacity-90"
                >
                  {announcement.ctaText}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSosPress?.(announcement);
                  }}
                  className="relative z-[1] bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-red-700 transition-colors animate-pulse shrink-0"
                >
                  {announcement.ctaText}
                </button>
              )
            ) : premiumSoon && announcement.ctaText ? (
              <button
                type="button"
                disabled
                className="relative z-[1] bg-slate-400 text-white px-4 py-2 rounded-full text-xs font-bold shadow shrink-0 cursor-not-allowed opacity-90"
              >
                {announcement.ctaText}
              </button>
            ) : (
              <ChevronRight className="relative z-[1] w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
