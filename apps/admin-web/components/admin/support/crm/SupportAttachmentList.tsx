"use client";

import { ExternalLink } from "lucide-react";
import type { TicketAttachmentView } from "./crm-utils";
import { isImageAttachment } from "./crm-utils";

export function SupportAttachmentList({
	attachments,
	compact = false,
}: {
	attachments: TicketAttachmentView[];
	compact?: boolean;
}) {
	if (!attachments.length) return null;

	return (
		<ul className={`space-y-2 ${compact ? "mt-2" : ""}`}>
			{attachments.map((att, i) => (
				<li key={`${att.url}-${i}`}>
					{isImageAttachment(att) ? (
						<a
							href={att.url}
							target="_blank"
							rel="noopener noreferrer"
							className="block group cursor-pointer"
						>
							<img
								src={att.url}
								alt={att.name}
								className={`rounded-lg border border-gray-200 object-cover bg-gray-50 ${
									compact ? "max-h-32 max-w-full" : "max-h-40 w-full"
								}`}
							/>
							<span className="text-[10px] text-blue-600 group-hover:underline mt-1 inline-flex items-center gap-1">
								{att.name}
								<ExternalLink className="w-3 h-3" />
							</span>
						</a>
					) : (
						<a
							href={att.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 break-all cursor-pointer"
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
