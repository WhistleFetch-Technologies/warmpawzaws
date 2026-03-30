"use client";

import { ReactNode } from 'react';
import { BottomNavigation } from './bottomNavigation/BottomNavigation';

interface CustomerScreenWrapperProps {
  children: ReactNode;
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onProfileClick?: () => void;
}

export function CustomerScreenWrapper({ 
  children, 
  currentScreen, 
  onNavigate, 
  onProfileClick 
}: CustomerScreenWrapperProps) {
  return (
    <>
      {/* Match bottom nav width so tabbed screens stay a single mobile column on large viewports */}
      <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
      <BottomNavigation 
        currentScreen={currentScreen}
        onNavigate={onNavigate}
        onProfileClick={onProfileClick}
      />
    </>
  );
}
