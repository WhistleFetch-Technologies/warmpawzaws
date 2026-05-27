"use client";

import { useState, useEffect } from "react";
import {
	Search,
	MessageSquare,
	CheckCircle,
	XCircle,
	Clock,
	Filter,
	RefreshCw,
	Send,
	User,
	AlertTriangle,
	Ticket,
	IndianRupee,
	Users as UsersIcon,
	BarChart3,
	UserPlus,
	Zap,
	FileCheck,
	Headphones,
	TrendingUp,
	Timer,
	Settings,
	ArrowUpRight,
	Phone,
	Mail,
	Tag,
	Link2,
	Calendar,
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
import { useRouter } from "next/navigation";

// Brand colors
const BRAND_ORANGE = "#FF8C42";
const BRAND_ORANGE_LIGHT = "#FFF3E8";
const BRAND_ORANGE_DARK = "#E07830";

// Types
interface BookingSummary {
	serviceName?: string;
	status?: string;
	amount?: number;
	scheduledDate?: string;
}

interface BookingContextPanel {
	id: string;
	status: string;
	serviceName?: string;
	serviceStyle?: string;
	scheduledDate?: string;
	scheduledTime?: string;
	amount?: number;
	vendorId?: string;
	vendorName?: string;
	paymentStatus?: string;
}

interface PaymentContextPanel {
	paymentId?: string;
	totalPaid: number;
	walletPaid: number;
	gatewayPaid: number;
	refundedSoFar: number;
	refundableBalance: number;
	paymentMethod?: string;
	razorpayPaymentId?: string;
	paymentStatus?: string;
	hasGatewayPayment: boolean;
}

interface Ticket {
	id: string;
	customerId: string;
	customerName?: string;
	subject: string;
	description: string;
	status: "open" | "in_progress" | "resolved" | "closed" | "escalated";
	priority: "low" | "medium" | "high" | "urgent";
	source: string;
	createdAt: string;
	messages?: TicketMessage[];
	assignedTo?: string;
	assignedAgent?: string;
	category?: string;
	metadata?: Record<string, unknown>;
	aiConversation?: Array<Record<string, unknown>>;
	ticketType?: "general" | "booking";
	bookingId?: string;
	vendorId?: string;
	isRefundable?: boolean;
	refundBlockReason?: string;
	bookingSummary?: BookingSummary;
	refundableBalance?: number;
	bookingContext?: BookingContextPanel | null;
	paymentContext?: PaymentContextPanel | null;
	refundRequested?: boolean;
	refundStatus?: string;
}

interface TicketMessage {
	id: string;
	sender: string;
	content: string;
	timestamp: string;
	role: "agent" | "customer" | "system";
}

interface Agent {
	id: string;
	name: string;
	email?: string;
	specialties?: string[];
	workload?: number;
}

interface AgentMetrics {
	agentId: string;
	agentName: string;
	totalTickets: number;
	resolved: number;
	resolutionRate: number;
	satisfaction: number;
	avgResponseTime: number;
	avgResolutionTime: number;
}

// Stats interface
interface CRMStats {
	totalTickets: number;
	openTickets: number;
	inProgressTickets: number;
	resolvedTickets: number;
	escalatedTickets: number;
	avgResponseTime: string;
	todayTickets: number;
	pendingRefunds: number;
}

export default function SupportCRM() {
	const router = useRouter();
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
	const [replyText, setReplyText] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");
	const [filterTicketType, setFilterTicketType] = useState<"all" | "general" | "booking">("all");
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
		loadTickets();
		loadAgents();
		loadAgentMetrics();
		
		// Auto-refresh tickets every 30 seconds for near real-time updates
		const refreshInterval = setInterval(() => {
			loadTickets();
		}, 30000);
		
		return () => clearInterval(refreshInterval);
	}, []);

	useEffect(() => {
		loadTickets();
	}, [filterTicketType]);

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
			const ticketTypeQuery =
				filterTicketType !== "all" ? `?ticketType=${filterTicketType}` : "";
			const [ticketsRes, statsRes] = await Promise.all([
				apiClient.get<any>(`/crm/tickets${ticketTypeQuery}`),
				apiClient.get<any>("/crm/stats").catch(() => null),
			]);
			
			if (ticketsRes.success) {
				const rawList = ticketsRes.tickets || [];
				const ticketList: Ticket[] = rawList.map((t: any) => ({
					...t,
					assignedTo: t.assignedTo || t.assigned_to || undefined,
					assignedAgent: t.assignedAgent || t.assigned_agent_name || undefined,
				}));
				setTickets(ticketList);
				
				// Calculate stats - use API stats if available, otherwise calculate locally
				const today = new Date().toDateString();
				const todayTickets = ticketList.filter((t: Ticket) => 
					new Date(t.createdAt).toDateString() === today
				).length;
				
				const avgResponseTime = statsRes?.avgResponseTime || calculateAvgResponseTime(ticketList);
				
				setStats({
					totalTickets: statsRes?.totalTickets ?? ticketList.length,
					openTickets: statsRes?.openTickets ?? ticketList.filter((t: Ticket) => t.status === 'open').length,
					inProgressTickets: statsRes?.inProgressTickets ?? ticketList.filter((t: Ticket) => t.status === 'in_progress').length,
					resolvedTickets: statsRes?.resolvedTickets ?? ticketList.filter((t: Ticket) => t.status === 'resolved' || t.status === 'closed').length,
					escalatedTickets: statsRes?.escalatedTickets ?? ticketList.filter((t: Ticket) => t.status === 'escalated').length,
					avgResponseTime,
					todayTickets: statsRes?.todayTickets ?? todayTickets,
					pendingRefunds: statsRes?.pendingRefunds ?? ticketList.filter((t: Ticket) => 
						(t as any).refundStatus === 'pending'
					).length,
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
				// Transform responses into messages format expected by UI
				const messages: TicketMessage[] = (res.responses || []).map((r: any) => ({
					id: r.id || String(Date.now()),
					sender: r.responder_type === 'agent' ? (r.responder_name || 'Support Agent') : 'Customer',
					content: r.message,
					timestamp: r.created_at,
					role: r.responder_type || 'customer',
				}));

				// Update selected ticket with full details including messages
				const raw = res.ticket;
				const assignedToRaw = raw.assigned_to ?? raw.assignedTo ?? raw.assigned_agent_id;
				const assignedTo = assignedToRaw ? String(assignedToRaw) : undefined;
				const assignedAgent =
					raw.assigned_agent_name ||
					raw.assignedAgent ||
					undefined;
				const meta =
					raw.metadata != null && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
						? (raw.metadata as Record<string, unknown>)
						: undefined;
				const fullTicket: Ticket = {
					id: raw.id,
					customerId: raw.customer_id || '',
					customerName: raw.customer_name || res.customerName,
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
					ticketType: (res.ticketType || raw.ticket_type || (raw.booking_id ? 'booking' : 'general')) as 'general' | 'booking',
					bookingId: raw.booking_id ? String(raw.booking_id) : undefined,
					vendorId: raw.vendor_id ? String(raw.vendor_id) : undefined,
					isRefundable: Boolean(res.isRefundable),
					refundBlockReason: res.refundBlockReason,
					bookingContext: res.bookingContext ?? null,
					paymentContext: res.paymentContext ?? null,
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

	// Handle ticket selection - load full details
	const handleSelectTicket = (ticket: Ticket) => {
		setSelectedTicket(ticket);
		setSuggestedReplies([]);
		loadTicketDetails(ticket.id);
	};

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
				toast.success(`Ticket auto-routed to ${res.assignedAgent || "agent"}`);
				await loadTickets();
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

	const getStatusColor = (status: string) => {
		switch (status) {
			case "open":
				return "bg-red-100 text-red-700";
			case "in_progress":
				return "bg-yellow-100 text-yellow-700";
			case "resolved":
				return "bg-green-100 text-green-700";
			default:
				return "bg-gray-100 text-gray-700";
		}
	};

	const filteredTickets = tickets.filter((t) => {
		const statusOk = filterStatus === "all" || t.status === filterStatus;
		const typeOk =
			filterTicketType === "all" ||
			(filterTicketType === "booking" && t.ticketType === "booking") ||
			(filterTicketType === "general" && (t.ticketType === "general" || !t.ticketType));
		return statusOk && typeOk;
	});

	const isBookingTicket = (t: Ticket | null | undefined) => t?.ticketType === "booking" || Boolean(t?.bookingId);
	const canProcessRefund = (t: Ticket | null | undefined) => Boolean(t?.isRefundable);

	const ticketHasAssignee = (t: Ticket | null | undefined) =>
		Boolean(t && (t.assignedTo || t.assignedAgent));

	const assigneeDisplayLabel = (t: Ticket): string => {
		if (t.assignedAgent) return t.assignedAgent;
		if (t.assignedTo && agents.length) {
			const a = agents.find((x) => x.id === t.assignedTo);
			if (a?.name) return a.name;
		}
		if (t.assignedTo) return "Assigned";
		return "";
	};

	const getPriorityColor = (priority: string) => {
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
	};

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
				{/* Enhanced Header with Stats */}
				<div className="bg-white border-b border-gray-200 shadow-sm">
					<div className="px-6 py-4">
						{/* Title Row */}
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-3">
								<div className="p-2.5 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#E07830] shadow-lg">
									<Headphones className="w-6 h-6 text-white" />
								</div>
								<div>
									<h1 className="text-2xl font-bold text-gray-900">Support CRM</h1>
									<p className="text-sm text-gray-500">Manage customer support tickets and agent workflows</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowAgentMetrics(true)}
									className="border-[#FF8C42]/30 text-[#FF8C42] hover:bg-[#FFF3E8]"
								>
									<BarChart3 className="w-4 h-4 mr-2" />
									Agent Metrics
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => router.push('/support/settings')}
									className="border-gray-200"
								>
									<Settings className="w-4 h-4 mr-2" />
									Settings
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={loadTickets}
									className="border-gray-200"
								>
									<RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
									Refresh
								</Button>
							</div>
						</div>

						{/* Stats Cards */}
						<div className="grid grid-cols-6 gap-4">
							<Card className="p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-gray-500 font-medium">Total Tickets</p>
										<p className="text-2xl font-bold text-gray-900">{stats.totalTickets}</p>
									</div>
									<div className="p-2 rounded-lg bg-blue-50">
										<Ticket className="w-5 h-5 text-blue-600" />
									</div>
								</div>
							</Card>
							<Card className="p-3 border border-red-100 shadow-sm hover:shadow-md transition-shadow bg-red-50/30">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-gray-500 font-medium">Open</p>
										<p className="text-2xl font-bold text-red-600">{stats.openTickets}</p>
									</div>
									<div className="p-2 rounded-lg bg-red-100">
										<AlertTriangle className="w-5 h-5 text-red-600" />
									</div>
								</div>
							</Card>
							<Card className="p-3 border border-yellow-100 shadow-sm hover:shadow-md transition-shadow bg-yellow-50/30">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-gray-500 font-medium">In Progress</p>
										<p className="text-2xl font-bold text-yellow-600">{stats.inProgressTickets}</p>
									</div>
									<div className="p-2 rounded-lg bg-yellow-100">
										<Clock className="w-5 h-5 text-yellow-600" />
									</div>
								</div>
							</Card>
							<Card className="p-3 border border-green-100 shadow-sm hover:shadow-md transition-shadow bg-green-50/30">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-gray-500 font-medium">Resolved</p>
										<p className="text-2xl font-bold text-green-600">{stats.resolvedTickets}</p>
									</div>
									<div className="p-2 rounded-lg bg-green-100">
										<CheckCircle className="w-5 h-5 text-green-600" />
									</div>
								</div>
							</Card>
							<Card className="p-3 border border-orange-100 shadow-sm hover:shadow-md transition-shadow bg-orange-50/30">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-gray-500 font-medium">Escalated</p>
										<p className="text-2xl font-bold text-orange-600">{stats.escalatedTickets}</p>
									</div>
									<div className="p-2 rounded-lg bg-orange-100">
										<ArrowUpRight className="w-5 h-5 text-orange-600" />
									</div>
								</div>
							</Card>
							<Card className="p-3 border border-purple-100 shadow-sm hover:shadow-md transition-shadow bg-purple-50/30">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-gray-500 font-medium">Today</p>
										<p className="text-2xl font-bold text-purple-600">{stats.todayTickets}</p>
									</div>
									<div className="p-2 rounded-lg bg-purple-100">
										<TrendingUp className="w-5 h-5 text-purple-600" />
									</div>
								</div>
							</Card>
						</div>
					</div>
				</div>

				{/* Main Content Area */}
				<div className="flex-1 flex overflow-hidden">
					{/* Ticket List Sidebar */}
					<div className="w-[380px] border-r border-gray-200 bg-white flex flex-col">
						{/* Filter Header */}
						<div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
							<div className="flex gap-2 overflow-x-auto pb-1">
								{[
									{ value: "all", label: "All types" },
									{ value: "booking", label: "Booking" },
									{ value: "general", label: "General" },
								].map((filter) => (
									<button
										key={filter.value}
										onClick={() => setFilterTicketType(filter.value as "all" | "general" | "booking")}
										className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
											filterTicketType === filter.value
												? "bg-blue-600 text-white shadow-md"
												: "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
										}`}
									>
										{filter.label}
									</button>
								))}
							</div>
							<div className="flex gap-2 overflow-x-auto pb-1">
								{[
									{ value: "all", label: "All", count: stats.totalTickets },
									{ value: "open", label: "Open", count: stats.openTickets },
									{ value: "in_progress", label: "In Progress", count: stats.inProgressTickets },
									{ value: "escalated", label: "Escalated", count: stats.escalatedTickets },
									{ value: "resolved", label: "Resolved", count: stats.resolvedTickets },
								].map((filter) => (
									<button
										key={filter.value}
										onClick={() => setFilterStatus(filter.value)}
										className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${
											filterStatus === filter.value
												? "bg-[#FF8C42] text-white shadow-md"
												: "bg-white text-gray-600 border border-gray-200 hover:border-[#FF8C42]/50 hover:bg-[#FFF3E8]"
										}`}
									>
										{filter.label}
										<span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
											filterStatus === filter.value
												? "bg-white/20 text-white"
												: "bg-gray-100 text-gray-500"
										}`}>
											{filter.count}
										</span>
									</button>
								))}
							</div>
						</div>

						{/* Ticket List */}
						<div className="flex-1 overflow-y-auto">
							{filteredTickets.length === 0 ? (
								<div className="p-8 text-center">
									<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
										<Ticket className="w-8 h-8 text-gray-300" />
									</div>
									<p className="text-gray-500 font-medium">No tickets found</p>
									<p className="text-sm text-gray-400 mt-1">All clear! No tickets match this filter.</p>
								</div>
							) : (
								filteredTickets.map((ticket) => (
									<div
										key={ticket.id}
										onClick={() => handleSelectTicket(ticket)}
										className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-[#FFF3E8]/50 ${
											selectedTicket?.id === ticket.id
												? "bg-[#FFF3E8] border-l-4 border-l-[#FF8C42]"
												: "hover:border-l-4 hover:border-l-[#FF8C42]/30"
										}`}
									>
										<div className="flex justify-between items-start mb-2">
											<div className="flex items-center gap-2">
												<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}>
													{ticket.status.replace("_", " ")}
												</span>
												<span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPriorityColor(ticket.priority)}`}>
													{ticket.priority}
												</span>
												<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
													isBookingTicket(ticket)
														? "bg-blue-100 text-blue-700"
														: "bg-gray-100 text-gray-600"
												}`}>
													{isBookingTicket(ticket) ? "Booking" : "General"}
												</span>
												{ticket.isRefundable && (
													<span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
														Refundable
													</span>
												)}
											</div>
											<span className="text-xs text-gray-400">
												{new Date(ticket.createdAt).toLocaleDateString()}
											</span>
										</div>
										<h3 className="font-semibold text-gray-900 truncate mb-1">
											{ticket.subject}
										</h3>
										<p className="text-sm text-gray-500 line-clamp-2">
											{ticket.description}
										</p>
										{ticket.bookingSummary?.serviceName && (
											<p className="text-xs text-blue-600 mt-1 truncate">
												{ticket.bookingSummary.serviceName}
												{ticket.bookingId ? ` · ${ticket.bookingId.slice(0, 8)}…` : ""}
											</p>
										)}
										<div className="mt-3 flex items-center justify-between">
											<div className="flex items-center gap-2">
												{ticket.category && (
													<span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
														<Tag className="w-3 h-3" />
														{ticket.category}
													</span>
												)}
											</div>
											{ticketHasAssignee(ticket) ? (
												<Badge variant="outline" className="text-xs border-[#FF8C42]/30 text-[#FF8C42] bg-[#FFF3E8]">
													<User className="w-3 h-3 mr-1" />
													{assigneeDisplayLabel(ticket)}
												</Badge>
											) : (
												<Badge variant="outline" className="text-xs border-red-200 text-red-600 bg-red-50">
													Unassigned
												</Badge>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* Ticket Detail View */}
					<div className="flex-1 flex flex-col bg-gray-50/50">
						{selectedTicket ? (
							<>
								{/* Ticket Header */}
								<div className="bg-white border-b border-gray-200 p-5 shadow-sm">
									<div className="flex justify-between items-start">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-3">
												<span className="text-sm font-mono text-gray-400">#{selectedTicket.id.slice(0, 8)}</span>
												<Badge className={`${getStatusColor(selectedTicket.status)} px-3 py-1`}>
													{selectedTicket.status.replace("_", " ")}
												</Badge>
												<Badge className={`${getPriorityColor(selectedTicket.priority)} px-3 py-1 border`}>
													{selectedTicket.priority.toUpperCase()}
												</Badge>
												<Badge variant="outline" className="uppercase text-xs">
													{selectedTicket.source}
												</Badge>
												{selectedTicket.category && (
													<Badge variant="outline" className="text-xs bg-gray-50">
														<Tag className="w-3 h-3 mr-1" />
														{selectedTicket.category}
													</Badge>
												)}
												<Badge
													variant="outline"
													className={`text-xs uppercase ${
														isBookingTicket(selectedTicket)
															? "bg-blue-50 text-blue-700 border-blue-200"
															: "bg-gray-50 text-gray-600"
													}`}
												>
													{isBookingTicket(selectedTicket) ? "Booking ticket" : "General ticket"}
												</Badge>
												{canProcessRefund(selectedTicket) && (
													<Badge className="text-xs bg-green-100 text-green-700 border-green-200">
														Refundable
													</Badge>
												)}
											</div>
											<h2 className="text-xl font-bold text-gray-900 mb-2">
												{selectedTicket.subject}
											</h2>
											<div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
												<div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
													<User className="w-4 h-4 text-gray-400" /> 
													<span>{selectedTicket.customerName || selectedTicket.customerId.slice(0, 8) || "N/A"}</span>
												</div>
												{selectedTicket.bookingId && (
													<div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded border border-blue-100">
														<Calendar className="w-4 h-4 text-blue-500" />
														<span className="font-mono text-xs">{selectedTicket.bookingId.slice(0, 8)}…</span>
													</div>
												)}
												<div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
													<Clock className="w-4 h-4 text-gray-400" />
													<span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
												</div>
												{ticketHasAssignee(selectedTicket) && (
													<div className="flex items-center gap-1.5 bg-[#FFF3E8] px-2 py-1 rounded border border-[#FF8C42]/30">
														<Headphones className="w-4 h-4 text-[#FF8C42]" />
														<span className="text-[#FF8C42] font-medium">
															{assigneeDisplayLabel(selectedTicket)}
														</span>
													</div>
												)}
											</div>
										</div>
									</div>
									
									{/* Action Buttons Row */}
									<div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
										{selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" && (
											<Button
												size="sm"
												className="bg-green-600 hover:bg-green-700 text-white"
												onClick={handleCloseTicket}
											>
												<CheckCircle className="w-4 h-4 mr-1.5" />
												Mark Resolved
											</Button>
										)}
										{(selectedTicket.status === "resolved" || selectedTicket.status === "closed") && (
											<Button
												size="sm"
												variant="outline"
												className="border-blue-200 text-blue-600 hover:bg-blue-50"
												onClick={() => handleAction("reopen", undefined, "Ticket reopened by admin")}
											>
												<RefreshCw className="w-4 h-4 mr-1.5" />
												Reopen
											</Button>
										)}
										{!ticketHasAssignee(selectedTicket) ? (
											<>
												<Button
													size="sm"
													variant="outline"
													className="border-[#FF8C42]/30 text-[#FF8C42] hover:bg-[#FFF3E8]"
													onClick={() => setShowAssignModal(true)}
												>
													<UserPlus className="w-4 h-4 mr-1.5" />
													Assign Agent
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="border-purple-200 text-purple-600 hover:bg-purple-50"
													onClick={handleAutoRoute}
												>
													<Zap className="w-4 h-4 mr-1.5" />
													Auto Route
												</Button>
											</>
										) : (
											<Button
												size="sm"
												variant="outline"
												className="border-[#FF8C42]/30 text-[#FF8C42] hover:bg-[#FFF3E8]"
												onClick={() => setShowAssignModal(true)}
											>
												<UserPlus className="w-4 h-4 mr-1.5" />
												Reassign
											</Button>
										)}
										{selectedTicket.status !== "escalated" && (
											<Button
												size="sm"
												variant="outline"
												className="border-red-200 text-red-600 hover:bg-red-50"
												onClick={() => handleAction("escalate", undefined, "Escalated by admin")}
											>
												<ArrowUpRight className="w-4 h-4 mr-1.5" />
												Escalate
											</Button>
										)}
										<div className="flex-1"></div>
										{!isBookingTicket(selectedTicket) && (
											<Button
												size="sm"
												variant="outline"
												className="border-blue-200 text-blue-600 hover:bg-blue-50"
												onClick={() => setShowAttachBookingModal(true)}
											>
												<Link2 className="w-4 h-4 mr-1.5" />
												Attach booking
											</Button>
										)}
										{canProcessRefund(selectedTicket) ? (
											<>
												<Button
													size="sm"
													variant="outline"
													className="border-[#FF8C42]/30 text-[#FF8C42] hover:bg-[#FFF3E8]"
													onClick={() => setShowPartialRefundModal(true)}
												>
													<IndianRupee className="w-4 h-4 mr-1.5" />
													Partial Refund
												</Button>
												<Button
													size="sm"
													variant="destructive"
													onClick={() => setShowRefundModal(true)}
												>
													<IndianRupee className="w-4 h-4 mr-1.5" />
													Full Refund
												</Button>
											</>
										) : (
											<Button
												size="sm"
												variant="outline"
												disabled
												className="border-gray-200 text-gray-400"
												title={selectedTicket.refundBlockReason || "Refunds require a booking-linked ticket with payment"}
											>
												<IndianRupee className="w-4 h-4 mr-1.5" />
												Refund unavailable
											</Button>
										)}
										<Button
											size="sm"
											variant="outline"
											className="border-purple-200 text-purple-600 hover:bg-purple-50"
											onClick={() => setShowCompletePlanModal(true)}
										>
											<FileCheck className="w-4 h-4 mr-1.5" />
											Care Plan
										</Button>
									</div>

									{isBookingTicket(selectedTicket) && (
										<div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
											<Card className="p-4 border-blue-100 bg-blue-50/40">
												<h4 className="text-sm font-bold text-gray-800 mb-3">Booking</h4>
												{selectedTicket.bookingContext ? (
													<div className="space-y-2 text-sm">
														<p><span className="text-gray-500">Service:</span> {selectedTicket.bookingContext.serviceName || "—"}</p>
														<p><span className="text-gray-500">Status:</span> {selectedTicket.bookingContext.status}</p>
														<p><span className="text-gray-500">Vendor:</span> {selectedTicket.bookingContext.vendorName || "—"}</p>
														<p><span className="text-gray-500">Date:</span> {selectedTicket.bookingContext.scheduledDate || "—"} {selectedTicket.bookingContext.scheduledTime || ""}</p>
														<p><span className="text-gray-500">Amount:</span> {selectedTicket.bookingContext.amount != null ? `₹${selectedTicket.bookingContext.amount}` : "—"}</p>
														<p className="font-mono text-xs text-gray-500 break-all">ID: {selectedTicket.bookingId}</p>
													</div>
												) : (
													<p className="text-sm text-gray-600 font-mono break-all">{selectedTicket.bookingId}</p>
												)}
											</Card>
											<Card className="p-4 border-green-100 bg-green-50/40">
												<h4 className="text-sm font-bold text-gray-800 mb-3">Payment & refund</h4>
												{selectedTicket.paymentContext ? (
													<div className="space-y-2 text-sm">
														<p><span className="text-gray-500">Paid:</span> ₹{selectedTicket.paymentContext.totalPaid.toFixed(2)}</p>
														<p><span className="text-gray-500">Wallet:</span> ₹{selectedTicket.paymentContext.walletPaid.toFixed(2)} · <span className="text-gray-500">Gateway:</span> ₹{selectedTicket.paymentContext.gatewayPaid.toFixed(2)}</p>
														<p><span className="text-gray-500">Refunded:</span> ₹{selectedTicket.paymentContext.refundedSoFar.toFixed(2)}</p>
														<p className="font-semibold text-green-800"><span className="text-gray-500 font-normal">Refundable now:</span> ₹{selectedTicket.paymentContext.refundableBalance.toFixed(2)}</p>
														{selectedTicket.paymentContext.razorpayPaymentId && (
															<p className="font-mono text-xs text-gray-500 break-all">Razorpay: {selectedTicket.paymentContext.razorpayPaymentId}</p>
														)}
													</div>
												) : (
													<p className="text-sm text-amber-800">{selectedTicket.refundBlockReason || "No payment data for this booking."}</p>
												)}
											</Card>
										</div>
									)}

									{!isBookingTicket(selectedTicket) && (
										<div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
											General inquiry ticket — refunds are disabled until a booking is attached.
										</div>
									)}
								</div>

								{/* Conversation Area */}
								<div className="flex-1 overflow-y-auto p-5 space-y-4">
									{/* Original Issue Card */}
									<div className="bg-gradient-to-br from-[#FFF3E8] to-white border border-[#FF8C42]/20 rounded-xl p-5 shadow-sm">
										<div className="flex items-center gap-2 mb-3">
											<div className="p-1.5 rounded-lg bg-[#FF8C42]/10">
												<MessageSquare className="w-4 h-4 text-[#FF8C42]" />
											</div>
											<h4 className="text-sm font-bold text-gray-800">Original Request</h4>
											<span className="text-xs text-gray-400 ml-auto">
												{new Date(selectedTicket.createdAt).toLocaleString()}
											</span>
										</div>
										<p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
											{selectedTicket.description}
										</p>
									</div>

									{selectedTicket.metadata?.refund_result != null && (
										<div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
											<h4 className="text-sm font-bold text-gray-800 mb-2">Refund status</h4>
											{(() => {
												const rr = selectedTicket.metadata?.refund_result as Record<string, unknown> | null;
												if (!rr) return null;
												return (
													<div className="space-y-1 text-sm text-gray-700">
														<p><span className="text-gray-500">Status:</span> {String(rr.status ?? "—")}</p>
														{rr.amount != null && <p><span className="text-gray-500">Amount:</span> ₹{Number(rr.amount).toFixed(2)}</p>}
														{rr.refundId != null && <p className="font-mono text-xs break-all"><span className="text-gray-500 font-sans">Refund ID:</span> {String(rr.refundId)}</p>}
														{rr.razorpayRefundId != null && <p className="font-mono text-xs break-all"><span className="text-gray-500 font-sans">Razorpay:</span> {String(rr.razorpayRefundId)}</p>}
														{rr.walletCredited != null && Number(rr.walletCredited) > 0 && (
															<p><span className="text-gray-500">Wallet credited:</span> ₹{Number(rr.walletCredited).toFixed(2)}</p>
														)}
														{rr.message != null && <p className="text-gray-600">{String(rr.message)}</p>}
													</div>
												);
											})()}
										</div>
									)}

									{selectedTicket.metadata &&
										Object.keys(selectedTicket.metadata).filter((k) => k !== "refund_result" && k !== "attachments").length > 0 && (
											<details className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
												<summary className="text-sm font-bold text-gray-800 cursor-pointer">Additional metadata</summary>
												<pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto mt-2">
													{JSON.stringify(
														Object.fromEntries(
															Object.entries(selectedTicket.metadata).filter(
																([k]) => k !== "refund_result" && k !== "attachments"
															)
														),
														null,
														2
													)}
												</pre>
											</details>
										)}

									{selectedTicket.aiConversation && selectedTicket.aiConversation.length > 0 && (
										<div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
											<h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
												<Headphones className="w-4 h-4 text-indigo-500" />
												AI assistant transcript (pre-handoff)
											</h4>
											<div className="space-y-3 max-h-64 overflow-y-auto">
												{selectedTicket.aiConversation.map((row, idx) => (
													<div
														key={String(row.id ?? row.created_at ?? idx)}
														className="text-sm border-l-2 border-indigo-200 pl-3"
													>
														<p className="text-xs font-semibold text-gray-500 mb-0.5">Customer</p>
														<p className="text-gray-800 whitespace-pre-wrap mb-2">
															{String(row.user_message ?? "")}
														</p>
														<p className="text-xs font-semibold text-gray-500 mb-0.5">Assistant</p>
														<p className="text-gray-700 whitespace-pre-wrap">
															{String(row.bot_response ?? "")}
														</p>
														{row.intent != null ? (
															<p className="text-xs text-gray-400 mt-1">
																intent: {String(row.intent)} · confidence:{" "}
																{row.confidence != null ? String(row.confidence) : "—"}
															</p>
														) : null}
													</div>
												))}
											</div>
										</div>
									)}

									{/* Message Thread */}
									{selectedTicket.messages?.map((msg) => (
										<div
											key={msg.id}
											className={`flex ${msg.role === "agent" ? "justify-end" : "justify-start"}`}
										>
											<div
												className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
													msg.role === "agent"
														? "bg-gradient-to-br from-[#FF8C42] to-[#E07830] text-white rounded-tr-sm"
														: "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
												}`}
											>
												<div className={`flex justify-between items-center mb-2 text-xs ${
													msg.role === "agent" ? "text-white/80" : "text-gray-400"
												}`}>
													<span className="font-semibold">{msg.sender}</span>
													<span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
												</div>
												<p className="leading-relaxed">{msg.content}</p>
											</div>
										</div>
									))}

									{/* Empty state for no messages */}
									{(!selectedTicket.messages || selectedTicket.messages.length === 0) && (
										<div className="text-center py-8">
											<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
												<MessageSquare className="w-6 h-6 text-gray-300" />
											</div>
											<p className="text-gray-400 text-sm">No responses yet</p>
										</div>
									)}
								</div>

								{/* Reply Area */}
								{selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" && (
									<div className="bg-white border-t border-gray-200 p-4 shadow-lg">
										<div className="flex flex-wrap items-center gap-2 mb-3">
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
												disabled={suggestLoading}
												onClick={() => void handleSuggestReplies()}
											>
												{suggestLoading ? (
													<>
														<RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
														Suggesting…
													</>
												) : (
													<>
														<Zap className="w-4 h-4 mr-1.5" />
														Suggest replies (AI)
													</>
												)}
											</Button>
										</div>
										{suggestedReplies.length > 0 && (
											<div className="flex flex-col gap-2 mb-3">
												<span className="text-xs font-semibold text-gray-500">
													Tap to copy into reply box (edit before sending)
												</span>
												<div className="flex flex-col gap-2">
													{suggestedReplies.map((s, i) => (
														<button
															key={i}
															type="button"
															className="text-left text-sm p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 text-gray-800"
															onClick={() => setReplyText(s)}
														>
															{s}
														</button>
													))}
												</div>
											</div>
										)}
										<div className="flex gap-3">
											<Input
												value={replyText}
												onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReplyText(e.target.value)}
												placeholder="Type your reply to the customer..."
												className="flex-1 border-gray-200 focus:border-[#FF8C42] focus:ring-[#FF8C42]/20"
												onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && !e.shiftKey && handleReply()}
											/>
											<Button
												onClick={handleReply}
												disabled={!replyText.trim()}
												className="bg-[#FF8C42] hover:bg-[#E07830] text-white px-6"
											>
												<Send className="w-4 h-4 mr-2" />
												Send Reply
											</Button>
										</div>
									</div>
								)}
							</>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<div className="text-center">
									<div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
										<MessageSquare className="w-10 h-10 text-gray-300" />
									</div>
									<p className="text-gray-500 font-medium text-lg">Select a ticket to view details</p>
									<p className="text-gray-400 text-sm mt-1">Choose from the list on the left</p>
								</div>
							</div>
						)}
					</div>
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

