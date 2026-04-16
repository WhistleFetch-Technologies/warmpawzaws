"use client";

import { WalkerService } from '../WalkerService';

interface WalkerDashboardProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  data?: any;
}

export function WalkerDashboard({ phone, onBack, onNavigate, data }: WalkerDashboardProps) {
  // Use the full WalkerService component instead of placeholder
  return (
    <WalkerService
      phone={phone}
      onBack={onBack}
      onNavigate={onNavigate}
      pendingWalkSession={data?.pendingWalkSession}
    />
  );
}
