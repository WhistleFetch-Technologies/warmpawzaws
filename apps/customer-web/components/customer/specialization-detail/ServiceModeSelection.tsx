'use client';

import { ArrowRight, Building2, Clock, Home, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { VetServiceModeInformation } from '@/lib/specialization-detail';
import { SpecializationDetailSection } from './SpecializationDetailSection';

export type ServiceStyle = 'at_home' | 'at_center' | 'tele';

const SERVICE_STYLE_CONFIG: Record<
  ServiceStyle,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  at_home: {
    label: 'At Home',
    icon: <Home className="w-6 h-6" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Service at your doorstep',
  },
  at_center: {
    label: 'At Clinic/Center',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Visit the service center',
  },
  tele: {
    label: 'Video Call',
    icon: <Video className="w-6 h-6" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Online consultation',
  },
};

type ServiceModeSelectionProps = {
  availableStyles: ServiceStyle[];
  specializationName?: string;
  loading?: boolean;
  hasTeleOption?: boolean;
  instantTeleEnabled?: boolean;
  /** When set (vet detail), enriches cards with specialization-specific mode copy. */
  serviceModeInformation?: VetServiceModeInformation;
  onSelect: (style: ServiceStyle) => void;
  onClose?: () => void;
};

export function ServiceModeSelection({
  availableStyles,
  specializationName,
  loading = false,
  hasTeleOption = false,
  instantTeleEnabled = false,
  serviceModeInformation,
  onSelect,
}: ServiceModeSelectionProps) {
  const enrichedCards = Boolean(serviceModeInformation);

  return (
    <SpecializationDetailSection delay={0.28} className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Choose Service Mode</h2>
        <p className="mt-1 text-sm text-slate-500">Choose how you&apos;d like to receive this service</p>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-2xl bg-slate-100 ${enrichedCards ? 'h-[132px]' : 'h-[88px]'}`}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {availableStyles.map((style, index) => {
            const config = SERVICE_STYLE_CONFIG[style];
            if (!config) return null;

            const modeInfo = serviceModeInformation?.[style];

            return (
              <motion.div
                key={style}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.28 + index * 0.05 }}
              >
                <Card
                  onClick={() => onSelect(style)}
                  className="cursor-pointer border-gray-200 p-4 transition hover:border-[#FF8C42] hover:shadow-md"
                >
                  <div className={`flex gap-4 ${modeInfo ? 'items-start' : 'items-center'}`}>
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.bgColor} ${config.color}`}
                    >
                      {config.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{config.label}</h3>
                        <ArrowRight className="h-5 w-5 shrink-0 text-gray-400" />
                      </div>
                      {modeInfo ? (
                        <>
                          <p className="mt-1 text-sm font-medium text-slate-800">{modeInfo.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-500">{modeInfo.description}</p>
                          {modeInfo.details?.length ? (
                            <ul className="mt-2 space-y-1">
                              {modeInfo.details.map((detail) => (
                                <li key={detail} className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                                  <span>{detail}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">{config.description}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && availableStyles.length === 0 && (
        <div className="rounded-[20px] border border-slate-100 bg-white py-8 text-center">
          <p className="text-gray-500">No service styles available for this problem.</p>
        </div>
      )}

      {!loading && hasTeleOption && instantTeleEnabled && (
        <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
              <Clock className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Need Instant Consultation?</h3>
              <p className="text-sm text-purple-100">Connect with an available doctor in minutes</p>
            </div>
            <Button
              variant="secondary"
              className="bg-white text-purple-600 hover:bg-purple-50"
              onClick={() => onSelect('tele')}
            >
              Instant
            </Button>
          </div>
        </Card>
      )}

      {!loading && availableStyles.length > 0 && (
        <div className="rounded-[16px] border border-slate-100 bg-slate-50/80 px-4 py-3 text-center">
          <p className="text-sm text-gray-500">
            Service providers are filtered based on &quot;{specializationName}&quot;
          </p>
          {availableStyles.length < 3 && (
            <p className="mt-1 text-xs text-gray-400">
              Only{' '}
              {availableStyles
                .map((s) => SERVICE_STYLE_CONFIG[s]?.label)
                .filter(Boolean)
                .join(' and ')}{' '}
              available for this service
            </p>
          )}
        </div>
      )}
    </SpecializationDetailSection>
  );
}

export { SERVICE_STYLE_CONFIG };
