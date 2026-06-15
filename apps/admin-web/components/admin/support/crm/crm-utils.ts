import type { Agent, Ticket } from "./types";

export const BRAND_ORANGE = "#FF8C42";

export function getStatusColor(status: string): string {
	switch (status) {
		case "open":
			return "bg-red-100 text-red-700";
		case "ai_acknowledged":
			return "bg-indigo-100 text-indigo-700";
		case "awaiting_assignment":
			return "bg-orange-100 text-orange-700";
		case "assigned":
			return "bg-blue-100 text-blue-700";
		case "in_progress":
			return "bg-yellow-100 text-yellow-700";
		case "waiting_for_customer":
			return "bg-purple-100 text-purple-700";
		case "escalated":
			return "bg-rose-100 text-rose-800";
		case "resolved":
			return "bg-green-100 text-green-700";
		case "closed":
			return "bg-gray-200 text-gray-700";
		default:
			return "bg-gray-100 text-gray-700";
	}
}

export function getPriorityColor(priority: string): string {
	switch (priority) {
		case "urgent":
			return "bg-red-100 text-red-700 border-red-200";
		case "high":
			return "bg-orange-100 text-orange-700 border-orange-200";
		case "medium":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "low":
			return "bg-green-100 text-green-700 border-green-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

export function isMealOrderTicket(t: Ticket | null | undefined): boolean {
	return t?.ticketType === "meal_order" || Boolean(t?.mealOrderId);
}

export function isBookingTicket(t: Ticket | null | undefined): boolean {
	return t?.ticketType === "booking" || Boolean(t?.bookingId);
}

export function isLinkedOrderTicket(t: Ticket | null | undefined): boolean {
	return isBookingTicket(t) || isMealOrderTicket(t);
}

export function canProcessRefund(t: Ticket | null | undefined): boolean {
	return Boolean(t?.isRefundable);
}

export function ticketHasAssignee(t: Ticket | null | undefined): boolean {
	return Boolean(t && (t.assignedTo || t.assignedAgent));
}

/** Queue badge when ticket has no human assignee yet. */
export function ticketQueueAssigneeBadge(t: Ticket): {
	label: string;
	className: string;
} {
	if (ticketHasAssignee(t)) {
		return {
			label: assigneeDisplayLabel(t, []),
			className: "border-[#FF8C42]/30 text-[#FF8C42] bg-[#FFF3E8]",
		};
	}
	if (
		t.status === "ai_acknowledged" ||
		t.status === "awaiting_assignment"
	) {
		return {
			label: "Awaiting agent",
			className: "border-amber-200 text-amber-700 bg-amber-50",
		};
	}
	return {
		label: "Unassigned",
		className: "border-red-200 text-red-600 bg-red-50",
	};
}

export function assigneeDisplayLabel(t: Ticket, agents: Agent[]): string {
	if (t.assignedAgent) return t.assignedAgent;
	if (t.assignedTo && agents.length) {
		const a = agents.find((x) => x.id === t.assignedTo);
		if (a?.name) return a.name;
	}
	if (t.assignedTo) return "Assigned";
	return "";
}

export function getAttachmentCount(ticket: Ticket): number {
	return collectTicketAttachments(ticket).length;
}

export type TicketAttachmentView = {
	name: string;
	url: string;
	type?: string;
};

export function collectTicketAttachments(ticket: Ticket): TicketAttachmentView[] {
	const meta = ticket.metadata;
	if (!meta) return [];
	const seen = new Set<string>();
	const out: TicketAttachmentView[] = [];

	const push = (raw: unknown) => {
		if (!raw || typeof raw !== "object") return;
		const att = raw as Record<string, unknown>;
		const url = String(att.displayUrl || att.url || "").trim();
		if (!url || seen.has(url)) return;
		seen.add(url);
		out.push({
			name: String(att.name || att.filename || "Attachment"),
			url,
			type: att.type ? String(att.type) : undefined,
		});
	};

	if (Array.isArray(meta.attachments)) {
		for (const att of meta.attachments) push(att);
	}

	const responseAttachments = meta.response_attachments;
	if (responseAttachments && typeof responseAttachments === "object" && !Array.isArray(responseAttachments)) {
		for (const list of Object.values(responseAttachments as Record<string, unknown>)) {
			if (Array.isArray(list)) for (const att of list) push(att);
		}
	}

	return out;
}

export function attachmentsForResponse(
	metadata: Record<string, unknown> | undefined,
	responseId: string
): TicketAttachmentView[] {
	if (!metadata?.response_attachments || typeof metadata.response_attachments !== "object") {
		return [];
	}
	const map = metadata.response_attachments as Record<string, unknown>;
	const list = map[responseId];
	if (!Array.isArray(list)) return [];
	return list
		.map((raw) => {
			if (!raw || typeof raw !== "object") return null;
			const att = raw as Record<string, unknown>;
			const url = String(att.displayUrl || att.url || "").trim();
			if (!url) return null;
			return {
				name: String(att.name || att.filename || "Attachment"),
				url,
				type: att.type ? String(att.type) : undefined,
			};
		})
		.filter(Boolean) as TicketAttachmentView[];
}

/** Attachments on ticket creation (not tied to a follow-up response). */
export function initialRequestAttachments(
	metadata: Record<string, unknown> | undefined
): TicketAttachmentView[] {
	if (!metadata?.attachments || !Array.isArray(metadata.attachments)) return [];

	const linked = new Set<string>();
	const responseAttachments = metadata.response_attachments;
	if (
		responseAttachments &&
		typeof responseAttachments === "object" &&
		!Array.isArray(responseAttachments)
	) {
		for (const list of Object.values(responseAttachments as Record<string, unknown>)) {
			if (!Array.isArray(list)) continue;
			for (const raw of list) {
				if (!raw || typeof raw !== "object") continue;
				const att = raw as Record<string, unknown>;
				const url = String(att.displayUrl || att.url || "").trim();
				if (url) linked.add(url);
			}
		}
	}

	return metadata.attachments
		.map((raw) => {
			if (!raw || typeof raw !== "object") return null;
			const att = raw as Record<string, unknown>;
			const url = String(att.displayUrl || att.url || "").trim();
			if (!url || linked.has(url)) return null;
			return {
				name: String(att.name || att.filename || "Attachment"),
				url,
				type: att.type ? String(att.type) : undefined,
			};
		})
		.filter(Boolean) as TicketAttachmentView[];
}

export function isImageAttachment(att: TicketAttachmentView): boolean {
	if (att.type?.startsWith("image/")) return true;
	return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(att.name || att.url);
}

export function formatRelativeTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	const diffMs = Date.now() - date.getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString();
}

export function ticketLastUpdated(ticket: Ticket): string {
	return ticket.lastUpdatedAt || ticket.createdAt;
}

export function isOpenTicketStatus(status: string): boolean {
	return status === "open" || status === "ai_acknowledged" || status === "awaiting_assignment";
}

export function isInProgressTicketStatus(status: string): boolean {
	return (
		status === "in_progress" ||
		status === "assigned" ||
		status === "waiting_for_customer"
	);
}

export function hasAiUrgency(ticket: Ticket): boolean {
	return (
		ticket.priority === "urgent" ||
		ticket.status === "ai_acknowledged" ||
		ticket.status === "awaiting_assignment" ||
		ticket.status === "escalated"
	);
}

export function matchesQueueView(
	ticket: Ticket,
	queueView: import("./types").QueueView,
	currentAdminId: string | null
): boolean {
	switch (queueView) {
		case "unassigned":
			return !ticketHasAssignee(ticket);
		case "assigned_to_me":
			if (!currentAdminId) return false;
			return ticket.assignedTo === currentAdminId;
		case "booking":
			return isBookingTicket(ticket);
		case "general":
			return !isLinkedOrderTicket(ticket);
		case "escalated":
			return ticket.status === "escalated";
		case "refunds":
			return Boolean(
				ticket.refundRequested ||
					ticket.isRefundable ||
					(ticket.refundStatus && ticket.refundStatus !== "completed")
			);
		default:
			return true;
	}
}

export function resolveCustomerDisplayName(ticket: Ticket): string {
	if (ticket.customerName?.trim()) return ticket.customerName.trim();
	const meta = ticket.metadata;
	if (meta && typeof meta === "object") {
		const bc = meta.booking_context as Record<string, unknown> | undefined;
		const bcName = bc?.customerName ?? bc?.customer_name;
		if (typeof bcName === "string" && bcName.trim()) return bcName.trim();
	}
	const aiMsg = ticket.messages?.find((m) => m.role === "system")?.content;
	if (aiMsg) {
		const m = aiMsg.match(/Dear\s+([^,\n]+),/i);
		if (m?.[1]?.trim()) return m[1].trim();
	}
	if (ticket.customerEmail?.trim()) return ticket.customerEmail.trim();
	if (ticket.customerId) return `Customer ${ticket.customerId.slice(0, 8)}…`;
	return "Unknown customer";
}

export function resolveVendorPhone(ticket: Ticket): string | null {
	const direct = ticket.vendorPhone?.trim();
	if (direct) return direct;
	const fromBooking = ticket.bookingContext?.vendorPhone?.trim();
	if (fromBooking) return fromBooking;
	const fromMeal = ticket.mealOrderContext?.vendorPhone?.trim();
	if (fromMeal) return fromMeal;
	return null;
}

export function matchesSearch(ticket: Ticket, query: string): boolean {
	if (!query.trim()) return true;
	const q = query.trim().toLowerCase();
	return (
		ticket.subject.toLowerCase().includes(q) ||
		ticket.description.toLowerCase().includes(q) ||
		ticket.id.toLowerCase().includes(q) ||
		(ticket.customerName?.toLowerCase().includes(q) ?? false) ||
		(ticket.bookingId?.toLowerCase().includes(q) ?? false) ||
		(ticket.mealOrderId?.toLowerCase().includes(q) ?? false) ||
		(ticket.customerEmail?.toLowerCase().includes(q) ?? false)
	);
}
