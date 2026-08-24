'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Pet } from '@/components/customer/homepage/constants/interface';
import { useServiceAddPetPrompt, type ServiceAddPetPromptBackHandlers } from '@/hooks/useServiceAddPetPrompt';
import { AddPetServicePromptModal } from './AddPetServicePromptModal';

const EnhancedAddPetModal = dynamic(
  () => import('../EnhancedAddPetModal').then((m) => ({ default: m.EnhancedAddPetModal })),
  { ssr: false }
);

export interface ServiceAddPetPromptHostProps {
  phone: string;
  isGuest: boolean;
  currentScreen: string;
  petsCount: number;
  onPetsUpdated: (pets: Pet[]) => void;
  onBackHandlersReady?: (handlers: ServiceAddPetPromptBackHandlers) => void;
}

export function ServiceAddPetPromptHost({
  phone,
  isGuest,
  currentScreen,
  petsCount,
  onPetsUpdated,
  onBackHandlersReady,
}: ServiceAddPetPromptHostProps) {
  const {
    showPrompt,
    showAddPetModal,
    handleAddPet,
    handleMaybeLater,
    handleClose,
    handleAddPetModalClose,
    handlePetAddedSuccess,
    getBackHandlers,
  } = useServiceAddPetPrompt({
    phone,
    isGuest,
    currentScreen,
    petsCount,
    onPetsUpdated,
  });

  useEffect(() => {
    onBackHandlersReady?.(getBackHandlers());
  }, [showPrompt, showAddPetModal, getBackHandlers, onBackHandlersReady]);

  return (
    <>
      <AddPetServicePromptModal
        open={showPrompt}
        onAddPet={handleAddPet}
        onDismiss={handleMaybeLater}
        onClose={handleClose}
      />
      {showAddPetModal && (
        <EnhancedAddPetModal
          phone={phone}
          isOpen={showAddPetModal}
          onClose={handleAddPetModalClose}
          onSuccess={() => {
            void handlePetAddedSuccess();
          }}
        />
      )}
    </>
  );
}
