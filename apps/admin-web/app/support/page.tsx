"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
	MessageSquare,
	CheckCircle,
	Clock,
	RefreshCw,
	User,
	AlertTriangle,
	Ticket as TicketIcon,
	IndianRupee,
	BarChart3,
	UserPlus,
	Headphones,
	TrendingUp,
	Settings,
	Link2,
} from "lucide-react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Button,
	Input,
	Textarea,
	Badge,
	Card,
} from "@warmpawz/ui";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { CompletePlanModal } from "@/components/admin/support/CompletePlanModal";
import { SupportCrmQueuePanel } from "@/components/admin/support/crm/SupportCrmQueuePanel";
import { SupportCrmConversationPanel } from "@/components/admin/support/crm/SupportCrmConversationPanel";
import { SupportCrmContextPanel } from "@/components/admin/support/crm/SupportCrmContextPanel";
import { SupportCrmStatsBar } from "@/components/admin/support/crm/SupportCrmStatsBar";
import {
	isInProgressTicketStatus,
	isOpenTicketStatus,
} from "@/components/admin/support/crm/crm-utils";
import type {
	Agent,
	AgentMetrics,
	CRMStats,
	DetailTab,
	QueueView,
	Ticket,
	TicketActivity,
	TicketMessage,
} from "@/components/admin/support/crm/types";
import {
	attachmentsForResponse,
	isBookingTicket,
	matchesQueueView,
	matchesSearch,
	ticketHasAssignee,
} from "@/components/admin/support/crm/crm-utils";
import { getAdminId } from "@/lib/cognito-auth";
import { useRouter } from "next/navigation";
import { useSupportCrmAlertSound } from "@/hooks/useSupportCrmAlertSound";

