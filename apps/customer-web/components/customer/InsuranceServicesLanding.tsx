'use client';

import { useEffect, useState } from 'react';
import { isWarmpawzInsuranceCustomerEnabled } from '@/lib/warmpawz-insurance-flag';
import { InsuranceEntryHero } from './insurance/InsuranceEntryHero';
import { InsuranceQuoteJourney, beginInsuranceQuoteOrAuth } from './insurance/InsuranceQuoteJourney';
import { PlanGrid } from './insurance/PlanGrid';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface InsuranceServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /** When true, skip hero and open quote wizard (resume after OTP). */
  startQuote?: boolean;
}

export function InsuranceServicesLanding({
  phone,
  onBack,
  onNavigate,
  startQuote = false,
}: InsuranceServicesLandingProps) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'hero' | 'quote' | 'explore'>(startQuote ? 'quote' : 'hero');

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (startQuote) setMode('quote');
  }, [startQuote]);

  if (!ready) return <div className="min-h-screen bg-[#FFF8F3]" />;

  if (!isWarmpawzInsuranceCustomerEnabled()) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto">
        <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 pb-16 px-6 text-white cw-header-safe-top">
          <button type="button" onClick={onBack} className="mb-4 flex min-h-[44px] items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Pet Insurance</h1>
              <p className="text-white/80 text-sm">Protect your furry friend</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-24 -mt-2">
          <Card className="bg-amber-50 border-amber-200 p-6 text-center mb-6 shadow-sm">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-amber-500 text-white px-3 py-1 rounded-full mb-3">
              Coming soon
            </span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pet insurance</h2>
            <p className="text-gray-700 mb-6 text-sm leading-relaxed">
              We&apos;re not offering pet insurance yet on this environment.
            </p>
            <Button type="button" disabled className="w-full bg-slate-400 text-white h-12 font-bold">
              COMING SOON
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === 'quote') {
    return (
      <InsuranceQuoteJourney
        phone={phone}
        onBack={() => setMode('hero')}
        onTalkToExpert={() => onNavigate?.('insurance_plan', { planId: 'consult' })}
        onGoMyInsurance={() => onNavigate?.('my_insurance')}
      />
    );
  }

  if (mode === 'explore') {
    return (
      <PlanGrid
        onBack={() => setMode('hero')}
        onOpen={() => onNavigate?.('insurance_plan', { planId: 'consult' })}
      />
    );
  }

  return (
    <InsuranceEntryHero
      onBack={onBack}
      onGetQuote={() =>
        beginInsuranceQuoteOrAuth(() => {
          setMode('quote');
          onNavigate?.('insurance_quote');
        })
      }
      onExplore={() => setMode('explore')}
      onTalkToExpert={() => onNavigate?.('insurance_plan', { planId: 'consult' })}
    />
  );
}
