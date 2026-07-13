'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import type { HomeVisitServiceEntry } from './constants/home-visit-service-catalog';

function CardImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 480px) 45vw, 200px"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      unoptimized
    />
  );
}

export interface HomeVisitServiceCardProps {
  service: HomeVisitServiceEntry;
  index?: number;
  onPress: (service: HomeVisitServiceEntry) => void;
}

function HomeVisitServiceCardComponent({ service, index = 0, onPress }: HomeVisitServiceCardProps) {
  const Icon = service.Icon;
  const staggerDelay = `${Math.min(index, 7) * 60}ms`;

  return (
    <button
      type="button"
      onClick={() => onPress(service)}
      className="home-visit-fade-in group w-full text-left"
      style={{ animationDelay: staggerDelay }}
    >
      <div
        className={`relative flex h-full min-h-[172px] flex-col overflow-hidden rounded-3xl bg-gradient-to-br ${service.gradient} p-0 shadow-[0_8px_28px_rgba(16,185,129,0.1)] ring-1 ${service.ring} transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_14px_36px_rgba(16,185,129,0.18)] active:scale-[0.98] ${service.glow}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/10" aria-hidden />

        <div className="relative h-[92px] w-full overflow-hidden">
          <CardImage src={service.imageUrl} alt={service.title} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/25 to-transparent" />
          <span
            className={`absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md ${service.iconBg}`}
            aria-hidden
          >
            <Icon className={`h-[18px] w-[18px] ${service.iconColor}`} strokeWidth={2} />
          </span>
        </div>

        <div className="relative flex flex-1 flex-col p-3 pt-2">
          <h3 className="mb-0.5 text-sm font-bold leading-tight text-[#1E3A2F]">{service.title}</h3>
          <p className="mb-3 line-clamp-2 text-[11px] leading-snug text-gray-600">{service.description}</p>
          <span
            className={`mt-auto inline-flex h-8 w-8 items-center justify-center rounded-full ${service.iconBg} text-white shadow-sm transition-transform duration-200 group-hover:translate-x-0.5`}
            aria-hidden
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </button>
  );
}

export const HomeVisitServiceCard = memo(HomeVisitServiceCardComponent);
