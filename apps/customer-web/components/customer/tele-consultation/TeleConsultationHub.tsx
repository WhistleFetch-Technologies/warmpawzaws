'use client';

import React, { memo } from 'react';
import { Stethoscope, UtensilsCrossed, ChevronRight, Video, Apple, ShieldCheck } from 'lucide-react';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';

export type TeleConsultationHubChoice = 'vet' | 'nutritionist';

export interface TeleConsultationHubProps {
  onBack: () => void;
  onSelect: (choice: TeleConsultationHubChoice) => void;
}

const TELE_HUB_OPTIONS: {
  id: TeleConsultationHubChoice;
  title: string;
  description: string;
  Icon: typeof Stethoscope;
  iconBg: string;
  iconColor: string;
  chips: { icon: typeof Video; label: string }[];
}[] = [
  {
    id: 'vet',
    title: 'Vet Consultation',
    description: 'Talk to a certified veterinarian over video for symptoms, prescriptions & follow-ups',
    Icon: Stethoscope,
    iconBg: 'bg-[#FF8C42]',
    iconColor: 'text-white',
    chips: [
      { icon: Video, label: 'Video call' },
      { icon: ShieldCheck, label: 'Verified vets' },
    ],
  },
  {
    id: 'nutritionist',
    title: 'Diet Consultation',
    description: 'Get a personalized diet plan and nutrition advice from expert pet nutritionists',
    Icon: UtensilsCrossed,
    iconBg: 'bg-emerald-500',
    iconColor: 'text-white',
    chips: [
      { icon: Apple, label: 'Diet plan' },
      { icon: ShieldCheck, label: 'Expert advice' },
    ],
  },
];

function TeleConsultationHubComponent({ onBack, onSelect }: TeleConsultationHubProps) {
  return (
    <div className="relative mx-auto min-h-[100dvh] w-full max-w-customer bg-gray-50">
      <ServiceDashboardHeader
        serviceName="Tele Consultation"
        serviceSubtitle="Talk to an expert over video"
        serviceIcon={Video}
        iconColor="text-white"
        stats={EMPTY_SERVICE_HEADER_STATS}
        onBack={onBack}
        showBackButton
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />

      <div className="px-4 pt-4 pb-8">
        <h2 className="mb-4 text-base font-semibold text-gray-900">What would you like to consult about?</h2>

        <div className="flex flex-col gap-3">
          {TELE_HUB_OPTIONS.map((option) => {
            const Icon = option.Icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className="w-full rounded-2xl border-2 border-transparent bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:border-[#FF8C42]/40 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${option.iconBg}`}
                  >
                    <Icon className={`h-6 w-6 ${option.iconColor}`} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900">{option.title}</h3>
                    <p className="mt-0.5 text-sm leading-snug text-gray-600">{option.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      {option.chips.map((chip) => {
                        const ChipIcon = chip.icon;
                        return (
                          <span key={chip.label} className="flex items-center gap-1">
                            <ChipIcon className="h-3.5 w-3.5" />
                            {chip.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const TeleConsultationHub = memo(TeleConsultationHubComponent);
export default TeleConsultationHub;
