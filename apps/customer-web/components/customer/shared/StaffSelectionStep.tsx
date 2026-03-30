"use client";

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface StaffSelectionStepProps {
  vendorId: string;
  serviceId?: string;
  serviceStyle: string;
  selectedDate?: string;
  selectedTime?: string;
  onSelect: (staffId: string, staff: any) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StaffSelectionStep({
  vendorId,
  serviceId,
  serviceStyle,
  selectedDate,
  selectedTime,
  onSelect,
  onBack,
  onSkip,
}: StaffSelectionStepProps) {
  // TODO: Implement staff selection functionality
  // For now, this is a stub to fix the build error
  
  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-customer mx-auto">
      <div className="px-6 pt-4 pb-2 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="mr-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Select Staff</h2>
      </div>
      
      <div className="flex-1 px-6 py-4">
        <p className="text-gray-600 mb-4">
          Staff selection is not yet implemented. You can skip this step.
        </p>
        
        <div className="space-y-3">
          <Button
            onClick={onSkip}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          >
            Skip Staff Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
