'use client';

import React, { memo, useCallback } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORT_INITIAL_TAB_KEY, getSupportPhoneLabel, getSupportTelHref } from '@/lib/support-contact';
import type { HomeVisitNavigateFn } from './constants/home-visit-service-catalog';

export interface HomeVisitBottomCTAProps {
  onNavigate: HomeVisitNavigateFn;
}

function HomeVisitBottomCTAComponent({ onNavigate }: HomeVisitBottomCTAProps) {
  const handleChat = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, 'contact');
      }
      onNavigate('support_help', { initialTab: 'contact' });
    } catch {
      toast.error('Could not open support. Please try again.');
    }
  }, [onNavigate]);

  const handleCall = useCallback(() => {
    window.location.href = getSupportTelHref();
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-customer"
      aria-label="Need help choosing a service"
    >
      <div className="pointer-events-auto border-t border-emerald-100/80 bg-white/95 px-4 py-3 shadow-[0_-8px_32px_rgba(16,185,129,0.1)] backdrop-blur-lg pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <p className="mb-2.5 text-center text-xs font-medium text-gray-600">Need help choosing?</p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            Chat with Pet Expert
          </button>
          <button
            type="button"
            onClick={handleCall}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-500 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 active:scale-[0.98]"
            aria-label={`Call support at ${getSupportPhoneLabel()}`}
          >
            <Phone className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            <span className="hidden sm:inline">Call Support</span>
            <span className="sm:hidden">Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const HomeVisitBottomCTA = memo(HomeVisitBottomCTAComponent);
