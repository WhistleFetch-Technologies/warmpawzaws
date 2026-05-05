/**
 * Builds SELECT for GET /support/tickets. Extracted for unit tests (parentheses / placeholders).
 */
export type SupportTicketsListQueryInput = {
  customerId?: string;
  customerPhone?: string;
  agentId?: string;
  status?: string;
  limit: number;
  offset: number;
};

export function buildSupportTicketsListQuery(
  input: SupportTicketsListQueryInput
): { sql: string; params: unknown[] } {
  let ticketsQuery = `SELECT * FROM support_tickets WHERE 1=1`;
  const params: unknown[] = [];
  let paramIndex = 1;

  const customerClauses: string[] = [];
  if (input.customerId) {
    params.push(input.customerId);
    customerClauses.push(`customer_id = $${paramIndex}`);
    paramIndex += 1;
  }
  if (input.customerPhone) {
    const digits = input.customerPhone.replace(/\D/g, '');
    const last10 = digits.length >= 10 ? digits.slice(-10) : '';
    if (last10) {
      params.push(input.customerPhone, digits, last10);
      const i1 = paramIndex;
      const i2 = paramIndex + 1;
      const i3 = paramIndex + 2;
      paramIndex += 3;
      customerClauses.push(`(
            customer_phone = $${i1}
            OR NULLIF(regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g'), '') = $${i2}
            OR (length(regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g')) >= 10
                AND right(regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g'), 10) = $${i3})
          )`);
    } else {
      params.push(input.customerPhone);
      customerClauses.push(`customer_phone = $${paramIndex}`);
      paramIndex += 1;
    }
  }
  if (customerClauses.length > 0) {
    ticketsQuery += ` AND (${customerClauses.join(' OR ')})`;
  }

  if (input.agentId) {
    ticketsQuery += ` AND assigned_to = $${paramIndex}`;
    params.push(input.agentId);
    paramIndex += 1;
  }

  if (input.status) {
    ticketsQuery += ` AND status = $${paramIndex}`;
    params.push(input.status);
    paramIndex += 1;
  }

  ticketsQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(input.limit, input.offset);

  return { sql: ticketsQuery, params };
}
