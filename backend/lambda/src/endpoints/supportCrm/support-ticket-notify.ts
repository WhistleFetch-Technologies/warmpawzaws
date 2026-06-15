/**
 * Customer notifications for support ticket updates (SMS).
 */

import { select } from '../../database/rds-connection';
import { getSnsClient } from '../../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';

type TicketRow = {
  id?: string;
  customer_id?: string | null;
  customer_phone?: string | null;
};

export async function notifySupportTicketCustomerSms(
  ticket: TicketRow,
  message: string
): Promise<void> {
  if (!message?.trim()) return;

  try {
    const snsClient = getSnsClient();
    let customerPhone = ticket.customer_phone || null;

    if (!customerPhone && ticket.customer_id) {
      const customers = await select('customers', { id: ticket.customer_id });
      customerPhone = customers[0]?.phone || null;
    }

    if (!customerPhone) {
      console.warn('[support-notify] no customer phone for ticket', ticket.id);
      return;
    }

    const preview =
      message.length > 100 ? `${message.substring(0, 100)}...` : message;

    await snsClient.send(
      new PublishCommand({
        PhoneNumber: customerPhone,
        Message: `Support Update: ${preview}`,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        },
      })
    );
  } catch (err) {
    console.warn('[support-notify] SMS failed:', err);
  }
}
