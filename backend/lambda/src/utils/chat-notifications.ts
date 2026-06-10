import { dispatchNotification } from './notification-dispatch';

export async function notifyVendorChatMessage(params: {
  vendorId: string;
  bookingId: string;
  senderLabel: string;
  messagePreview: string;
  messageId?: string;
}): Promise<void> {
  const preview =
    params.messagePreview.length > 80
      ? `${params.messagePreview.substring(0, 80)}…`
      : params.messagePreview;

  await dispatchNotification({
    recipientId: params.vendorId,
    recipientType: 'vendor',
    notificationType: 'chat_message',
    title: 'New chat message',
    message: `${params.senderLabel}: ${preview}`,
    channels: { inApp: true, push: true },
    priority: 'high',
    data: {
      bookingId: params.bookingId,
      dedupeKey: params.messageId
        ? `chat-${params.bookingId}-${params.messageId}`
        : `chat-${params.bookingId}-${Date.now()}`,
    },
  });
}
