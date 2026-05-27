'use client';

import React, { memo } from 'react';
import { Video } from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface NeedHelpSectionProps {
  onNavigate: HomeNavigateFn;
  className?: string;
}

function NeedHelpSectionComponent({ onNavigate, className = '' }: NeedHelpSectionProps) {
  return (
    <div className={`px-4 ${className}`}>
      <div className="rounded-3xl border-2 border-[#FF8C42] bg-gradient-to-r from-orange-100 to-pink-100 p-6 text-center">
        <h2 className="mb-2 text-lg font-bold text-black">Need Help? 🤝</h2>
        <p className="mb-4 text-sm text-gray-700">Our support team is available 24/7 for you</p>
        <div className="flex justify-center">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF8C42] px-10 py-3 text-sm font-medium text-white shadow-sm active:opacity-90"
            onClick={() => {
              try {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
                }
                onNavigate('support_help', { initialTab: 'contact' });
              } catch {
                toast.error('Could not open support. Please try again.');
              }
            }}
          >
            <Video className="h-4 w-4" /> Live Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export const NeedHelpSection = memo(NeedHelpSectionComponent);
