'use client';

import React from 'react';
import { UniversalStyleSelection } from '../shared/UniversalStyleSelection';
import type { ServiceStyle } from '../shared/roleConfig';

// ============================================================================
// VET STYLE SELECTION SCREEN (Wrapper)
// ============================================================================

interface VetStyleSelectionProps {
  problemTitle: string;
  problemId: string;
  onSelectTele: () => void;
  onSelectHome: () => void;
  onSelectClinic: () => void;
  onBack: () => void;
}

export function VetStyleSelection({
  problemTitle,
  problemId,
  onSelectTele,
  onSelectHome,
  onSelectClinic,
  onBack,
}: VetStyleSelectionProps) {
  return (
    <UniversalStyleSelection
      roleId="veterinarian"
      problemTitle={problemTitle}
      problemId={problemId}
      onSelectStyle={(style: ServiceStyle) => {
        if (style === 'tele') onSelectTele();
        else if (style === 'at_home') onSelectHome();
        else if (style === 'at_center') onSelectClinic();
      }}
      onBack={onBack}
    />
  );
}
