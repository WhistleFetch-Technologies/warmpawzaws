'use client';

import { ChatWidget } from './ChatWidget';

interface AIChatBotProps {
  customerId?: string;
  customerName?: string;
  onClose?: () => void;
  /** Start minimized (floating button only). Default true. */
  defaultMinimized?: boolean;
}

export function AIChatBot({ customerId, customerName, onClose, defaultMinimized = true }: AIChatBotProps) {
  return (
    <ChatWidget
      userId={customerId}
      userName={customerName}
      userType="vendor"
      defaultOpen={!defaultMinimized}
      onClose={onClose}
    />
  );
}
