'use client';

import React, { memo, useCallback } from 'react';
import { HomeVisitServiceCard } from './HomeVisitServiceCard';
import {
  HOME_VISIT_SERVICES,
  type HomeVisitNavigateFn,
  type HomeVisitServiceEntry,
} from './constants/home-visit-service-catalog';

export interface HomeVisitServiceGridProps {
  onNavigate: HomeVisitNavigateFn;
}

function HomeVisitServiceGridComponent({ onNavigate }: HomeVisitServiceGridProps) {
  const handlePress = useCallback(
    (service: HomeVisitServiceEntry) => {
      onNavigate(service.targetScreen);
    },
    [onNavigate]
  );

  return (
    <section className="mt-6 px-4" aria-label="Available home services">
      <div className="mb-3 px-0">
        <h2 className="text-base font-bold text-gray-900">Choose a Home Service</h2>
        <p className="mt-0.5 text-xs text-gray-500">Select the service you need today</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {HOME_VISIT_SERVICES.map((service, index) => (
          <HomeVisitServiceCard
            key={service.id}
            service={service}
            index={index}
            onPress={handlePress}
          />
        ))}
      </div>
    </section>
  );
}

export const HomeVisitServiceGrid = memo(HomeVisitServiceGridComponent);
