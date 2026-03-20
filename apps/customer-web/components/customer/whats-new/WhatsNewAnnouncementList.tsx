'use client';

import { Phone, Star, BookOpen, Bot, ChevronRight } from 'lucide-react';
import type { WhatsNewAnnouncement } from '@/lib/whats-new-announcements';

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
        const isPremium = announcement.announcementType === 'premium';
        const isArticles = announcement.announcementType === 'articles';
        const bgGradient = isEmergency
          ? 'from-red-50 to-orange-50 border-red-100'
          : isPremium
            ? 'from-purple-50 to-indigo-50 border-purple-100'
            : isArticles
              ? 'from-teal-50 to-cyan-50 border-teal-100'
              : 'from-orange-50 to-pink-50 border-orange-100';
        const iconGradient = isEmergency
          ? 'from-red-500 to-orange-500'
          : isPremium
            ? 'from-purple-500 to-indigo-500'
            : isArticles
              ? 'from-teal-500 to-cyan-600'
              : 'from-[#FF8C42] to-[#FF6B35]';
        const badgeColor =
          announcement.badgeColor === 'red'
            ? 'bg-red-500'
            : announcement.badgeColor === 'purple'
              ? 'bg-purple-500'
              : announcement.badgeColor === 'blue'
                ? 'bg-blue-500'
                : announcement.badgeColor === 'teal'
                  ? 'bg-teal-600'
                  : 'bg-green-500';
        const IconComponent = isEmergency ? Phone : isPremium ? Star : isArticles ? BookOpen : Bot;

        const hubPremium = interactionMode === 'hub' && announcement.announcementType === 'premium';
        const rowClickable =
          !isEmergency &&
          !!onRowPress &&
          (!!announcement.ctaLink || hubPremium);

        return (
          <div
            key={announcement.id}
            role={rowClickable ? 'button' : undefined}
            tabIndex={rowClickable ? 0 : undefined}
            className={`bg-gradient-to-r ${bgGradient} rounded-2xl p-4 border flex items-center gap-4 ${
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
            <div
              className={`w-16 h-16 bg-gradient-to-br ${iconGradient} rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg ${
                isEmergency ? 'animate-pulse' : ''
              }`}
            >
              {announcement.icon ? (
                <span className="text-2xl">{announcement.icon}</span>
              ) : (
                <IconComponent className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs ${badgeColor} text-white px-2 py-0.5 rounded-full font-medium ${
                    isEmergency ? 'font-bold animate-pulse' : ''
                  }`}
                >
                  {announcement.badgeText || 'NEW'}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{announcement.title}</h3>
              <p className="text-xs text-gray-600">{announcement.subtitle}</p>
            </div>
            {isEmergency && announcement.ctaText ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSosPress?.(announcement);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-red-700 transition-colors animate-pulse shrink-0"
              >
                {announcement.ctaText}
              </button>
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
