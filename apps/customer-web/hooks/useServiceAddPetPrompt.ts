'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readProfileCompleted } from '@/lib/customer-flow-guards';
import { ensureCustomerProfileAndPets } from '@/lib/customer-home-bootstrap';
import { shouldShowServiceAddPetPrompt } from '@/lib/service-add-pet-prompt';
import type { Pet } from '@/components/customer/homepage/constants/interface';

const PROMPT_DELAY_MS = 300;

export interface UseServiceAddPetPromptOptions {
  phone: string;
  isGuest: boolean;
  currentScreen: string;
  petsCount: number;
  onPetsUpdated: (pets: Pet[]) => void;
}

export interface ServiceAddPetPromptBackHandlers {
  isPromoOpen: () => boolean;
  closePromo: () => void;
  isAddPetModalOpen: () => boolean;
  closeAddPetModal: () => void;
}

export function useServiceAddPetPrompt({
  phone,
  isGuest,
  currentScreen,
  petsCount,
  onPetsUpdated,
}: UseServiceAddPetPromptOptions) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Hide until user leaves this hub; re-show on every new service hub entry. */
  const dismissedHubRef = useRef<string | null>(null);
  const prevScreenRef = useRef(currentScreen);

  const profileCompleted = readProfileCompleted();

  const eligible = shouldShowServiceAddPetPrompt({
    isGuest,
    phone,
    currentScreen,
    petsCount,
    profileCompleted,
  });

  useEffect(() => {
    if (prevScreenRef.current !== currentScreen) {
      dismissedHubRef.current = null;
      prevScreenRef.current = currentScreen;
    }
  }, [currentScreen]);

  useEffect(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    if (!eligible) {
      setShowPrompt(false);
      return;
    }

    if (dismissedHubRef.current === currentScreen) {
      setShowPrompt(false);
      return;
    }

    delayTimerRef.current = setTimeout(() => {
      setShowPrompt(true);
    }, PROMPT_DELAY_MS);

    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, [eligible, currentScreen, phone]);

  useEffect(() => {
    if (petsCount > 0) {
      setShowPrompt(false);
      setShowAddPetModal(false);
      dismissedHubRef.current = null;
    }
  }, [petsCount]);

  const dismissForCurrentHub = useCallback(() => {
    dismissedHubRef.current = currentScreen;
    setShowPrompt(false);
  }, [currentScreen]);

  const handleAddPet = useCallback(() => {
    setShowPrompt(false);
    setShowAddPetModal(true);
  }, []);

  const handleMaybeLater = useCallback(() => {
    dismissForCurrentHub();
  }, [dismissForCurrentHub]);

  const handleClose = useCallback(() => {
    dismissForCurrentHub();
  }, [dismissForCurrentHub]);

  const handleAddPetModalClose = useCallback(() => {
    setShowAddPetModal(false);
  }, []);

  const handlePetAddedSuccess = useCallback(async () => {
    setShowAddPetModal(false);
    setShowPrompt(false);
    dismissedHubRef.current = null;
    try {
      const { pets } = await ensureCustomerProfileAndPets(phone, { force: true }).refreshPromise;
      onPetsUpdated(pets);
    } catch {
      /* onPetsUpdated may still run from cache on next navigation */
    }
  }, [phone, onPetsUpdated]);

  const backHandlersRef = useRef<ServiceAddPetPromptBackHandlers>({
    isPromoOpen: () => false,
    closePromo: () => {},
    isAddPetModalOpen: () => false,
    closeAddPetModal: () => {},
  });

  backHandlersRef.current = {
    isPromoOpen: () => showPrompt,
    closePromo: () => {
      dismissForCurrentHub();
    },
    isAddPetModalOpen: () => showAddPetModal,
    closeAddPetModal: () => setShowAddPetModal(false),
  };

  const getBackHandlers = useCallback(() => backHandlersRef.current, []);

  return {
    showPrompt,
    showAddPetModal,
    handleAddPet,
    handleMaybeLater,
    handleClose,
    handleAddPetModalClose,
    handlePetAddedSuccess,
    getBackHandlers,
  };
}
