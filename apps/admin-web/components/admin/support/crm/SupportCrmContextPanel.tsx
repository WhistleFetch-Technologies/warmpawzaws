"use client";

import type { ReactNode } from "react";
import {
	User,
	Calendar,
	CheckCircle,
	RefreshCw,
	UserPlus,
	Zap,
	ArrowUpRight,
	Link2,
	IndianRupee,
	FileCheck,
	Headphones,
	Paperclip,
	Clock,
	Sparkles,
	UtensilsCrossed,
} from "lucide-react";
import { Badge, Button, Card } from "@warmpawz/ui";
import type { Agent, Ticket, TicketActivity } from "./types";
import {
	assigneeDisplayLabel,
	canProcessRefund,
	getStatusColor,
	isBookingTicket,
	isMealOrderTicket,
	isLinkedOrderTicket,
	resolveCustomerDisplayName,
	resolveVendorPhone,
	ticketHasAssignee,
} from "./crm-utils";

interface SupportCrmContextPanelProps {
	ticket: Ticket;
	agents: Agent[];
	activityEntries: TicketActivity[];
	activityLoading: boolean;
	onCloseTicket: () => void;
	onReopen: () => void;
	onEscalate: () => void;
	onAutoRoute: () => void;
	onShowAssignModal: () => void;
	onShowAttachBookingModal: () => void;
	onShowRefundModal: () => void;
	onShowPartialRefundModal: () => void;
	onShowCompletePlanModal: () => void;
	onViewFullActivity: () => void;
}

