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
      <div className="pb-20 min-h-screen">
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
