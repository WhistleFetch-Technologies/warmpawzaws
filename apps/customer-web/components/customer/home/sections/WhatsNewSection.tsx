'use client';

import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { WhatsNewAnnouncementList } from '@/components/customer/whats-new/WhatsNewAnnouncementList';
import type { WhatsNewAnnouncement } from '@/lib/whats-new-announcements';

export interface WhatsNewSectionProps {
  announcements: WhatsNewAnnouncement[];
  onSeeAll?: () => void;
  onRowPress?: (announcement: WhatsNewAnnouncement) => void;
  onSosPress?: (announcement: WhatsNewAnnouncement) => void;
  className?: string;
}

function WhatsNewSectionComponent({
  announcements,
  onSeeAll,
  onRowPress,
  onSosPress,
  className = '',
}: WhatsNewSectionProps) {
  return (
    <div className={`mb-6 ${className}`} aria-label="What's New">
      <div className="mb-4 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#FF8C42]" />
          <h2 className="font-semibold text-black">What&apos;s New</h2>
        </div>
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-medium text-[#FF8C42]"
          >
            See all
          </button>
        ) : null}
      </div>
      <div className="px-4">
        <WhatsNewAnnouncementList
          announcements={announcements}
          interactionMode="hub"
          onRowPress={onRowPress}
          onSosPress={onSosPress}
        />
      </div>
    </div>
  );
}

export const WhatsNewSection = memo(WhatsNewSectionComponent);
