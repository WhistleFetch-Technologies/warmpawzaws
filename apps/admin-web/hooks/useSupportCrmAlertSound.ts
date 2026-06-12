'use client';

import { useEffect, useRef } from 'react';
import { playNotificationAlertSound } from '@/lib/notification-sound';
import type { Ticket, TicketMessage } from '@/components/admin/support/crm/types';

function isCustomerMessage(message: TicketMessage): boolean {
  return message.role === 'customer';
}

/**
 * Plays a short alert when support CRM data changes (new ticket, customer reply, assignment update).
 */
export function useSupportCrmAlertSound({
  tickets,
  currentAdminId,
  selectedTicket,
  enabled = true,
}: {
  tickets: Ticket[];
  currentAdminId: string | null;
  selectedTicket: Ticket | null;
  enabled?: boolean;
}) {
  const listReadyRef = useRef(false);
  const ticketSnapRef = useRef<Map<string, string>>(new Map());
  const messageReadyRef = useRef(false);
  const lastMessageIdRef = useRef<string | null>(null);
  const selectedTicketIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const nextSnap = new Map<string, string>();
    for (const ticket of tickets) {
      nextSnap.set(ticket.id, ticket.lastUpdatedAt || ticket.createdAt || '');
    }

    if (!listReadyRef.current) {
      ticketSnapRef.current = nextSnap;
      listReadyRef.current = true;
      return;
    }

    const prevSnap = ticketSnapRef.current;
    let shouldPlay = false;

    for (const ticket of tickets) {
      const ts = ticket.lastUpdatedAt || ticket.createdAt || '';
      if (!prevSnap.has(ticket.id)) {
        shouldPlay = true;
        break;
      }
      const prevTs = prevSnap.get(ticket.id);
      if (prevTs !== ts && ticket.id !== selectedTicket?.id) {
        if (!ticket.assignedTo || (currentAdminId && ticket.assignedTo === currentAdminId)) {
          shouldPlay = true;
          break;
        }
      }
    }

    ticketSnapRef.current = nextSnap;
    if (shouldPlay) {
      playNotificationAlertSound();
    }
  }, [tickets, currentAdminId, selectedTicket?.id, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const ticketId = selectedTicket?.id ?? null;
    if (ticketId !== selectedTicketIdRef.current) {
      selectedTicketIdRef.current = ticketId;
      messageReadyRef.current = false;
      lastMessageIdRef.current = null;
    }

    const messages = selectedTicket?.messages;
    if (!ticketId || !messages?.length) return;

    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ? String(lastMessage.id) : null;
    if (!lastId) return;

    if (!messageReadyRef.current) {
      messageReadyRef.current = true;
      lastMessageIdRef.current = lastId;
      return;
    }

    if (lastId !== lastMessageIdRef.current && isCustomerMessage(lastMessage)) {
      playNotificationAlertSound();
    }

    lastMessageIdRef.current = lastId;
  }, [selectedTicket?.id, selectedTicket?.messages, enabled]);
}
