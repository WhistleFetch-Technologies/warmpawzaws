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
      sizes="72px"
      className="object-cover"
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
      className="home-visit-fade-in group flex w-full min-h-[4.75rem] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-transform duration-200 active:scale-[0.98]"
      style={{ animationDelay: staggerDelay }}
    >
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl">
        <CardImage src={service.imageUrl} alt={service.title} />
        <span
          className={`absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${service.iconBg}`}
          aria-hidden
        >
          <Icon className={`h-3.5 w-3.5 ${service.iconColor}`} strokeWidth={2} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold leading-tight text-gray-900">{service.title}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-gray-500">{service.description}</p>
      </div>

      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${service.iconBg} text-white shadow-sm`}
        aria-hidden
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </button>
  );
}

export const HomeVisitServiceCard = memo(HomeVisitServiceCardComponent);
