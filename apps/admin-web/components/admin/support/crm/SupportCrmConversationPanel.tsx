"use client";

import {
	MessageSquare,
	Headphones,
	Send,
	RefreshCw,
	Zap,
} from "lucide-react";
import { Badge, Button, Textarea } from "@warmpawz/ui";
import type { DetailTab, Ticket, TicketActivity, TicketMessage } from "./types";
import { getPriorityColor, getStatusColor, initialRequestAttachments } from "./crm-utils";
import { SupportAttachmentList } from "./SupportAttachmentList";
import { SavedReplyTemplatePicker } from "./SavedReplyTemplatePicker";

interface SupportCrmConversationPanelProps {
	ticket: Ticket;
	detailTab: DetailTab;
	onDetailTabChange: (tab: DetailTab) => void;
	activityEntries: TicketActivity[];
	activityLoading: boolean;
	replyText: string;
	onReplyTextChange: (text: string) => void;
	onReply: () => void;
	suggestedReplies: string[];
	suggestLoading: boolean;
	onSuggestReplies: () => void;
}

function InternalNoteFromActivity({ entries }: { entries: TicketActivity[] }) {
	const notes = entries.filter((e) => e.eventType === "internal_note_added");
	if (notes.length === 0) return null;
	return (
		<div className="space-y-2">
			{notes.map((note) => (
				<div
					key={note.id}
					className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm"
				>
					<div className="flex justify-between text-xs text-amber-700 mb-1">
						<span className="font-semibold">Internal note</span>
						<span>{new Date(note.createdAt).toLocaleString()}</span>
					</div>
					<p className="text-amber-900 whitespace-pre-wrap">
						{String(note.eventMetadata?.message ?? note.eventTitle)}
					</p>
				</div>
			))}
		</div>
	);
}

