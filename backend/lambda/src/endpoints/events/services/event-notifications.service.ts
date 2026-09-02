import { dispatchNotification } from '../../../utils/notification-dispatch';

export async function notifyEventCustomer(input: {
  customerId: string;
  type: string;
  title: string;
  message: string;
  registrationId?: string;
  eventId?: string;
}) {
  await dispatchNotification({
    recipientId: input.customerId,
    recipientType: 'customer',
    notificationType: input.type,
    title: input.title,
    message: input.message,
    data: {
      eventId: input.eventId,
      registrationId: input.registrationId,
    },
    deepLinkOverride: input.registrationId
      ? `/events/registrations/${input.registrationId}`
      : '/events',
    channels: { inApp: true, push: true },
  }).catch((error) => console.error('[events-notify]', error));
}