export function SupportCrmContextPanel({
	ticket,
	agents,
	activityEntries,
	activityLoading,
	onCloseTicket,
	onReopen,
	onEscalate,
	onAutoRoute,
	onShowAssignModal,
	onShowAttachBookingModal,
	onShowRefundModal,
	onShowPartialRefundModal,
	onShowCompletePlanModal,
	onViewFullActivity,
}: SupportCrmContextPanelProps) {
	const attachments = Array.isArray(ticket.metadata?.attachments)
		? (ticket.metadata!.attachments as Array<Record<string, unknown>>)
		: [];

	const aiInsights = ticket.aiConversation?.slice(-1)[0];
	const recentActivity = activityEntries.slice(0, 5);

	return (
		<div className="w-[340px] xl:w-[380px] shrink-0 border-l border-gray-200 bg-white flex flex-col min-h-0">
			<div className="shrink-0 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
				<h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Context</h3>
			</div>

			<div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
				<Section title="Customer" icon={<User className="w-3.5 h-3.5" />}>
					<p className="text-sm font-medium text-gray-900">
						{resolveCustomerDisplayName(ticket)}
					</p>
					{ticket.customerEmail && (
						<p className="text-xs text-gray-500 break-all">{ticket.customerEmail}</p>
					)}
					<ContactPhone phone={ticket.customerPhone} />
					<p className="text-[10px] font-mono text-gray-400 mt-1">{ticket.customerId}</p>
					<div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
						<Clock className="w-3 h-3" />
						{new Date(ticket.createdAt).toLocaleString()}
					</div>
					{ticketHasAssignee(ticket) && (
						<div className="mt-2 flex items-center gap-1.5 text-xs text-[#FF8C42] bg-[#FFF3E8] px-2 py-1 rounded">
							<Headphones className="w-3 h-3" />
							{assigneeDisplayLabel(ticket, agents)}
						</div>
					)}
				</Section>

				{isMealOrderTicket(ticket) && (
					<Section title="Meal order" icon={<UtensilsCrossed className="w-3.5 h-3.5" />}>
						{ticket.mealOrderContext ? (
							<div className="space-y-1 text-xs">
								<Row label="Plan" value={ticket.mealOrderContext.planTitle} />
								<Row label="Status" value={ticket.mealOrderContext.status} />
								<Row label="Delivery" value={ticket.mealOrderContext.deliveryStatus} />
								<Row label="Vendor" value={ticket.mealOrderContext.vendorName} />
								<Row
									label="Amount"
									value={
										ticket.mealOrderContext.totalAmount != null
											? `₹${ticket.mealOrderContext.totalAmount}`
											: undefined
									}
								/>
								{ticket.mealOrderContext.orderNumber ? (
									<p className="font-mono text-[10px] text-gray-500 break-all pt-1">
										{ticket.mealOrderContext.orderNumber}
									</p>
								) : null}
								<p className="font-mono text-[10px] text-gray-500 break-all">
									{ticket.mealOrderId || ticket.mealOrderContext.id}
								</p>
							</div>
						) : (
							<p className="text-xs font-mono text-gray-600 break-all">{ticket.mealOrderId}</p>
						)}
					</Section>
				)}

				{isBookingTicket(ticket) && (
					<Section title="Booking" icon={<Calendar className="w-3.5 h-3.5" />}>
						{ticket.bookingContext ? (
							<div className="space-y-1 text-xs">
								<Row label="Service" value={ticket.bookingContext.serviceName} />
								<Row label="Status" value={ticket.bookingContext.status} />
								<Row label="Vendor" value={ticket.bookingContext.vendorName} />
								<Row
									label="Schedule"
									value={`${ticket.bookingContext.scheduledDate || "—"} ${ticket.bookingContext.scheduledTime || ""}`.trim()}
								/>
								<Row
									label="Amount"
									value={
										ticket.bookingContext.amount != null
											? `₹${ticket.bookingContext.amount}`
											: undefined
									}
								/>
								<p className="font-mono text-[10px] text-gray-500 break-all pt-1">
									{ticket.bookingId}
								</p>
							</div>
						) : (
							<p className="text-xs font-mono text-gray-600 break-all">{ticket.bookingId}</p>
						)}
					</Section>
				)}

				{(ticket.vendorId ||
					ticket.bookingContext?.vendorName ||
					ticket.mealOrderContext?.vendorName ||
					resolveVendorPhone(ticket)) && (
					<Section title="Vendor" icon={<User className="w-3.5 h-3.5" />}>
						<p className="text-sm text-gray-900">
							{ticket.bookingContext?.vendorName ||
								ticket.mealOrderContext?.vendorName ||
								"Linked vendor"}
						</p>
						<ContactPhone phone={resolveVendorPhone(ticket)} />
						{ticket.vendorId && (
							<p className="text-[10px] font-mono text-gray-500 break-all">{ticket.vendorId}</p>
						)}
					</Section>
				)}

				<Section title="Payment & refund" icon={<IndianRupee className="w-3.5 h-3.5" />}>
					{ticket.paymentContext ? (
						<div className="space-y-1 text-xs">
							<Row label="Paid" value={`₹${ticket.paymentContext.totalPaid.toFixed(2)}`} />
							<Row
								label="Wallet / Gateway"
								value={`₹${ticket.paymentContext.walletPaid.toFixed(2)} / ₹${ticket.paymentContext.gatewayPaid.toFixed(2)}`}
							/>
							<Row
								label="Refunded"
								value={`₹${ticket.paymentContext.refundedSoFar.toFixed(2)}`}
							/>
							<p className="font-semibold text-green-800 pt-1">
								Refundable: ₹{ticket.paymentContext.refundableBalance.toFixed(2)}
							</p>
							{ticket.paymentContext.razorpayPaymentId && (
								<p className="font-mono text-[10px] text-gray-500 break-all">
									{ticket.paymentContext.razorpayPaymentId}
								</p>
							)}
						</div>
					) : (
						<p className="text-xs text-amber-800">
							{ticket.refundBlockReason || "No payment data"}
						</p>
					)}
					{ticket.metadata?.refund_result != null && (
						<div className="mt-2 p-2 rounded bg-gray-50 border text-xs">
							{(() => {
								const rr = ticket.metadata?.refund_result as Record<string, unknown>;
								return (
									<>
										<p>
											<span className="text-gray-500">Status:</span> {String(rr.status ?? "—")}
										</p>
										{rr.amount != null && (
											<p>
												<span className="text-gray-500">Amount:</span> ₹
												{Number(rr.amount).toFixed(2)}
											</p>
										)}
									</>
								);
							})()}
						</div>
					)}
				</Section>

				{attachments.length > 0 && (
					<Section title="Attachments" icon={<Paperclip className="w-3.5 h-3.5" />}>
						<ul className="space-y-1">
							{attachments.map((att, i) => (
								<li key={i} className="text-xs text-blue-600 truncate">
									{String(att.name ?? att.url ?? att.filename ?? `Attachment ${i + 1}`)}
								</li>
							))}
						</ul>
					</Section>
				)}

				{aiInsights && (
					<Section title="AI insights" icon={<Sparkles className="w-3.5 h-3.5" />}>
						{aiInsights.intent != null && (
							<p className="text-xs">
								<span className="text-gray-500">Intent:</span> {String(aiInsights.intent)}
							</p>
						)}
						{aiInsights.confidence != null && (
							<p className="text-xs">
								<span className="text-gray-500">Confidence:</span>{" "}
								{String(aiInsights.confidence)}
							</p>
						)}
						{ticket.status === "ai_acknowledged" && (
							<Badge className="mt-1 text-[10px] bg-indigo-100 text-indigo-700">
								AI acknowledgement sent
							</Badge>
						)}
					</Section>
				)}

				<Section title="Latest activity" icon={<Clock className="w-3.5 h-3.5" />}>
					{activityLoading ? (
						<p className="text-xs text-gray-500">Loading…</p>
					) : recentActivity.length === 0 ? (
						<p className="text-xs text-gray-400">No activity yet</p>
					) : (
						<ul className="space-y-2">
							{recentActivity.map((entry) => (
								<li key={entry.id} className="text-xs border-l-2 border-[#FF8C42]/40 pl-2">
									<p className="text-[10px] text-gray-400">
										{new Date(entry.createdAt).toLocaleString()}
									</p>
									<p className="text-gray-800 font-medium">{entry.eventTitle}</p>
								</li>
							))}
						</ul>
					)}
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs mt-1 text-[#FF8C42]"
						onClick={onViewFullActivity}
					>
						View full timeline →
					</Button>
				</Section>

				{!isLinkedOrderTicket(ticket) && (
					<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
						General inquiry — link a booking or meal order to enable refunds.
					</div>
				)}
			</div>

			<div className="shrink-0 border-t border-gray-200 p-3 space-y-2 bg-gray-50/50">
				<p className="text-[10px] font-bold text-gray-500 uppercase">Actions</p>
				<div className="flex flex-wrap gap-1.5">
					{ticket.status !== "resolved" && ticket.status !== "closed" && (
						<ActionBtn
							icon={<CheckCircle className="w-3 h-3" />}
							label="Resolve"
							onClick={onCloseTicket}
							className="bg-green-600 hover:bg-green-700 text-white border-0"
						/>
					)}
					{(ticket.status === "resolved" || ticket.status === "closed") && (
						<ActionBtn
							icon={<RefreshCw className="w-3 h-3" />}
							label="Reopen"
							onClick={onReopen}
						/>
					)}
					{!ticketHasAssignee(ticket) ? (
						<>
							<ActionBtn
								icon={<UserPlus className="w-3 h-3" />}
								label="Assign"
								onClick={onShowAssignModal}
							/>
							<ActionBtn
								icon={<Zap className="w-3 h-3" />}
								label="Auto route"
								onClick={onAutoRoute}
							/>
						</>
					) : (
						<ActionBtn
							icon={<UserPlus className="w-3 h-3" />}
							label="Reassign"
							onClick={onShowAssignModal}
						/>
					)}
					{ticket.status !== "escalated" && (
						<ActionBtn
							icon={<ArrowUpRight className="w-3 h-3" />}
							label="Escalate"
							onClick={onEscalate}
							className="text-red-600 border-red-200 hover:bg-red-50"
						/>
					)}
					{!isLinkedOrderTicket(ticket) && (
						<ActionBtn
							icon={<Link2 className="w-3 h-3" />}
							label="Attach booking"
							onClick={onShowAttachBookingModal}
						/>
					)}
					{canProcessRefund(ticket) ? (
						<>
							<ActionBtn
								icon={<IndianRupee className="w-3 h-3" />}
								label="Partial"
								onClick={onShowPartialRefundModal}
							/>
							<ActionBtn
								icon={<IndianRupee className="w-3 h-3" />}
								label="Full refund"
								onClick={onShowRefundModal}
								className="text-red-600 border-red-200 hover:bg-red-50"
							/>
						</>
					) : null}
					<ActionBtn
						icon={<FileCheck className="w-3 h-3" />}
						label="Care plan"
						onClick={onShowCompletePlanModal}
					/>
				</div>
				<div className="flex flex-wrap gap-1 pt-1">
					<Badge className={`text-[10px] ${getStatusColor(ticket.status)}`}>
						{ticket.status.replace(/_/g, " ")}
					</Badge>
					<Badge variant="outline" className="text-[10px] uppercase">
						{ticket.source}
					</Badge>
					{ticket.category && (
						<Badge variant="outline" className="text-[10px]">
							{ticket.category}
						</Badge>
					)}
				</div>
			</div>
		</div>
	);
}

function Section({
	title,
	icon,
	children,
}: {
	title: string;
	icon: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card className="p-3 border border-gray-100 shadow-none">
			<h4 className="text-[11px] font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
				{icon}
				{title}
			</h4>
			{children}
		</Card>
	);
}

function Row({ label, value }: { label: string; value?: string | null }) {
	return (
		<p>
			<span className="text-gray-500">{label}:</span> {value || "—"}
		</p>
	);
}

function ContactPhone({ phone }: { phone?: string | null }) {
	const display = phone?.trim();
	if (!display) return null;
	const tel = display.replace(/[^\d+]/g, "");
	return (
		<p className="text-xs mt-1">
			<span className="text-gray-500">Phone:</span>{" "}
			<a href={`tel:${tel}`} className="text-[#FF8C42] hover:underline font-medium">
				{display}
			</a>
		</p>
	);
}

function ActionBtn({
	icon,
	label,
	onClick,
	className = "",
}: {
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	className?: string;
}) {
	return (
		<Button
			size="sm"
			variant="outline"
			className={`h-7 text-[11px] px-2 ${className}`}
			onClick={onClick}
		>
			{icon}
			<span className="ml-1">{label}</span>
		</Button>
	);
}
