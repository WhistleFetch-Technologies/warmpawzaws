"use client";

import { ExternalLink } from "lucide-react";
import {
  isImageSupportAttachment,
  type SupportTicketAttachmentView,
} from "@/lib/support-ticket-attachments";

export function SupportAttachmentList({
  attachments,
  compact = false,
}: {
  attachments: SupportTicketAttachmentView[];
  compact?: boolean;
}) {
  if (!attachments.length) return null;

  return (
    <ul className={`space-y-2 ${compact ? "mt-2" : "mt-2"}`}>
      {attachments.map((att, i) => (
        <li key={`${att.url}-${i}`}>
          {isImageSupportAttachment(att) ? (
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group cursor-pointer"
            >
              <img
                src={att.url}
                alt={att.name}
                className={`rounded-xl border border-gray-200 object-cover bg-gray-50 ${
                  compact ? "max-h-36 max-w-full" : "max-h-44 w-full"
                }`}
              />
              <span className="text-[10px] text-[#FF8C42] group-hover:underline mt-1 inline-flex items-center gap-1">
                {att.name}
                <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          ) : (
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#FF8C42] hover:underline inline-flex items-center gap-1 break-all cursor-pointer"
            >
              {att.name}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
