/** View model for support ticket files in customer/admin UIs. */
export type SupportTicketAttachmentView = {
  name: string;
  url: string;
  type?: string;
};

export function isImageSupportAttachment(att: SupportTicketAttachmentView): boolean {
  if (att.type?.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(att.name || att.url);
}

export function isAttachmentOnlyMessage(text: string): boolean {
  return text.trim().toLowerCase() === '(attachment)';
}

export function attachmentsForResponse(
  metadata: Record<string, unknown> | undefined,
  responseId: string
): SupportTicketAttachmentView[] {
  if (!metadata?.response_attachments || typeof metadata.response_attachments !== 'object') {
    return [];
  }
  const map = metadata.response_attachments as Record<string, unknown>;
  const list = map[responseId];
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => normalizeAttachment(raw))
    .filter(Boolean) as SupportTicketAttachmentView[];
}

/** Files on the original ticket (not tied to a follow-up response). */
export function initialRequestAttachments(
  metadata: Record<string, unknown> | undefined
): SupportTicketAttachmentView[] {
  if (!metadata?.attachments || !Array.isArray(metadata.attachments)) return [];

  const linked = new Set<string>();
  const responseAttachments = metadata.response_attachments;
  if (
    responseAttachments &&
    typeof responseAttachments === 'object' &&
    !Array.isArray(responseAttachments)
  ) {
    for (const list of Object.values(responseAttachments as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        const att = normalizeAttachment(raw);
        if (att?.url) linked.add(att.url);
      }
    }
  }

  return metadata.attachments
    .map((raw) => normalizeAttachment(raw))
    .filter((att): att is SupportTicketAttachmentView => Boolean(att && att.url && !linked.has(att.url)));
}

function normalizeAttachment(raw: unknown): SupportTicketAttachmentView | null {
  if (!raw || typeof raw !== 'object') return null;
  const att = raw as Record<string, unknown>;
  const url = String(att.displayUrl || att.url || '').trim();
  if (!url) return null;
  return {
    name: String(att.name || att.filename || 'Attachment'),
    url,
    type: att.type ? String(att.type) : undefined,
  };
}
