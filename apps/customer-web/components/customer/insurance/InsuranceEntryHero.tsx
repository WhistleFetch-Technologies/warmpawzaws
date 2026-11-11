'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Headphones,
  HeartPulse,
  PawPrint,
  Shield,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { PAWS_N_CLAWS_PRODUCT } from '@warmpawz/shared-types';
import {
  InfoBanner,
  INS_BG,
  PrimaryButton,
  SecondaryButton,
  SoftCard,
  formatInr,
} from './insurance-journey-ui';

type Props = {
  onBack: () => void;
  onGetQuote: () => void;
  /** @deprecated Explore Coverage is inline on the hero. Kept optional for callers. */
  onExplore?: () => void;
  onTalkToExpert: () => void;
};

export function InsuranceEntryHero({ onBack, onGetQuote, onTalkToExpert }: Props) {
  const [showCoverage, setShowCoverage] = useState(false);

  return (
    <div className={`min-h-[100dvh] ${INS_BG} max-w-lg mx-auto text-[#1F2A37]`}>
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-white/70"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold">Pet Insurance</p>
      </div>

      <div className="px-4 pb-28 space-y-4">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#FF9A57] via-[#FF8C42] to-[#F97316] text-white shadow-[0_18px_40px_rgba(255,140,66,0.35)]">
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-[#FDE68A]/20 blur-2xl" />
          <div className="relative p-5 pb-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 px-3 py-1 text-[11px] font-semibold tracking-wide">
              <Shield className="w-3.5 h-3.5" />
              HDFC ERGO · Paws N Claws
            </div>
            <h1 className="mt-4 text-[1.7rem] leading-tight font-bold max-w-[15ch]">
              Because every paw deserves protection.
            </h1>
            <p className="mt-2 text-sm text-white/90 leading-relaxed max-w-[34ch]">
              Explore pet insurance designed to help protect your pet against eligible medical expenses.
            </p>
            <div className="mt-4 relative h-36 w-full">
              <Image
                src="/images/home/3cards/pet-insurance.webp"
                alt="Happy pets"
                fill
                className="object-contain object-right-bottom drop-shadow-lg"
                sizes="(max-width: 512px) 90vw, 420px"
                priority
              />
            </div>
          </div>
        </div>

        <SoftCard>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#FF8C42] mb-3">Why customers choose it</p>
          <ul className="space-y-3">
            {[
              { icon: Stethoscope, text: 'Protection against eligible veterinary expenses' },
              { icon: Sparkles, text: 'Flexible coverage options for different needs' },
              { icon: HeartPulse, text: 'Expert assistance throughout your application' },
            ].map((row) => (
              <li key={row.text} className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-[#FFF4EC] text-[#FF8C42] flex items-center justify-center shrink-0">
                  <row.icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-[#1F2A37] leading-snug pt-2">{row.text}</p>
              </li>
            ))}
          </ul>
        </SoftCard>

        <div className="space-y-2.5">
          <PrimaryButton onClick={onGetQuote}>Get My Free Quote</PrimaryButton>
          <SecondaryButton onClick={() => setShowCoverage((v) => !v)}>
            {showCoverage ? 'Hide coverage overview' : 'Explore Coverage'}
          </SecondaryButton>
          <SecondaryButton onClick={onTalkToExpert} className="inline-flex items-center justify-center gap-2">
            <Headphones className="w-4 h-4" />
            Talk to an Insurance Expert
          </SecondaryButton>
        </div>

        {showCoverage ? <CoverageExplainer /> : null}

        <InfoBanner tone="navy" title="How quotations work">
          HDFC ERGO confirms the actual premium. Warmpawz does not independently calculate insurer quotations.
          Expert assistance remains available if you prefer a guided consultation.
        </InfoBanner>
      </div>
    </div>
  );
}

function CoverageExplainer() {
  const product = PAWS_N_CLAWS_PRODUCT;
  return (
    <SoftCard className="space-y-3">
      <div className="flex items-center gap-2">
        <PawPrint className="w-4 h-4 text-[#FF8C42]" />
        <h2 className="font-bold text-[#1F2A37]">Coverage at a glance</h2>
      </div>
      {(
        [
          product.sections.comprehensive,
          product.sections.make_your_own,
          product.sections.third_party,
        ] as const
      ).map((section) => (
        <div key={section.key} className="rounded-xl border border-[#F0E6DB] bg-[#FFFCF8] p-3">
          <p className="font-semibold text-sm">{section.title}</p>
          <p className="text-xs text-[#6B7280] mt-1">{section.subtitle}</p>
          <p className="text-[11px] text-[#9A6B3F] mt-2 font-medium">
            Sum insured from {formatInr(section.sumInsured[0])} to{' '}
            {formatInr(section.sumInsured[section.sumInsured.length - 1])}
            {section.nilCopay ? ' · Nil co-pay' : ' · Co-pay 10–30%'}
          </p>
        </div>
      ))}
      <p className="text-[11px] text-[#6B7280] leading-relaxed">
        Optional covers (Veterinary Consultation, Trip Cancellation, Funeral Expenses) are available with
        eligible Comprehensive or Make Your Own configurations — not with Third-Party Liability alone.
      </p>
    </SoftCard>
  );
}
