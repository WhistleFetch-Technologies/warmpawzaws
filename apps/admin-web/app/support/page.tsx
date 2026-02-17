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
interface Ticket {
	id: string;
	customerId: string;
	vendorId?: string;
	subject: string;
	description: string;
	status: "open" | "in_progress" | "resolved" | "closed" | "escalated";
	priority: "low" | "medium" | "high";
	source: string;
	createdAt: string;
	messages?: TicketMessage[];
	assignedTo?: string;
	assignedAgent?: string;
	category?: string;
	customerName?: string;
	vendorName?: string;
	requesterName?: string;
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
	const [showRefundModal, setShowRefundModal] = useState(false);
	const [showPartialRefundModal, setShowPartialRefundModal] = useState(false);
	const [partialRefundAmount, setPartialRefundAmount] = useState("");
	const [partialRefundReason, setPartialRefundReason] = useState("");
	const [agents, setAgents] = useState<Agent[]>([]);
	const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([]);
	const [showAgentMetrics, setShowAgentMetrics] = useState(false);
	const [showAssignModal, setShowAssignModal] = useState(false);
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");
	const [showCompletePlanModal, setShowCompletePlanModal] = useState(false);
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
			// Try to get stats from dedicated endpoint first
			const [ticketsRes, statsRes] = await Promise.all([
				apiClient.get<any>("/crm/tickets"),
				apiClient.get<any>("/crm/stats").catch(() => null),
			]);
			
			if (ticketsRes.success) {
				const ticketList = ticketsRes.tickets || [];
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
				const fullTicket: Ticket = {
					id: res.ticket.id,
					customerId: res.ticket.customer_id || '',
					vendorId: res.ticket.vendor_id,
					subject: res.ticket.subject || '',
					description: res.ticket.message || res.ticket.description || '',
					status: res.ticket.status || 'open',
					priority: res.ticket.priority || 'medium',
					source: res.ticket.source || 'customer',
					createdAt: res.ticket.created_at || '',
					assignedTo: res.ticket.assigned_agent_id,
					assignedAgent: res.ticket.assigned_agent_name,
					category: res.ticket.category,
					customerName: res.ticket.customer_name,
					vendorName: res.ticket.vendor_name,
					requesterName: res.ticket.vendor_id ? (res.ticket.vendor_name || 'Vendor') : (res.ticket.customer_name || res.ticket.customer_phone || 'Customer'),
					messages,
				};
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
		loadTicketDetails(ticket.id);
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
			if (success) {
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
		assignTo?: string
	): Promise<boolean> => {
		if (!selectedTicket) return false;

		try {
			const res = await apiClient.post<any>("/crm/action", {
				ticketId: selectedTicket.id,
				action,
				amount,
				reason,
				assignTo,
			});

			if (res.success) {
				await loadTickets();
				return true;
			}
			return false;
		} catch (error: any) {
			console.error("Error processing action:", error);
			throw error;
		}
	};

	const handleRefund = async () => {
		if (!selectedTicket) return;

		try {
			const success = await handleAction("refund", 500, "Full refund");

			if (success) {
				setShowRefundModal(false);
				toast.success(
					"Refund process initiated for Ticket #" + selectedTicket.id
				);
			} else {
				toast.error("Failed to process refund. Please try again.");
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

		try {
			const success = await handleAction(
				"partial_refund",
				parseFloat(partialRefundAmount),
				partialRefundReason.trim()
			);

			if (success) {
				const refundAmount = partialRefundAmount || "0";
				const formattedAmount = parseFloat(refundAmount).toLocaleString(
					"en-IN",
					{
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					}
				);

				toast.success(
					`Partial refund of ₹${formattedAmount} processed successfully`
				);

				setShowPartialRefundModal(false);
				setPartialRefundAmount("");
				setPartialRefundReason("");
			} else {
				toast.error("Failed to process partial refund. Please try again.");
			}
		} catch (error: any) {
			console.error("Error processing partial refund:", error);
			const errorMessage =
				error?.message ||
				"Network error. Please check your connection and try again.";
			toast.error(errorMessage);
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

	const filteredTickets = tickets.filter(
		(t) => filterStatus === "all" || t.status === filterStatus
	);

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

	/** Human-readable labels for ticket source (Customer, Vendor, AI Chatbot, Vendor AI Chat, etc.) */
	const getSourceLabel = (source: string) => {
		switch (String(source || "").toLowerCase()) {
			case "customer": return "Customer";
			case "vendor": return "Vendor";
			case "ai_chatbot": return "AI Chatbot";
			case "vendor_ai_chatbot": return "Vendor AI Chat";
			case "chat_handoff": return "Chat handoff";
			case "admin": return "Admin";
			case "system": return "System";
			default: return source || "Customer";
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
						<div className="p-4 border-b border-gray-100 bg-gray-50/50">
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
										<div className="mt-2 flex items-center gap-2 flex-wrap">
											<span className="text-xs text-gray-500">
												{(ticket as any).requesterName || ticket.customerName || (ticket as any).customerId?.slice(0, 8) || '—'}
											</span>
											<span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
												{getSourceLabel((ticket as any).source || 'customer')}
											</span>
										</div>
										<div className="mt-3 flex items-center justify-between">
											<div className="flex items-center gap-2">
												{ticket.category && (
													<span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
														<Tag className="w-3 h-3" />
														{ticket.category}
													</span>
												)}
											</div>
											{ticket.assignedAgent ? (
												<Badge variant="outline" className="text-xs border-[#FF8C42]/30 text-[#FF8C42] bg-[#FFF3E8]">
													<User className="w-3 h-3 mr-1" />
													{ticket.assignedAgent}
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
												<Badge variant="outline" className="text-xs">
													{getSourceLabel(selectedTicket.source)}
												</Badge>
												{selectedTicket.category && (
													<Badge variant="outline" className="text-xs bg-gray-50">
														<Tag className="w-3 h-3 mr-1" />
														{selectedTicket.category}
													</Badge>
												)}
											</div>
											<h2 className="text-xl font-bold text-gray-900 mb-2">
												{selectedTicket.subject}
											</h2>
											<div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
												<div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
													<User className="w-4 h-4 text-gray-400" /> 
													<span>{(selectedTicket as any).requesterName || selectedTicket.customerName || (selectedTicket as any).vendorName || selectedTicket.customerId?.slice(0, 8) || "N/A"}</span>
												</div>
												<div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
													<Clock className="w-4 h-4 text-gray-400" />
													<span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
												</div>
												{selectedTicket.assignedAgent && (
													<div className="flex items-center gap-1.5 bg-[#FFF3E8] px-2 py-1 rounded border border-[#FF8C42]/30">
														<Headphones className="w-4 h-4 text-[#FF8C42]" />
														<span className="text-[#FF8C42] font-medium">{selectedTicket.assignedAgent}</span>
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
										{!selectedTicket.assignedAgent ? (
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
									The specified amount will be refunded via Razorpay within 5-7 business days.
								</p>
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