export default function SupportCRM() {
	const router = useRouter();
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
	const [replyText, setReplyText] = useState("");
	const [queueView, setQueueView] = useState<QueueView>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
	const [detailTab, setDetailTab] = useState<DetailTab>("conversation");
	const [activityEntries, setActivityEntries] = useState<TicketActivity[]>([]);
	const [activityLoading, setActivityLoading] = useState(false);
	const [showRefundModal, setShowRefundModal] = useState(false);
	const [showPartialRefundModal, setShowPartialRefundModal] = useState(false);
	const [showAttachBookingModal, setShowAttachBookingModal] = useState(false);
	const [attachBookingId, setAttachBookingId] = useState("");
	const [attachBookingLoading, setAttachBookingLoading] = useState(false);
	const [partialRefundAmount, setPartialRefundAmount] = useState("");
	const [partialRefundReason, setPartialRefundReason] = useState("");
	const [agents, setAgents] = useState<Agent[]>([]);
	const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([]);
	const [showAgentMetrics, setShowAgentMetrics] = useState(false);
	const [showAssignModal, setShowAssignModal] = useState(false);
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");
	const [showCompletePlanModal, setShowCompletePlanModal] = useState(false);
	const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
	const [suggestLoading, setSuggestLoading] = useState(false);
	const [stats, setStats] = useState<CRMStats>({
		totalTickets: 0,
		openTickets: 0,
		inProgressTickets: 0,
		resolvedTickets: 0,
		escalatedTickets: 0,
		avgResponseTime: "0m",
		todayTickets: 0,
		pendingRefunds: 0,
	});

	useEffect(() => {
		setCurrentAdminId(getAdminId());
		loadTickets();
		loadAgents();
		loadAgentMetrics();

		const refreshInterval = setInterval(() => {
			loadTickets();
		}, 30000);

		return () => clearInterval(refreshInterval);
	}, []);

	useSupportCrmAlertSound({
		tickets,
		currentAdminId,
		selectedTicket,
		enabled: true,
	});

	// Calculate average response time from ticket data
	const calculateAvgResponseTime = (ticketList: Ticket[]): string => {
		// Try to calculate from tickets with response times
		const ticketsWithResponses = ticketList.filter((t: any) => t.firstResponseTime && t.createdAt);
		
		if (ticketsWithResponses.length === 0) {
			// Estimate based on in_progress vs open ratio
			const openCount = ticketList.filter((t: Ticket) => t.status === 'open').length;
			const inProgressCount = ticketList.filter((t: Ticket) => t.status === 'in_progress').length;
			
			if (openCount === 0 && inProgressCount > 0) return "< 15m";
			if (openCount > inProgressCount) return "> 30m";
			return "~15m";
		}
		
		// Calculate actual average
		let totalMinutes = 0;
		ticketsWithResponses.forEach((t: any) => {
			const created = new Date(t.createdAt).getTime();
			const responded = new Date(t.firstResponseTime).getTime();
			totalMinutes += (responded - created) / (1000 * 60);
		});
		
		const avgMinutes = totalMinutes / ticketsWithResponses.length;
		
		if (avgMinutes < 60) {
			return `${Math.round(avgMinutes)}m`;
		} else if (avgMinutes < 1440) {
			return `${Math.round(avgMinutes / 60)}h`;
		} else {
			return `${Math.round(avgMinutes / 1440)}d`;
		}
	};

	const loadTickets = async () => {
		setLoading(true);
		try {
			const [ticketsRes, statsRes] = await Promise.all([
				apiClient.get<any>("/crm/tickets"),
				apiClient.get<any>("/crm/stats").catch(() => null),
			]);

			const rawStats = statsRes?.stats ?? statsRes ?? {};
			const parseStat = (snake: string, camel: string, fallback = 0) => {
				const v = rawStats[snake] ?? rawStats[camel];
				const n = Number(v);
				return Number.isFinite(n) ? n : fallback;
			};
			
			if (ticketsRes.success) {
				const rawList = ticketsRes.tickets || [];
				const ticketList: Ticket[] = rawList.map((t: any) => ({
					...t,
					assignedTo: t.assignedTo || t.assigned_to || t.assigned_agent_id || undefined,
					assignedAgent: t.assignedAgent || t.assigned_agent_name || undefined,
					lastUpdatedAt: t.lastUpdatedAt || t.last_updated_at || t.createdAt || t.created_at,
					customerName: t.customerName || t.customer_name,
					customerEmail: t.customerEmail || t.customer_email,
					customerPhone: t.customerPhone || t.customer_phone,
					vendorPhone: t.vendorPhone || t.vendor_phone,
				}));
				setTickets(ticketList);
				
				const today = new Date().toDateString();
				const todayTicketsFromList = ticketList.filter((t: Ticket) => 
					new Date(t.createdAt).toDateString() === today
				).length;

				// Top-row stats always reflect all tickets (from /crm/stats), not type filter
				const avgHours = parseStat("avg_resolution_hours", "avgResolutionHours", 0);
				const avgResponseTime =
					statsRes?.avgResponseTime ||
					(avgHours > 0
						? avgHours < 1
							? `${Math.round(avgHours * 60)}m`
							: `${Math.round(avgHours)}h`
						: calculateAvgResponseTime(ticketList));
				
				setStats({
					totalTickets: parseStat("total_tickets", "totalTickets", ticketList.length),
					openTickets: parseStat(
						"open_tickets",
						"openTickets",
						ticketList.filter((t) => isOpenTicketStatus(t.status)).length
					),
					inProgressTickets: parseStat(
						"in_progress_tickets",
						"inProgressTickets",
						ticketList.filter((t) => isInProgressTicketStatus(t.status)).length
					),
					resolvedTickets: parseStat(
						"resolved_tickets",
						"resolvedTickets",
						ticketList.filter((t) => t.status === "resolved" || t.status === "closed").length
					),
					escalatedTickets: parseStat(
						"escalated_tickets",
						"escalatedTickets",
						ticketList.filter((t) => t.status === "escalated").length
					),
					avgResponseTime,
					todayTickets: parseStat("today_tickets", "todayTickets", todayTicketsFromList),
					pendingRefunds: parseStat("pending_refunds", "pendingRefunds", ticketList.filter((t) => t.refundRequested && !t.refundStatus).length),
				});
				
				// Reload selected ticket if it exists
				if (selectedTicket) {
					const updated = ticketList?.find(
						(t: Ticket) => t.id === selectedTicket.id
					);
					if (updated) {
						loadTicketDetails(updated.id);
					}
				}
			} else {
				toast.error(ticketsRes?.error || "Failed to load support tickets");
			}
		} catch (error) {
			console.error("Failed to load tickets:", error);
			toast.error("Failed to load tickets");
		} finally {
			setLoading(false);
		}
	};

	// Load full ticket details including messages/responses
	const loadTicketDetails = async (ticketId: string) => {
		try {
			const res = await apiClient.get<any>(`/support/tickets/${ticketId}`);
			if (res.success && res.ticket) {
				const raw = res.ticket;
				const meta =
					raw.metadata != null && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
						? (raw.metadata as Record<string, unknown>)
						: undefined;

				// Transform responses into messages format expected by UI
				const messages: TicketMessage[] = (res.responses || []).map((r: any) => {
					const rt = String(r.responder_type || 'customer');
					const isAgent = rt === 'agent';
					const isSystemAi = rt === 'system_ai';
					const responseId = r.id ? String(r.id) : '';
					return {
						id: responseId || String(Date.now()),
						sender: isSystemAi
							? (r.responder_name || 'Warmpawz Support')
							: isAgent
								? (r.responder_name || 'Support Agent')
								: 'Customer',
						content: r.message,
						timestamp: r.created_at,
						role: isSystemAi ? 'system' : (rt === 'agent' ? 'agent' : 'customer'),
						attachments: attachmentsForResponse(meta, responseId),
					};
				});

				// Update selected ticket with full details including messages
				const assignedToRaw = raw.assigned_to ?? raw.assignedTo ?? raw.assigned_agent_id;
				const assignedTo = assignedToRaw ? String(assignedToRaw) : undefined;
				const assignedAgent =
					raw.assigned_agent_name ||
					raw.assignedAgent ||
					undefined;
				const fullTicket: Ticket = {
					id: raw.id,
					customerId: raw.customer_id || '',
					customerName: raw.customer_name || res.customerName,
					customerEmail: raw.customer_email || res.customerEmail,
					customerPhone: raw.customer_phone || res.customerPhone,
					vendorPhone:
						res.vendorPhone ||
						res.bookingContext?.vendorPhone ||
						raw.vendor_phone ||
						undefined,
					lastUpdatedAt: raw.last_updated_at || raw.lastUpdatedAt || raw.created_at,
					subject: raw.subject || '',
					description: raw.message || raw.description || '',
					status: raw.status || 'open',
					priority: raw.priority || 'medium',
					source: raw.source || 'customer',
					createdAt: raw.created_at || '',
					assignedTo,
					assignedAgent,
					category: raw.category,
					messages,
					metadata: meta,
					aiConversation: Array.isArray(res.aiConversation) ? res.aiConversation : undefined,
					ticketType: (res.ticketType ||
						raw.ticket_type ||
						(raw.meal_order_id || meta?.ticket_type === 'meal_order' ? 'meal_order' : null) ||
						(raw.booking_id ? 'booking' : 'general')) as Ticket['ticketType'],
					bookingId: raw.booking_id ? String(raw.booking_id) : undefined,
					mealOrderId: raw.meal_order_id
						? String(raw.meal_order_id)
						: meta?.linked_meal_order_id
							? String(meta.linked_meal_order_id)
							: undefined,
					vendorId: raw.vendor_id ? String(raw.vendor_id) : undefined,
					isRefundable: Boolean(res.isRefundable),
					refundBlockReason: res.refundBlockReason,
					bookingContext: res.bookingContext ?? null,
					mealOrderContext: res.mealOrderContext ?? null,
					paymentContext: res.paymentContext ?? null,
					mealOrderSummary: res.mealOrderSummary ?? undefined,
					refundRequested: meta?.refund_requested === true,
					refundStatus: (raw.refund_status as string | undefined) || (meta?.refund_result as Record<string, unknown> | undefined)?.status as string | undefined,
				};
				setSuggestedReplies([]);
				setSelectedTicket(fullTicket);
			}
		} catch (error) {
			console.error("Failed to load ticket details:", error);
			// Still set the basic ticket info even if details fail
		}
	};

	useEffect(() => {
		if (!selectedTicket?.id) return;
		const detailPoll = setInterval(() => {
			void loadTicketDetails(selectedTicket.id);
		}, 8000);
		return () => clearInterval(detailPoll);
	}, [selectedTicket?.id]);

	// Handle ticket selection - load full details
	const loadTicketActivity = async (ticketId: string) => {
		setActivityLoading(true);
		try {
			const res = await apiClient.get<any>(`/crm/tickets/${ticketId}/activity`);
			if (res.success) {
				setActivityEntries(
					(res.activities || []).map((a: any) => ({
						id: a.id,
						eventType: a.eventType,
						eventTitle: a.eventTitle,
						eventActorType: a.eventActorType,
						createdAt: a.createdAt,
						eventMetadata: a.eventMetadata || {},
					}))
				);
			}
		} catch (error) {
			console.error("Failed to load ticket activity:", error);
			setActivityEntries([]);
		} finally {
			setActivityLoading(false);
		}
	};

	const handleSelectTicket = (ticket: Ticket) => {
		setSelectedTicket(ticket);
		setSuggestedReplies([]);
		setDetailTab("conversation");
		loadTicketDetails(ticket.id);
	};

	useEffect(() => {
		if (selectedTicket?.id) {
			loadTicketActivity(selectedTicket.id);
		}
	}, [selectedTicket?.id]);

	const handleSuggestReplies = async () => {
		if (!selectedTicket) return;
		setSuggestLoading(true);
		try {
			const res = await apiClient.post<any>(
				`/support/tickets/${selectedTicket.id}/suggest-reply`,
				{}
			);
			const list = Array.isArray(res.suggestions) ? res.suggestions : [];
			setSuggestedReplies(list.filter((s: unknown) => typeof s === "string") as string[]);
			if (!list.length) {
				toast.info("No suggestions returned. Check Bedrock is enabled in platform settings.");
			}
		} catch (e) {
			console.error(e);
			toast.error("Could not load AI suggestions");
			setSuggestedReplies([]);
		} finally {
			setSuggestLoading(false);
		}
	};

	const loadAgents = async () => {
		try {
			const res = await apiClient.get<any>("/crm/agents");
			if (res.success && res.agents?.length > 0) {
				setAgents(res.agents);
			} else if (res.agents?.length === 0) {
				// No agents configured yet - show empty state
				setAgents([]);
				toast.info("No support agents configured. Add agents in Settings.");
			} else {
				// API returned error
				setAgents([]);
				toast.error("Failed to load agents. Check API configuration.");
			}
		} catch (error) {
			console.error("Failed to load agents:", error);
			setAgents([]);
			toast.error("Failed to load agents. Please refresh the page.");
		}
	};

	const loadAgentMetrics = async () => {
		try {
			const res = await apiClient.get<any>("/crm/analytics/agents");
			if (res.success) {
				setAgentMetrics(res.metrics || []);
			}
		} catch (error) {
			console.error("Failed to load agent metrics:", error);
		}
	};

	const handleAssignTicket = async () => {
		if (!selectedTicket || !selectedAgentId) return;

		try {
			const success = await handleAction(
				"assign",
				undefined,
				undefined,
				selectedAgentId
			);
			if (success.ok) {
				setShowAssignModal(false);
				setSelectedAgentId("");
				toast.success("Ticket assigned successfully");
				await loadAgentMetrics();
			}
		} catch (error: any) {
			console.error("Error assigning ticket:", error);
			toast.error(error?.message || "Failed to assign ticket");
		}
	};

	const handleAutoRoute = async () => {
		if (!selectedTicket) return;

		try {
			const res = await apiClient.post<any>("/crm/tickets/auto-route", {
				ticketId: selectedTicket.id,
			});

			if (res.success) {
				if (res.routed > 0) {
					toast.success(`Ticket auto-routed to ${res.assignedAgent || "agent"}`);
				} else {
					toast.info(res.message || "No eligible agent available for this ticket");
				}
				await loadTickets();
				if (selectedTicket?.id) await loadTicketDetails(selectedTicket.id);
				await loadAgentMetrics();
			}
		} catch (error) {
			console.error("Error auto-routing ticket:", error);
			toast.error("Failed to auto-route ticket");
		}
	};

	const handleReply = async () => {
		if (!selectedTicket || !replyText.trim()) return;

		try {
			const res = await apiClient.post<any>("/crm/reply", {
				ticketId: selectedTicket.id,
				message: replyText,
				agentName: "Admin Agent",
			});

			if (res.success) {
				toast.success("Reply sent successfully");
				if (detailTab === "activity") {
					void loadTicketActivity(selectedTicket.id);
				}
				setReplyText("");
				// Optimistically update UI
				const newMsg: TicketMessage = {
					id: Date.now().toString(),
					sender: "Admin Agent",
					content: replyText,
					timestamp: new Date().toISOString(),
					role: "agent",
				};

				const updatedTicket = {
					...selectedTicket,
					messages: [...(selectedTicket.messages || []), newMsg],
					status: "in_progress" as const,
				};

				setSelectedTicket(updatedTicket);
				setTickets(
					tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
				);
			}
		} catch (error) {
			toast.error("Failed to send reply");
		}
	};

	const handleCloseTicket = async () => {
		if (!selectedTicket) return;

		try {
			const res = await apiClient.post<any>("/crm/close", {
				ticketId: selectedTicket.id,
			});

			if (res.success) {
				toast.success("Ticket closed");
				const updatedTicket = {
					...selectedTicket,
					status: "resolved" as const,
				};
				setSelectedTicket(updatedTicket);
				setTickets(
					tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
				);
			}
		} catch (error) {
			toast.error("Failed to close ticket");
		}
	};

	// Helper function to call CRM action endpoint
	const handleAction = async (
		action: string,
		amount?: number,
		reason?: string,
		assignTo?: string,
		extra?: Record<string, unknown>
	): Promise<{ ok: boolean; message?: string; refundProcessed?: boolean }> => {
		if (!selectedTicket) return { ok: false };

		try {
			const res = await apiClient.post<any>("/crm/action", {
				ticketId: selectedTicket.id,
				action,
				amount,
				reason,
				assignTo,
				...extra,
			});

			await loadTickets();
			if (selectedTicket) {
				await loadTicketDetails(selectedTicket.id);
				if (detailTab === "activity") {
					await loadTicketActivity(selectedTicket.id);
				}
			}

			if (action === "refund" || action === "partial_refund") {
				return {
					ok: Boolean(res.refundProcessed),
					message: res.message,
					refundProcessed: Boolean(res.refundProcessed),
				};
			}

			return { ok: Boolean(res.success) };
		} catch (error: any) {
			console.error("Error processing action:", error);
			throw error;
		}
	};

	const handleRefund = async () => {
		if (!selectedTicket) return;

		try {
			const result = await handleAction("refund", undefined, "Full refund requested by admin");

			if (result.refundProcessed) {
				setShowRefundModal(false);
				toast.success("Refund initiated for Ticket #" + selectedTicket.id.slice(0, 8));
			} else {
				toast.error(result.message || "Refund could not be processed. Link a booking with a completed payment.");
			}
		} catch (error: any) {
			console.error("Error processing refund:", error);
			const errorMessage =
				error?.message ||
				"Network error. Please check your connection and try again.";
			toast.error(errorMessage);
		}
	};

	const handlePartialRefund = async () => {
		if (!partialRefundAmount || parseFloat(partialRefundAmount) <= 0) {
			toast.error("Please enter a valid refund amount");
			return;
		}

		if (!partialRefundReason?.trim()) {
			toast.error("Please provide a reason for the partial refund");
			return;
		}

		if (!selectedTicket) return;

		const maxRefundable = selectedTicket.paymentContext?.refundableBalance;
		if (maxRefundable != null && parseFloat(partialRefundAmount) > maxRefundable + 0.01) {
			toast.error(`Amount exceeds refundable balance (₹${maxRefundable.toFixed(2)})`);
			return;
		}

		try {
			const result = await handleAction(
				"partial_refund",
				parseFloat(partialRefundAmount),
				partialRefundReason.trim()
			);

			if (result.refundProcessed) {
				const refundAmount = partialRefundAmount || "0";
				const formattedAmount = parseFloat(refundAmount).toLocaleString(
					"en-IN",
					{
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}
				);

				toast.success(
					`Partial refund of ₹${formattedAmount} initiated successfully`
				);

				setShowPartialRefundModal(false);
				setPartialRefundAmount("");
				setPartialRefundReason("");
			} else {
				toast.error(result.message || "Refund could not be processed.");
			}
		} catch (error: any) {
			console.error("Error processing partial refund:", error);
			const errorMessage =
				error?.message ||
				"Network error. Please check your connection and try again.";
			toast.error(errorMessage);
		}
	};

	const handleAttachBooking = async () => {
		if (!selectedTicket || !attachBookingId.trim()) {
			toast.error("Enter a booking ID");
			return;
		}
		setAttachBookingLoading(true);
		try {
			const result = await handleAction("attach_booking", undefined, undefined, undefined, {
				bookingId: attachBookingId.trim(),
			});
			if (result.ok) {
				toast.success("Booking linked to ticket");
				setShowAttachBookingModal(false);
				setAttachBookingId("");
			} else {
				toast.error("Could not attach booking");
			}
		} catch (error: any) {
			toast.error(error?.message || "Failed to attach booking");
		} finally {
			setAttachBookingLoading(false);
		}
	};

	const getFilterCount = useCallback(
		(view: QueueView) =>
			tickets.filter((t) => matchesQueueView(t, view, currentAdminId)).length,
		[tickets, currentAdminId]
	);

	const filteredTickets = useMemo(
		() =>
			tickets.filter(
				(t) =>
					matchesQueueView(t, queueView, currentAdminId) && matchesSearch(t, searchQuery)
			),
		[tickets, queueView, currentAdminId, searchQuery]
	);

	// Loading state with brand spinner
	if (loading && tickets.length === 0) {
		return (
			<AdminLayout>
				<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
						<p className="text-gray-600">Loading Support CRM...</p>
					</div>
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout>
			<div className="flex flex-col h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 to-white">
				<div className="shrink-0 bg-white border-b border-gray-200 px-4 py-2.5">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2.5 min-w-0">
							<div className="p-2 rounded-lg bg-gradient-to-br from-[#FF8C42] to-[#E07830]">
								<Headphones className="w-5 h-5 text-white" />
							</div>
							<div className="min-w-0">
								<h1 className="text-lg font-bold text-gray-900 leading-tight">Support CRM</h1>
								<p className="text-xs text-gray-500 truncate">
									Manage customer support tickets and agent workflows
								</p>
							</div>
						</div>
						<div className="flex items-center gap-1.5 shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowAgentMetrics(true)}
								className="h-8 text-xs border-[#FF8C42]/30 text-[#FF8C42]"
							>
								<BarChart3 className="w-3.5 h-3.5 mr-1" />
								Metrics
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => router.push("/support/settings")}
								className="h-8 text-xs"
							>
								<Settings className="w-3.5 h-3.5 mr-1" />
								Settings
							</Button>
							<Button variant="outline" size="sm" onClick={loadTickets} className="h-8 text-xs">
								<RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
								Refresh
							</Button>
						</div>
					</div>
				</div>

				<SupportCrmStatsBar stats={stats} />

				<div className="flex-1 flex min-h-0 overflow-hidden">
					<SupportCrmQueuePanel
						tickets={filteredTickets}
						selectedTicketId={selectedTicket?.id}
						queueView={queueView}
						searchQuery={searchQuery}
						stats={stats}
						agents={agents}
						onQueueViewChange={setQueueView}
						onSearchChange={setSearchQuery}
						onSelectTicket={handleSelectTicket}
						getFilterCount={getFilterCount}
					/>

					{selectedTicket ? (
						<>
							<SupportCrmConversationPanel
								ticket={selectedTicket}
								detailTab={detailTab}
								onDetailTabChange={setDetailTab}
								activityEntries={activityEntries}
								activityLoading={activityLoading}
								replyText={replyText}
								onReplyTextChange={setReplyText}
								onReply={handleReply}
								suggestedReplies={suggestedReplies}
								suggestLoading={suggestLoading}
								onSuggestReplies={handleSuggestReplies}
							/>
							<SupportCrmContextPanel
								ticket={selectedTicket}
								agents={agents}
								activityEntries={activityEntries}
								activityLoading={activityLoading}
								onCloseTicket={handleCloseTicket}
								onReopen={() => handleAction("reopen", undefined, "Ticket reopened by admin")}
								onEscalate={() => handleAction("escalate", undefined, "Escalated by admin")}
								onAutoRoute={handleAutoRoute}
								onShowAssignModal={() => setShowAssignModal(true)}
								onShowAttachBookingModal={() => setShowAttachBookingModal(true)}
								onShowRefundModal={() => setShowRefundModal(true)}
								onShowPartialRefundModal={() => setShowPartialRefundModal(true)}
								onShowCompletePlanModal={() => setShowCompletePlanModal(true)}
								onViewFullActivity={() => setDetailTab("activity")}
							/>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center min-w-0 bg-gray-50/50">
							<div className="text-center px-6">
								<div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
									<MessageSquare className="w-8 h-8 text-gray-300" />
								</div>
								<p className="text-gray-500 font-medium">Select a ticket</p>
								<p className="text-gray-400 text-sm mt-1">
									Queue on the left · conversation center · context on the right
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Full Refund Modal */}
			<Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<div className="p-2 rounded-lg bg-red-100">
								<IndianRupee className="w-5 h-5 text-red-600" />
							</div>
							Issue Full Refund
						</DialogTitle>
						<DialogDescription>
							Process a full refund for this support ticket. This will create a refund request in the system.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 space-y-4">
						<div className="bg-[#FFF3E8] border border-[#FF8C42]/20 rounded-xl p-4 flex items-start gap-3">
							<AlertTriangle className="w-5 h-5 text-[#FF8C42] mt-0.5 flex-shrink-0" />
							<div>
								<p className="text-sm font-semibold text-gray-800">Important</p>
								<p className="text-xs text-gray-600 mt-1">
									Refunds will be processed via Razorpay and credited to the original payment method within 5-7 business days.
								</p>
							</div>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700 mb-1.5 block">
								Refund Amount (INR)
							</label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
								<Input className="pl-8 text-lg font-semibold" defaultValue="500" />
							</div>
							<p className="text-xs text-gray-400 mt-1">Enter the amount to refund to the customer</p>
						</div>
					</div>
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setShowRefundModal(false)}>
							Cancel
						</Button>
						<Button 
							variant="destructive" 
							onClick={handleRefund}
							className="bg-red-600 hover:bg-red-700"
						>
							<IndianRupee className="w-4 h-4 mr-1.5" />
							Process Refund
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Partial Refund Modal */}
			<Dialog open={showPartialRefundModal} onOpenChange={setShowPartialRefundModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<div className="p-2 rounded-lg bg-[#FFF3E8]">
								<IndianRupee className="w-5 h-5 text-[#FF8C42]" />
							</div>
							Issue Partial Refund
						</DialogTitle>
						<DialogDescription>
							Process a partial refund with a specific amount and reason.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 space-y-4">
						<div className="bg-[#FFF3E8] border border-[#FF8C42]/20 rounded-xl p-4 flex items-start gap-3">
							<AlertTriangle className="w-5 h-5 text-[#FF8C42] mt-0.5 flex-shrink-0" />
							<div>
								<p className="text-sm font-semibold text-gray-800">Partial Refund</p>
								<p className="text-xs text-gray-600 mt-1">
									Refund goes to the customer — wallet portion instantly, Razorpay portion in 5–7 business days.
								</p>
								{selectedTicket?.paymentContext && (
									<p className="text-xs font-semibold text-green-800 mt-2">
										Max refundable: ₹{selectedTicket.paymentContext.refundableBalance.toFixed(2)}
									</p>
								)}
							</div>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700 mb-1.5 block">
								Refund Amount (INR) *
							</label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
								<Input
									className="pl-8 text-lg font-semibold"
									type="number"
									min="0"
									step="0.01"
									value={partialRefundAmount}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPartialRefundAmount(e.target.value)}
									placeholder="0.00"
								/>
							</div>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700 mb-1.5 block">
								Reason for Refund *
							</label>
							<Textarea
								rows={3}
								value={partialRefundReason}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPartialRefundReason(e.target.value)}
								placeholder="Describe why this partial refund is being issued..."
								className="resize-none"
							/>
						</div>
					</div>
					<DialogFooter className="gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setShowPartialRefundModal(false);
								setPartialRefundAmount("");
								setPartialRefundReason("");
							}}
						>
							Cancel
						</Button>
						<Button 
							onClick={handlePartialRefund}
							className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
							disabled={!partialRefundAmount || !partialRefundReason.trim()}
						>
							<IndianRupee className="w-4 h-4 mr-1.5" />
							Process Partial Refund
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showAttachBookingModal} onOpenChange={setShowAttachBookingModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Link2 className="w-5 h-5 text-blue-600" />
							Attach booking to ticket
						</DialogTitle>
						<DialogDescription>
							Link this general ticket to a booking so refunds can be processed for the paying customer.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<label className="text-sm font-medium text-gray-700 mb-1.5 block">Booking ID *</label>
						<Input
							value={attachBookingId}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttachBookingId(e.target.value)}
							placeholder="Paste booking UUID"
							className="font-mono text-sm"
						/>
					</div>
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setShowAttachBookingModal(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAttachBooking}
							disabled={attachBookingLoading || !attachBookingId.trim()}
							className="bg-blue-600 hover:bg-blue-700 text-white"
						>
							{attachBookingLoading ? "Linking…" : "Attach booking"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Assign Agent Modal */}
			<Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<div className="p-2 rounded-lg bg-[#FFF3E8]">
								<UserPlus className="w-5 h-5 text-[#FF8C42]" />
							</div>
							Assign Support Agent
						</DialogTitle>
						<DialogDescription>
							Select an agent to handle this ticket. The agent will be notified.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<div>
							<label className="text-sm font-medium text-gray-700 mb-2 block">
								Available Agents
							</label>
							<Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Choose an agent..." />
								</SelectTrigger>
								<SelectContent>
									{agents.map((agent) => (
										<SelectItem key={agent.id} value={agent.id}>
											<div className="flex items-center gap-2">
												<div className="w-8 h-8 rounded-full bg-[#FFF3E8] flex items-center justify-center">
													<User className="w-4 h-4 text-[#FF8C42]" />
												</div>
												<div>
													<span className="font-medium">{agent.name}</span>
													{agent.workload !== undefined && (
														<span className="text-xs text-gray-400 ml-2">
															({agent.workload} active)
														</span>
													)}
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{selectedAgentId && (
							<div className="mt-4 p-4 bg-[#FFF3E8] border border-[#FF8C42]/20 rounded-xl">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-[#FF8C42] flex items-center justify-center">
										<User className="w-5 h-5 text-white" />
									</div>
									<div>
										<p className="font-semibold text-gray-800">
											{agents.find((a) => a.id === selectedAgentId)?.name}
										</p>
										<p className="text-xs text-gray-500">Will be assigned to this ticket</p>
									</div>
								</div>
							</div>
						)}
					</div>
					<DialogFooter className="gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setShowAssignModal(false);
								setSelectedAgentId("");
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleAssignTicket}
							disabled={!selectedAgentId}
							className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
						>
							<UserPlus className="w-4 h-4 mr-1.5" />
							Assign Agent
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Agent Metrics Modal */}
			<Dialog open={showAgentMetrics} onOpenChange={setShowAgentMetrics}>
				<DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<div className="p-2 rounded-lg bg-[#FFF3E8]">
								<BarChart3 className="w-5 h-5 text-[#FF8C42]" />
							</div>
							Agent Performance Metrics
						</DialogTitle>
						<DialogDescription>
							View performance statistics and KPIs for all support agents
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						{agentMetrics.length === 0 ? (
							<div className="text-center py-12">
								<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
									<BarChart3 className="w-8 h-8 text-gray-300" />
								</div>
								<p className="text-gray-500 font-medium">No metrics available yet</p>
								<p className="text-sm text-gray-400 mt-1">Agent performance data will appear here once tickets are assigned</p>
							</div>
						) : (
							<div className="space-y-4">
								{agentMetrics.map((metric) => (
									<Card
										key={metric.agentId}
										className="p-5 border border-gray-200 hover:border-[#FF8C42]/30 hover:shadow-md transition-all"
									>
										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-3">
												<div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF8C42] to-[#E07830] flex items-center justify-center">
													<User className="w-6 h-6 text-white" />
												</div>
												<div>
													<h3 className="font-bold text-lg text-gray-900">{metric.agentName}</h3>
													<p className="text-xs text-gray-400 font-mono">ID: {metric.agentId.slice(0, 8)}</p>
												</div>
											</div>
											<Badge
												className={`px-3 py-1.5 text-sm font-semibold ${
													metric.resolutionRate >= 80
														? "bg-green-100 text-green-700 border border-green-200"
														: metric.resolutionRate >= 50
															? "bg-yellow-100 text-yellow-700 border border-yellow-200"
															: "bg-red-100 text-red-700 border border-red-200"
												}`}
											>
												{metric.resolutionRate}% Resolution
											</Badge>
										</div>
										<div className="grid grid-cols-4 gap-4">
											<div className="bg-gray-50 rounded-xl p-3 text-center">
												<p className="text-xs text-gray-500 font-medium mb-1">Total Tickets</p>
												<p className="text-2xl font-bold text-gray-900">{metric.totalTickets}</p>
											</div>
											<div className="bg-green-50 rounded-xl p-3 text-center">
												<p className="text-xs text-gray-500 font-medium mb-1">Resolved</p>
												<p className="text-2xl font-bold text-green-600">{metric.resolved}</p>
											</div>
											<div className="bg-blue-50 rounded-xl p-3 text-center">
												<p className="text-xs text-gray-500 font-medium mb-1">Satisfaction</p>
												<p className="text-2xl font-bold text-blue-600">{metric.satisfaction}%</p>
											</div>
											<div className="bg-purple-50 rounded-xl p-3 text-center">
												<p className="text-xs text-gray-500 font-medium mb-1">Avg Response</p>
												<p className="text-2xl font-bold text-purple-600">{metric.avgResponseTime}m</p>
											</div>
										</div>
									</Card>
								))}
							</div>
						)}
					</div>
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setShowAgentMetrics(false)}>
							Close
						</Button>
						<Button
							onClick={loadAgentMetrics}
							className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
						>
							<RefreshCw className="w-4 h-4 mr-2" />
							Refresh Metrics
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Complete Plan Modal */}
			<CompletePlanModal
				open={showCompletePlanModal}
				onOpenChange={setShowCompletePlanModal}
				ticketId={selectedTicket?.id}
				customerId={selectedTicket?.customerId}
				onPlanCreated={(planId) => {
					toast.success(`Care plan created! Plan ID: ${planId}`);
					// Optionally reload ticket or navigate to plan view
				}}
			/>
		</AdminLayout>
	);
}

