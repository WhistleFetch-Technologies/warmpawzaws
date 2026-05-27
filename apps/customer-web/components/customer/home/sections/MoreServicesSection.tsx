'use client';

import React, { memo } from 'react';
import { Users, Shield, Dog, Coffee, ChevronRight } from 'lucide-react';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface MoreServicesSectionProps {
  onNavigate: HomeNavigateFn;
  className?: string;
}

function MoreServicesSectionComponent({ onNavigate, className = '' }: MoreServicesSectionProps) {
  return (
    <div className={`mb-6 px-4 ${className}`} aria-label="More Services">
      <h2 className="mb-4 font-semibold text-black">More Services</h2>
      <div className="grid grid-cols-2 gap-3">
        <div
          className="relative rounded-2xl border border-rose-100/80 bg-gradient-to-br from-rose-50/90 to-pink-50/90 p-4 text-left opacity-[0.88] grayscale-[0.12] pointer-events-none select-none"
          aria-label="Peer to Peer — coming soon"
        >
          <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Soon
          </span>
          <Users className="mb-2 h-8 w-8 text-rose-600/80" />
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Peer to Peer</h3>
          <p className="mb-3 text-xs text-gray-600">Find perfect match for your pet</p>
          <span className="text-xs font-semibold text-amber-600">Coming soon</span>
        </div>
        <div
          className="relative rounded-2xl border border-cyan-100/80 bg-gradient-to-br from-cyan-50/90 to-blue-50/90 p-4 text-left opacity-[0.88] grayscale-[0.15] pointer-events-none select-none"
          aria-label="Pet Insurance — coming soon"
        >
          <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Soon
          </span>
          <Shield className="mb-2 h-8 w-8 text-cyan-600/80" />
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Pet Insurance</h3>
          <p className="mb-3 text-xs text-gray-600">Protect your furry friend</p>
          <span className="text-xs font-semibold text-amber-600">Coming soon</span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('walker')}
          className="w-full rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4 text-left transition-shadow hover:shadow-md"
        >
          <Dog className="mb-2 h-8 w-8 text-green-600" />
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Dog Walkers</h3>
          <p className="mb-3 text-xs text-gray-600">Trusted & verified walkers</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
            Book Now <ChevronRight className="h-3 w-3" />
          </span>
        </button>
        <div
          className="relative rounded-2xl border border-amber-100/80 bg-gradient-to-br from-amber-50/90 to-yellow-50/90 p-4 text-left opacity-[0.88] grayscale-[0.1] pointer-events-none select-none"
          aria-label="Pet Cafes — coming soon"
        >
          <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Soon
          </span>
          <Coffee className="mb-2 h-8 w-8 text-amber-600/80" />
          <h3 className="mb-1 text-sm font-semibold text-gray-800">Pet Cafes</h3>
          <p className="mb-3 text-xs text-gray-600">Pet-friendly dining spots</p>
          <span className="text-xs font-semibold text-amber-600">Coming soon</span>
        </div>
      </div>
    </div>
  );
}

export const MoreServicesSection = memo(MoreServicesSectionComponent);
