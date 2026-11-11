'use client';

import { ArrowLeft, Headphones, Shield } from 'lucide-react';

type Props = {
  onBack: () => void;
  onGetQuote: () => void;
  onExplore: () => void;
  onTalkToExpert: () => void;
};

export function InsuranceEntryHero({ onBack, onGetQuote, onExplore, onTalkToExpert }: Props) {
  return (
    <div className="min-h-[100dvh] bg-white max-w-lg mx-auto">
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-gray-50"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
        <p className="text-sm font-semibold text-gray-900">Pet Insurance</p>
      </div>

      <div className="px-4 pb-28">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF1E6] via-white to-[#FFE8D6] border border-orange-100 shadow-sm">
          <div className="p-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-orange-100 px-3 py-1 text-xs font-semibold text-[#FF8C42]">
              <Shield className="w-3.5 h-3.5" />
              HDFC ERGO · Paws N Claws
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900 leading-tight">
              Pet Insurance: Protect your pet&apos;s health with trusted plans.
            </h1>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><span className="text-[#FF8C42]">•</span> All-round protection</li>
              <li className="flex gap-2"><span className="text-[#FF8C42]">•</span> Customisable plans</li>
              <li className="flex gap-2"><span className="text-[#FF8C42]">•</span> Expert assistance</li>
            </ul>
            <button
              type="button"
              onClick={onGetQuote}
              className="mt-6 w-full h-12 rounded-2xl bg-[#FF8C42] text-white font-bold text-base shadow-sm hover:bg-[#ff7a28]"
            >
              Get My Free Quote →
            </button>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={onExplore}
                className="w-full h-11 rounded-2xl border border-orange-200 text-[#FF8C42] font-semibold text-sm bg-white"
              >
                Explore Coverage & Plans
              </button>
              <button
                type="button"
                onClick={onTalkToExpert}
                className="w-full h-11 rounded-2xl border border-gray-200 text-gray-800 font-semibold text-sm bg-white inline-flex items-center justify-center gap-2"
              >
                <Headphones className="w-4 h-4" />
                Talk to an Insurance Expert
              </button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          Premiums are confirmed by HDFC ERGO. Warmpawz does not invent insurer quotations. Existing consultation booking remains available via Expert assistance.
        </p>
      </div>
    </div>
  );
}
