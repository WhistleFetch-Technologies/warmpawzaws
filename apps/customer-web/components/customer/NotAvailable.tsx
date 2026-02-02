'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NotAvailableProps {
  /** Optional label for the page (e.g. section name). */
  label?: string;
  onBack: () => void;
}

export function NotAvailable({ label, onBack }: NotAvailableProps) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <p className="text-gray-600 mb-4">
        {label ? `"${label}" is not available.` : 'This page is not available.'}
      </p>
      <Button variant="outline" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>
    </div>
  );
}