export function SupportCrmConversationPanel({
	ticket,
	detailTab,
	onDetailTabChange,
	activityEntries,
	activityLoading,
	replyText,
	onReplyTextChange,
	onReply,
	suggestedReplies,
	suggestLoading,
	onSuggestReplies,
}: SupportCrmConversationPanelProps) {
	const canReply =
		detailTab === "conversation" &&
		ticket.status !== "resolved" &&
		ticket.status !== "closed";

	const systemMessages = (ticket.messages || []).filter((m) => m.role === "system");
	const threadMessages = (ticket.messages || []).filter((m) => m.role !== "system");
	const initialAttachments = initialRequestAttachments(ticket.metadata);

	return (
		<div className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-50/50">
			<div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
				<div className="flex items-center gap-2 flex-wrap mb-1">
					<span className="text-xs font-mono text-gray-400">#{ticket.id.slice(0, 8)}</span>
					<Badge className={`${getStatusColor(ticket.status)} text-xs`}>
						{ticket.status.replace(/_/g, " ")}
					</Badge>
					<Badge className={`${getPriorityColor(ticket.priority)} text-xs border`}>
						{ticket.priority.toUpperCase()}
					</Badge>
				</div>
				<h2 className="text-base font-bold text-gray-900 truncate">{ticket.subject}</h2>
			</div>

			<div className="shrink-0 flex gap-1 px-4 pt-2 bg-white border-b border-gray-100">
				{(["conversation", "activity"] as DetailTab[]).map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => onDetailTabChange(tab)}
						className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
							detailTab === tab
								? "border-[#FF8C42] text-[#FF8C42]"
								: "border-transparent text-gray-500 hover:text-gray-700"
						}`}
					>
						{tab === "conversation" ? "Conversation" : "Activity Timeline"}
					</button>
				))}
			</div>

			<div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
				{detailTab === "conversation" ? (
					<>
						<div className="bg-gradient-to-br from-[#FFF3E8] to-white border border-[#FF8C42]/20 rounded-lg p-4">
							<div className="flex items-center gap-2 mb-2">
								<MessageSquare className="w-4 h-4 text-[#FF8C42]" />
								<h4 className="text-xs font-bold text-gray-800">Original request</h4>
								<span className="text-[10px] text-gray-400 ml-auto">
									{new Date(ticket.createdAt).toLocaleString()}
								</span>
							</div>
							<p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
								{ticket.description}
							</p>
							{initialAttachments.length > 0 ? (
								<SupportAttachmentList attachments={initialAttachments} compact />
							) : null}
						</div>

						{systemMessages.map((msg) => (
							<MessageBubble key={msg.id} msg={msg} />
						))}

						{ticket.aiConversation && ticket.aiConversation.length > 0 && (
							<details className="bg-white border border-indigo-100 rounded-lg p-3">
								<summary className="text-xs font-bold text-gray-800 cursor-pointer flex items-center gap-2">
									<Headphones className="w-3.5 h-3.5 text-indigo-500" />
									AI transcript (pre-handoff)
								</summary>
								<div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
									{ticket.aiConversation.map((row, idx) => (
										<div
											key={String(row.id ?? row.created_at ?? idx)}
											className="text-xs border-l-2 border-indigo-200 pl-2"
										>
											<p className="text-gray-500 font-semibold">Customer</p>
											<p className="text-gray-800 whitespace-pre-wrap">
												{String(row.user_message ?? "")}
											</p>
											<p className="text-gray-500 font-semibold mt-1">Assistant</p>
											<p className="text-gray-700 whitespace-pre-wrap">
												{String(row.bot_response ?? "")}
											</p>
										</div>
									))}
								</div>
							</details>
						)}

						<InternalNoteFromActivity entries={activityEntries} />

						{threadMessages.map((msg) => (
							<MessageBubble key={msg.id} msg={msg} />
						))}

						{threadMessages.length === 0 && systemMessages.length === 0 && (
							<div className="text-center py-6 text-gray-400 text-sm">No responses yet</div>
						)}
					</>
				) : (
					<div className="space-y-0">
						{activityLoading ? (
							<div className="text-center py-8 text-gray-500 text-sm">Loading activity…</div>
						) : activityEntries.length === 0 ? (
							<div className="text-center py-8 text-gray-400 text-sm">No activity recorded yet</div>
						) : (
							activityEntries.map((entry, idx) => (
								<div key={entry.id} className="flex gap-3 pb-5 relative">
									{idx < activityEntries.length - 1 && (
										<span className="absolute left-[6px] top-5 bottom-0 w-px bg-gray-200" />
									)}
									<div className="w-3 h-3 mt-1 rounded-full bg-[#FF8C42] shrink-0 z-10" />
									<div>
										<p className="text-[10px] text-gray-400 mb-0.5">
											{new Date(entry.createdAt).toLocaleString()}
										</p>
										<p className="text-sm font-medium text-gray-900">{entry.eventTitle}</p>
										{entry.eventActorType && (
											<p className="text-xs text-gray-500">{entry.eventActorType}</p>
										)}
									</div>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{canReply && (
				<div className="shrink-0 bg-white border-t border-gray-200 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
					<div className="flex flex-wrap items-center gap-2 mb-2">
						<SavedReplyTemplatePicker
							onInsert={(content) => {
								onReplyTextChange(
									replyText.trim() ? `${replyText.trim()}\n\n${content}` : content
								);
							}}
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
							disabled={suggestLoading}
							onClick={() => void onSuggestReplies()}
						>
							{suggestLoading ? (
								<>
									<RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
									Suggesting…
								</>
							) : (
								<>
									<Zap className="w-3.5 h-3.5 mr-1" />
									Suggest replies
								</>
							)}
						</Button>
					</div>
					{suggestedReplies.length > 0 && (
						<div className="flex flex-col gap-1.5 mb-2 max-h-24 overflow-y-auto">
							{suggestedReplies.map((s, i) => (
								<button
									key={i}
									type="button"
									className="text-left text-xs p-2 rounded border border-gray-200 bg-gray-50 hover:bg-indigo-50 text-gray-800"
									onClick={() => onReplyTextChange(s)}
								>
									{s}
								</button>
							))}
						</div>
					)}
					<div className="flex gap-2 items-end">
						<Textarea
							value={replyText}
							onChange={(e) => onReplyTextChange(e.target.value)}
							placeholder="Type your reply… (Ctrl+Enter to send)"
							className="flex-1 min-h-[72px] max-h-[120px] resize-none text-sm border-gray-200 focus:border-[#FF8C42]"
							onKeyDown={(e) => {
								if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
									e.preventDefault();
									onReply();
								}
							}}
						/>
						<Button
							onClick={onReply}
							disabled={!replyText.trim()}
							className="bg-[#FF8C42] hover:bg-[#E07830] text-white shrink-0 h-10"
						>
							<Send className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function MessageBubble({ msg }: { msg: TicketMessage }) {
	return (
		<div
			className={`flex ${
				msg.role === "agent"
					? "justify-end"
					: msg.role === "system"
						? "justify-center"
						: "justify-start"
			}`}
		>
			<div
				className={`max-w-[85%] rounded-xl p-3 shadow-sm ${
					msg.role === "agent"
						? "bg-gradient-to-br from-[#FF8C42] to-[#E07830] text-white rounded-tr-sm"
						: msg.role === "system"
							? "bg-indigo-50 border border-indigo-100 text-indigo-900"
							: "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
				}`}
			>
				<div
					className={`flex justify-between items-center mb-1 text-[10px] gap-3 ${
						msg.role === "agent"
							? "text-white/80"
							: msg.role === "system"
								? "text-indigo-600"
								: "text-gray-400"
					}`}
				>
					<span className="font-semibold">{msg.sender}</span>
					<span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
				</div>
				<p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
				{msg.attachments && msg.attachments.length > 0 ? (
					<SupportAttachmentList attachments={msg.attachments} compact />
				) : null}
			</div>
		</div>
	);
}
