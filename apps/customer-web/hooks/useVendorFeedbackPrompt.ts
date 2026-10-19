'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VENDOR_FEEDBACK_PROMPT_SESSION_KEY,
  hasSeenSessionPrompt,
  markSessionPromptSeen,
} from '@/lib/app-session-prompt';
import { BACK_HANDLER_PRIORITY, registerBackHandler } from '@/lib/navigation/back-handler-registry';
import type { VendorFeedbackPrompt, VendorFeedbackSubmission } from '@/lib/vendor-feedback/types';
import {
  dismissVendorFeedback,
  fetchVendorFeedbackPrompt,
  submitVendorFeedback,
} from '@/lib/vendor-feedback/vendor-feedback-api';

/** Same launch delay as the former ecommerce popup. */
export const VENDOR_FEEDBACK_OPEN_DELAY_MS = 700;

type Status = 'idle' | 'open' | 'submitting' | 'done';

export function useVendorFeedbackPrompt(enabled: boolean) {
  const [prompt, setPrompt] = useState<VendorFeedbackPrompt | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const promptRef = useRef<VendorFeedbackPrompt | null>(null);
  promptRef.current = prompt;

  useEffect(() => {
    if (!enabled || hasSeenSessionPrompt(VENDOR_FEEDBACK_PROMPT_SESSION_KEY)) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const next = await fetchVendorFeedbackPrompt();
        if (cancelled) return;
        markSessionPromptSeen(VENDOR_FEEDBACK_PROMPT_SESSION_KEY);
        if (next) {
          setPrompt(next);
          setStatus('open');
        }
      } catch {
        /* network failure: leave the session unmarked so a later home mount can retry */
      }
    }, VENDOR_FEEDBACK_OPEN_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  const continueToHome = useCallback(() => {
    const current = promptRef.current;
    setStatus('done');
    setErrorText(null);
    if (current) {
      void dismissVendorFeedback({ sourceType: current.sourceType, sourceId: current.sourceId }).catch(
        () => undefined
      );
    }
  }, []);

  const submit = useCallback(async ({ rating, comment }: VendorFeedbackSubmission) => {
    const current = promptRef.current;
    if (!current) return false;
    setStatus('submitting');
    setErrorText(null);
    try {
      await submitVendorFeedback({
        sourceType: current.sourceType,
        sourceId: current.sourceId,
        rating,
        comment,
      });
      setStatus('done');
      return true;
    } catch (err) {
      const failure = (err ?? {}) as { statusCode?: number; status?: number };
      if ((failure.statusCode ?? failure.status) === 409) {
        setStatus('done');
        return true;
      }
      setStatus('open');
      setErrorText('Could not submit your feedback. Please try again.');
      return false;
    }
  }, []);

  const isOpen = status === 'open' || status === 'submitting';

  useEffect(() => {
    if (!isOpen) return;
    return registerBackHandler(() => {
      if (status !== 'submitting') continueToHome();
      return true;
    }, BACK_HANDLER_PRIORITY.shellOverlay);
  }, [isOpen, status, continueToHome]);

  return {
    prompt,
    isOpen,
    submitting: status === 'submitting',
    errorText,
    submit,
    continueToHome,
  };
}
