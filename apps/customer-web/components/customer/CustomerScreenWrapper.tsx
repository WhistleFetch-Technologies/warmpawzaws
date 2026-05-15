"use client";

import { ReactNode } from 'react';
import { BottomNavigation } from './bottomNavigation/BottomNavigation';

interface CustomerScreenWrapperProps {
  children: ReactNode;
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onProfileClick?: () => void;
  /** Profile drawer from bottom nav; rendered here so every tabbed screen shows it immediately */
  accountSidebar?: ReactNode;
}

export function CustomerScreenWrapper({ 
  children, 
  currentScreen, 
  onNavigate, 
  onProfileClick,
  accountSidebar,
}: CustomerScreenWrapperProps) {
  return (
    <>
      {/* Match bottom nav width so tabbed screens stay a single mobile column on large viewports */}
      <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto pb-[var(--customer-tabbed-nav-offset)]">
        {children}
      </div>
      <BottomNavigation 
        currentScreen={currentScreen}
        onNavigate={onNavigate}
        onProfileClick={onProfileClick}
      />
      {accountSidebar}
    </>
  );
}
