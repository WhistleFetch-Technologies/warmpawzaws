/**
 * Transactional copy for support ticket notifications (P0 fixed templates).
 */

export type SupportTicketTemplateContext = {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  category?: string;
  status?: string;
  customerName?: string;
  assigneeName?: string;
  reason?: string;
  messagePreview?: string;
  crmUrl: string;
  helpUrl: string;
};

function adminBaseUrl(): string {
  return (
    process.env.ADMIN_WEB_URL ||
    process.env.ADMIN_PORTAL_URL ||
    'https://dfof7mguaa0a5.cloudfront.net'
  ).replace(/\/$/, '');
}

function customerHelpBaseUrl(): string {
  return (
    process.env.CUSTOMER_WEB_URL ||
    process.env.CUSTOMER_PORTAL_URL ||
    'https://d2aoyjj8ine0wk.cloudfront.net'
  ).replace(/\/$/, '');
}

export function buildSupportTicketUrls(ticketId: string): { crmUrl: string; helpUrl: string } {
  return {
    crmUrl: `${adminBaseUrl()}/support?ticket=${encodeURIComponent(ticketId)}`,
    helpUrl: `${customerHelpBaseUrl()}/help`,
  };
}

export function buildTemplateContext(ticket: Record<string, unknown>): SupportTicketTemplateContext {
  const ticketId = String(ticket.id || '');
  const urls = buildSupportTicketUrls(ticketId);
  return {
    ticketId,
    ticketNumber: String(ticket.ticket_number || ticketId.slice(0, 8)),
    subject: String(ticket.subject || 'Support request'),
    priority: String(ticket.priority || 'medium'),
    category: ticket.category ? String(ticket.category) : undefined,
    status: ticket.status ? String(ticket.status) : undefined,
    customerName: String(ticket.customer_name || 'Customer'),
    crmUrl: urls.crmUrl,
    helpUrl: urls.helpUrl,
  };
}

export function renderOpsTicketCreatedEmail(ctx: SupportTicketTemplateContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Warmpawz Support] New ticket ${ctx.ticketNumber} — ${ctx.subject}`;
  const text = [
    `New support ticket ${ctx.ticketNumber}`,
    `Subject: ${ctx.subject}`,
    `Priority: ${ctx.priority}`,
    ctx.category ? `Category: ${ctx.category}` : '',
    ctx.customerName ? `Customer: ${ctx.customerName}` : '',
    ctx.messagePreview ? `Message: ${ctx.messagePreview}` : '',
    `Open in CRM: ${ctx.crmUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <h2>New support ticket</h2>
    <p><strong>${ctx.ticketNumber}</strong> — ${escapeHtml(ctx.subject)}</p>
    <ul>
      <li>Priority: ${escapeHtml(ctx.priority)}</li>
      ${ctx.category ? `<li>Category: ${escapeHtml(ctx.category)}</li>` : ''}
      ${ctx.customerName ? `<li>Customer: ${escapeHtml(ctx.customerName)}</li>` : ''}
    </ul>
    ${ctx.messagePreview ? `<p>${escapeHtml(ctx.messagePreview)}</p>` : ''}
    <p><a href="${ctx.crmUrl}">Open in CRM</a></p>
  `;

  return { subject, html, text };
}

export function renderOpsEscalationEmail(ctx: SupportTicketTemplateContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Warmpawz Escalation] ${ctx.priority} — ${ctx.ticketNumber} — ${ctx.subject}`;
  const text = [
    `Ticket escalated: ${ctx.ticketNumber}`,
    ctx.reason ? `Reason: ${ctx.reason}` : '',
    `Subject: ${ctx.subject}`,
    `Priority: ${ctx.priority}`,
    ctx.customerName ? `Customer: ${ctx.customerName}` : '',
    `Open in CRM: ${ctx.crmUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <h2>Support ticket escalated</h2>
    <p><strong>${ctx.ticketNumber}</strong> — ${escapeHtml(ctx.subject)}</p>
    ${ctx.reason ? `<p><strong>Reason:</strong> ${escapeHtml(ctx.reason)}</p>` : ''}
    <p>Priority: ${escapeHtml(ctx.priority)}</p>
    <p><a href="${ctx.crmUrl}">Open in CRM</a></p>
  `;

  return { subject, html, text };
}

export function renderAgentAssignedEmail(ctx: SupportTicketTemplateContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Warmpawz] Ticket assigned: ${ctx.ticketNumber}`;
  const text = [
    `You have been assigned ticket ${ctx.ticketNumber}.`,
    `Subject: ${ctx.subject}`,
    `Customer: ${ctx.customerName || '—'}`,
    `Open in CRM: ${ctx.crmUrl}`,
  ].join('\n');

  const html = `
    <h2>New ticket assigned to you</h2>
    <p><strong>${ctx.ticketNumber}</strong> — ${escapeHtml(ctx.subject)}</p>
    <p><a href="${ctx.crmUrl}">Open in CRM</a></p>
  `;

  return { subject, html, text };
}

export function renderAgentCustomerReplyEmail(ctx: SupportTicketTemplateContext): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Warmpawz] Customer replied — ${ctx.ticketNumber}`;
  const text = [
    `Customer replied on ticket ${ctx.ticketNumber}.`,
    ctx.messagePreview ? `Message: ${ctx.messagePreview}` : '',
    `Open in CRM: ${ctx.crmUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <h2>Customer replied</h2>
    <p>Ticket <strong>${ctx.ticketNumber}</strong></p>
    ${ctx.messagePreview ? `<p>${escapeHtml(ctx.messagePreview)}</p>` : ''}
    <p><a href="${ctx.crmUrl}">Open in CRM</a></p>
  `;

  return { subject, html, text };
}

export function renderCustomerAssignSms(ctx: SupportTicketTemplateContext): string {
  return `Warmpawz: Your support ticket ${ctx.ticketNumber} has been assigned to a specialist. Track updates in the app: ${ctx.helpUrl}`;
}

export function renderCustomerResolveSms(ctx: SupportTicketTemplateContext): string {
  return `Warmpawz: Your support ticket ${ctx.ticketNumber} has been resolved. Thank you for contacting us.`;
}

export function renderCustomerEscalationSms(ctx: SupportTicketTemplateContext): string {
  return `Warmpawz: Ticket ${ctx.ticketNumber} has been escalated to our senior support team. We will follow up shortly.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
