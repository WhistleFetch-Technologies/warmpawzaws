'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ServiceStyleLaunchBlockedProps {
  message: string;
  onBack: () => void;
  title?: string;
}

export function ServiceStyleLaunchBlocked({
  message,
  onBack,
  title = 'Not Available',
}: ServiceStyleLaunchBlockedProps) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <Card className="p-8 text-center bg-white border border-gray-100 max-w-sm w-full">
        <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-4">{message}</p>
        <Button
          onClick={onBack}
          variant="outline"
          className="border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
        >
          Go Back
        </Button>
      </Card>
    </div>
  );
}
