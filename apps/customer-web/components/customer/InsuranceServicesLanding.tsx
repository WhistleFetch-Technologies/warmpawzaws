"use client";

import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface InsuranceServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

/** Pet insurance is not live yet — same treatment as emergency ambulance (non-actionable coming soon). */
export function InsuranceServicesLanding({ phone: _phone, onBack }: InsuranceServicesLandingProps) {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 pb-16 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pet Insurance</h1>
            <p className="text-white/80 text-sm">Protect your furry friend</p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white"
          style={{
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }}
        />
      </div>

      <div className="px-6 pb-24 -mt-2">
        <Card className="bg-amber-50 border-amber-200 p-6 text-center mb-6 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-amber-700" />
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-amber-500 text-white px-3 py-1 rounded-full mb-3">
            Coming soon
          </span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pet insurance</h2>
          <p className="text-gray-700 mb-6 text-sm leading-relaxed">
            We&apos;re not offering pet insurance yet, but we&apos;re building it for a future launch. You&apos;ll be able to compare plans and buy coverage right here when we go live.
          </p>
          <Button
            type="button"
            disabled
            className="w-full bg-slate-400 text-white h-12 text-lg font-bold cursor-not-allowed opacity-95"
          >
            COMING SOON
          </Button>
        </Card>
      </div>
    </div>
  );
}
