"use client";

import {
	Search,
	Ticket,
	User,
	Tag,
	Paperclip,
	Zap,
} from "lucide-react";
import { Badge, Input } from "@warmpawz/ui";
import type { Agent, CRMStats, QueueView, Ticket as SupportTicket } from "./types";
import {
	assigneeDisplayLabel,
	formatRelativeTime,
	getAttachmentCount,
	getPriorityColor,
	getStatusColor,
	hasAiUrgency,
	isBookingTicket,
	ticketHasAssignee,
	ticketLastUpdated,
} from "./crm-utils";

const QUEUE_FILTERS: { value: QueueView; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "unassigned", label: "Unassigned" },
	{ value: "assigned_to_me", label: "Assigned To Me" },
	{ value: "booking", label: "Booking" },
	{ value: "general", label: "General" },
	{ value: "escalated", label: "Escalated" },
	{ value: "refunds", label: "Refunds" },
];

interface SupportCrmQueuePanelProps {
	tickets: SupportTicket[];
	selectedTicketId?: string;
	queueView: QueueView;
	searchQuery: string;
	stats: CRMStats;
	agents: Agent[];
	onQueueViewChange: (view: QueueView) => void;
	onSearchChange: (query: string) => void;
	onSelectTicket: (ticket: SupportTicket) => void;
	getFilterCount: (view: QueueView) => number;
}

export function SupportCrmQueuePanel({
	tickets,
	selectedTicketId,
	queueView,
	searchQuery,
	stats,
	agents,
	onQueueViewChange,
	onSearchChange,
	onSelectTicket,
	getFilterCount,
}: SupportCrmQueuePanelProps) {
	return (
		<div className="w-[280px] shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-0">
			<div className="p-3 border-b border-gray-100 bg-gray-50/50 space-y-2.5 shrink-0">
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<Input
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Search tickets…"
						className="pl-8 h-9 text-sm border-gray-200"
					/>
				</div>

				<div className="flex flex-wrap gap-1.5">
					{QUEUE_FILTERS.map((filter) => (
						<button
							key={filter.value}
							type="button"
							onClick={() => onQueueViewChange(filter.value)}
							className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
								queueView === filter.value
									? "bg-[#FF8C42] text-white shadow-sm"
									: "bg-white text-gray-600 border border-gray-200 hover:border-[#FF8C42]/40"
							}`}
						>
							{filter.label}
							<span
								className={`px-1 rounded text-[10px] ${
									queueView === filter.value ? "bg-white/20" : "bg-gray-100 text-gray-500"
								}`}
							>
								{getFilterCount(filter.value)}
							</span>
						</button>
					))}
				</div>

				<div className="flex gap-2 text-[10px] text-gray-500 pt-0.5">
					<span>Open {stats.openTickets}</span>
					<span>·</span>
					<span>In progress {stats.inProgressTickets}</span>
					<span>·</span>
					<span>Refunds {stats.pendingRefunds}</span>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto min-h-0">
				{tickets.length === 0 ? (
					<div className="p-6 text-center">
						<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
							<Ticket className="w-6 h-6 text-gray-300" />
						</div>
						<p className="text-gray-500 text-sm font-medium">No tickets found</p>
						<p className="text-xs text-gray-400 mt-1">Try another filter or search</p>
					</div>
				) : (
					tickets.map((ticket) => {
						const attachmentCount = getAttachmentCount(ticket);
						const urgent = hasAiUrgency(ticket);
						return (
							<div
								key={ticket.id}
								onClick={() => onSelectTicket(ticket)}
								className={`p-3 border-b border-gray-100 cursor-pointer transition-all hover:bg-[#FFF3E8]/40 ${
									selectedTicketId === ticket.id
										? "bg-[#FFF3E8] border-l-[3px] border-l-[#FF8C42]"
										: "hover:border-l-[3px] hover:border-l-[#FF8C42]/30"
								}`}
							>
								<div className="flex justify-between items-start gap-2 mb-1.5">
									<div className="flex flex-wrap items-center gap-1 min-w-0">
										{urgent && (
											<span
												className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200"
												title="AI urgency / high priority"
											>
												<Zap className="w-3 h-3" />
												AI
											</span>
										)}
										<span
											className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}
										>
											{ticket.status.replace(/_/g, " ")}
										</span>
										<span
											className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getPriorityColor(ticket.priority)}`}
										>
											{ticket.priority}
										</span>
									</div>
									<span className="text-[10px] text-gray-400 shrink-0">
										{formatRelativeTime(ticketLastUpdated(ticket))}
									</span>
								</div>

								<h3 className="font-semibold text-sm text-gray-900 truncate mb-0.5">
									{ticket.subject}
								</h3>
								<p className="text-xs text-gray-500 line-clamp-1">{ticket.description}</p>

								<div className="mt-2 flex items-center justify-between gap-2">
									<div className="flex items-center gap-1.5 min-w-0">
										{isBookingTicket(ticket) && (
											<span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
												Booking
											</span>
										)}
										{attachmentCount > 0 && (
											<span className="flex items-center gap-0.5 text-[10px] text-gray-500">
												<Paperclip className="w-3 h-3" />
												{attachmentCount}
											</span>
										)}
										{ticket.category && (
											<span className="flex items-center gap-0.5 text-[10px] text-gray-400 truncate">
												<Tag className="w-3 h-3 shrink-0" />
												{ticket.category}
											</span>
										)}
									</div>
									{ticketHasAssignee(ticket) ? (
										<Badge
											variant="outline"
											className="text-[10px] h-5 px-1.5 border-[#FF8C42]/30 text-[#FF8C42] bg-[#FFF3E8] shrink-0"
										>
											<User className="w-2.5 h-2.5 mr-0.5" />
											<span className="truncate max-w-[72px]">
												{assigneeDisplayLabel(ticket, agents)}
											</span>
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="text-[10px] h-5 px-1.5 border-red-200 text-red-600 bg-red-50 shrink-0"
										>
											Unassigned
										</Badge>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
