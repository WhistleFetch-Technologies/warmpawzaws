'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useVendorFeedbackPrompt } from '@/hooks/useVendorFeedbackPrompt';
import { mapFeedbackVendorToCardProps } from '@/lib/vendor-feedback/map-feedback-vendor-to-card-props';
import { VendorFeedbackSheet } from './VendorFeedbackSheet';

type VendorFeedbackPromptProps = {
  /** False for guests / signed-out sessions. */
  enabled: boolean;
};

/** Home launch prompt: review the vendor of the customer's most recent completed transaction. */
export function VendorFeedbackPrompt({ enabled }: VendorFeedbackPromptProps) {
  const { prompt, isOpen, submitting, errorText, submit, continueToHome } =
    useVendorFeedbackPrompt(enabled);

  const vendorCard = useMemo(() => (prompt ? mapFeedbackVendorToCardProps(prompt) : null), [prompt]);

  if (!prompt || !vendorCard) return null;

  return (
    <VendorFeedbackSheet
      open={isOpen}
      subtitle={prompt.title}
      vendorCard={vendorCard}
      submitting={submitting}
      errorText={errorText}
      onContinue={continueToHome}
      onSubmit={async (value) => {
        if (await submit(value)) toast.success('Thanks for your feedback!');
      }}
    />
  );
}
