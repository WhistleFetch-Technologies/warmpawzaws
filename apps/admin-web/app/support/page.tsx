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
	DollarSign,
	Users as UsersIcon,
	BarChart3,
	UserPlus,
	Zap,
	FileCheck,
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
} from "@warmpawz/ui";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { CompletePlanModal } from "@/components/admin/support/CompletePlanModal";
import { useRouter } from "next/navigation";

// Types
interface Ticket {
	id: string;
	customerId: string;
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

	useEffect(() => {
		loadTickets();
		loadAgents();
		loadAgentMetrics();
	}, []);

	const loadTickets = async () => {
		setLoading(true);
		try {
			const res = await apiClient.get<any>("/crm/tickets");
			if (res.success) {
				setTickets(res.tickets || []);
				// Reload selected ticket if it exists
				if (selectedTicket) {
					const updated = res.tickets?.find(
						(t: Ticket) => t.id === selectedTicket.id
					);
					if (updated) setSelectedTicket(updated);
				}
			}
		} catch (error) {
			console.error("Failed to load tickets:", error);
			toast.error("Failed to load tickets");
		} finally {
			setLoading(false);
		}
	};

	const loadAgents = async () => {
		try {
			const res = await apiClient.get<any>("/crm/agents");
			if (res.success) {
				setAgents(res.agents || []);
			} else {
				// Default agents fallback
				const defaultAgents: Agent[] = [
					{
						id: "agent_1",
						name: "Support Agent 1",
						specialties: ["general", "billing"],
						workload: 0,
					},
					{
						id: "agent_2",
						name: "Support Agent 2",
						specialties: ["technical", "order"],
						workload: 0,
					},
					{
						id: "agent_3",
						name: "Support Agent 3",
						specialties: ["refund", "billing"],
						workload: 0,
					},
					{
						id: "admin_agent",
						name: "Admin Agent",
						specialties: ["all"],
						workload: 0,
					},
				];
				setAgents(defaultAgents);
			}
		} catch (error) {
			console.error("Failed to load agents:", error);
			// Use default agents on error
			const defaultAgents: Agent[] = [
				{
					id: "agent_1",
					name: "Support Agent 1",
					specialties: ["general", "billing"],
					workload: 0,
				},
				{
					id: "agent_2",
					name: "Support Agent 2",
					specialties: ["technical", "order"],
					workload: 0,
				},
				{
					id: "agent_3",
					name: "Support Agent 3",
					specialties: ["refund", "billing"],
					workload: 0,
				},
				{
					id: "admin_agent",
					name: "Admin Agent",
					specialties: ["all"],
					workload: 0,
				},
			];
			setAgents(defaultAgents);
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

	return (
		<AdminLayout>
			<div className="flex-1 flex h-[calc(100vh-64px)] bg-gray-50">
				{/* Sidebar List */}
				<div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
					{/* Header */}
					<div className="p-4 border-b border-gray-200">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<h2 className="text-xl font-bold text-gray-800">Support CRM</h2>
							</div>
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setShowAgentMetrics(true)}
									title="Agent Metrics"
								>
									<BarChart3 className="w-5 h-5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={loadTickets}
									title="Refresh"
								>
									<RefreshCw
										className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
									/>
								</Button>
							</div>
						</div>

						<div className="flex gap-2 overflow-x-auto pb-2">
							{["all", "open", "in_progress", "resolved"].map((status) => (
								<button
									key={status}
									onClick={() => setFilterStatus(status)}
									className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap capitalize ${
										filterStatus === status
											? "bg-orange-100 text-orange-700 border border-orange-200"
											: "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
									}`}
								>
									{status.replace("_", " ")}
								</button>
							))}
						</div>
					</div>

					{/* List */}
					<div className="flex-1 overflow-y-auto">
						{filteredTickets.length === 0 ? (
							<div className="p-8 text-center text-gray-500">
								<Ticket className="w-12 h-12 mx-auto mb-2 text-gray-300" />
								<p>No tickets found</p>
							</div>
						) : (
							filteredTickets.map((ticket) => (
								<div
									key={ticket.id}
									onClick={() => setSelectedTicket(ticket)}
									className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-orange-50 ${
										selectedTicket?.id === ticket.id
											? "bg-orange-50 border-orange-200"
											: ""
									}`}
								>
									<div className="flex justify-between items-start mb-1">
										<span
											className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}
										>
											{ticket.status.replace("_", " ")}
										</span>
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
									<div className="mt-2 flex items-center justify-between">
										<div className="flex items-center gap-2 text-xs text-gray-400">
											<User className="w-3 h-3" />
											<span>{ticket.customerId}</span>
										</div>
										{ticket.assignedAgent && (
											<Badge variant="outline" className="text-xs">
												{ticket.assignedAgent}
											</Badge>
										)}
									</div>
								</div>
							))
						)}
					</div>
				</div>

				{/* Main Detail View */}
				<div className="flex-1 flex flex-col bg-gray-50">
					{selectedTicket ? (
						<>
							{/* Ticket Header */}
							<div className="bg-white border-b border-gray-200 p-6">
								<div className="flex justify-between items-start">
									<div>
										<div className="flex items-center gap-3 mb-2">
											<h1 className="text-2xl font-bold text-gray-900">
												#{selectedTicket.id}
											</h1>
											<Badge className={getStatusColor(selectedTicket.status)}>
												{selectedTicket.status.replace("_", " ")}
											</Badge>
											<Badge variant="outline" className="uppercase">
												{selectedTicket.source}
											</Badge>
										</div>
										<h2 className="text-lg font-medium text-gray-700 mb-1">
											{selectedTicket.subject}
										</h2>
										<div className="flex items-center gap-4 text-sm text-gray-500">
											<div className="flex items-center gap-1">
												<User className="w-4 h-4" /> {selectedTicket.customerId}
											</div>
											<span className="text-gray-300">|</span>
											<div className="flex items-center gap-1">
												<Clock className="w-4 h-4" />{" "}
												{new Date(selectedTicket.createdAt).toLocaleString()}
											</div>
											{selectedTicket.assignedAgent && (
												<>
													<span className="text-gray-300">|</span>
													<div className="flex items-center gap-1">
														<UsersIcon className="w-4 h-4" />{" "}
														{selectedTicket.assignedAgent}
													</div>
												</>
											)}
										</div>
									</div>
									<div className="flex flex-wrap gap-2">
										{selectedTicket.status !== "resolved" && (
											<Button
												variant="outline"
												className="text-green-600 border-green-200 hover:bg-green-50"
												onClick={handleCloseTicket}
											>
												<CheckCircle className="w-4 h-4 mr-2" />
												Mark Resolved
											</Button>
										)}
										{selectedTicket.status === "resolved" && (
											<Button
												variant="outline"
												className="text-blue-600 border-blue-200 hover:bg-blue-50"
												onClick={() =>
													handleAction(
														"reopen",
														undefined,
														"Ticket reopened by admin"
													)
												}
											>
												<RefreshCw className="w-4 h-4 mr-2" />
												Reopen
											</Button>
										)}
										{!selectedTicket.assignedAgent && (
											<>
												<Button
													variant="outline"
													className="text-blue-600 border-blue-200 hover:bg-blue-50"
													onClick={() => setShowAssignModal(true)}
												>
													<UserPlus className="w-4 h-4 mr-2" />
													Assign Agent
												</Button>
												<Button
													variant="outline"
													className="text-purple-600 border-purple-200 hover:bg-purple-50"
													onClick={handleAutoRoute}
												>
													<Zap className="w-4 h-4 mr-2" />
													Auto Route
												</Button>
											</>
										)}
										{selectedTicket.assignedAgent && (
											<Button
												variant="outline"
												className="text-blue-600 border-blue-200 hover:bg-blue-50"
												onClick={() => setShowAssignModal(true)}
											>
												<UserPlus className="w-4 h-4 mr-2" />
												Reassign
											</Button>
										)}
										{selectedTicket.status !== "escalated" && (
											<Button
												variant="outline"
												className="text-red-600 border-red-200 hover:bg-red-50"
												onClick={() =>
													handleAction(
														"escalate",
														undefined,
														"Escalated by admin"
													)
												}
											>
												<AlertTriangle className="w-4 h-4 mr-2" />
												Escalate
											</Button>
										)}
										<Button
											variant="destructive"
											onClick={() => setShowRefundModal(true)}
										>
											<AlertTriangle className="w-4 h-4 mr-2" />
											Issue Refund
										</Button>
										<Button
											variant="outline"
											className="text-orange-600 border-orange-200 hover:bg-orange-50"
											onClick={() => setShowPartialRefundModal(true)}
										>
											<DollarSign className="w-4 h-4 mr-2" />
											Partial Refund
										</Button>
										<Button
											variant="outline"
											className="text-purple-600 border-purple-200 hover:bg-purple-50"
											onClick={() => setShowCompletePlanModal(true)}
										>
											<FileCheck className="w-4 h-4 mr-2" />
											Complete Plan
										</Button>
									</div>
								</div>
							</div>

							{/* Description & Chat */}
							<div className="flex-1 overflow-y-auto p-6 space-y-6">
								{/* Original Issue */}
								<div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
									<h4 className="text-sm font-bold text-orange-900 mb-2">
										Original Request
									</h4>
									<p className="text-gray-800 whitespace-pre-wrap">
										{selectedTicket.description}
									</p>
								</div>

								{/* Thread */}
								{selectedTicket.messages?.map((msg) => (
									<div
										key={msg.id}
										className={`flex ${msg.role === "agent" ? "justify-end" : "justify-start"}`}
									>
										<div
											className={`max-w-[80%] rounded-xl p-4 ${
												msg.role === "agent"
													? "bg-blue-600 text-white rounded-tr-none"
													: "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
											}`}
										>
											<div className="flex justify-between items-center mb-1 opacity-80 text-xs">
												<span className="font-bold">{msg.sender}</span>
												<span>
													{new Date(msg.timestamp).toLocaleTimeString()}
												</span>
											</div>
											<p>{msg.content}</p>
										</div>
									</div>
								))}
							</div>

							{/* Reply Area */}
							{selectedTicket.status !== "resolved" && (
								<div className="bg-white border-t border-gray-200 p-4">
									<div className="flex gap-2">
										<Input
											value={replyText}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setReplyText(e.target.value)
											}
											placeholder="Type a reply to the customer..."
											className="flex-1"
											onKeyDown={(e) =>
												e.key === "Enter" && !e.shiftKey && handleReply()
											}
										/>
										<Button
											onClick={handleReply}
											className="bg-blue-600 hover:bg-blue-700"
										>
											<Send className="w-4 h-4 mr-2" />
											Reply
										</Button>
									</div>
								</div>
							)}
						</>
					) : (
						<div className="flex-1 flex items-center justify-center text-gray-400">
							<div className="text-center">
								<MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
								<p>Select a ticket to view details</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Refund Modal */}
			<Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Issue Refund</DialogTitle>
						<DialogDescription>
							Are you sure you want to issue a refund for this ticket? This
							action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
							<AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
							<div>
								<p className="text-sm font-medium text-yellow-800">Warning</p>
								<p className="text-xs text-yellow-700">
									Refunds will be processed to the original payment method
									within 5-7 business days.
								</p>
							</div>
						</div>
						<div className="mt-4">
							<label className="text-sm font-medium text-gray-700">
								Refund Amount
							</label>
							<div className="relative mt-1">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
								<Input className="pl-9" defaultValue="500" />
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowRefundModal(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleRefund}>
							Confirm Refund
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Partial Refund Modal */}
			<Dialog
				open={showPartialRefundModal}
				onOpenChange={setShowPartialRefundModal}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Issue Partial Refund</DialogTitle>
						<DialogDescription>
							Enter the partial refund amount and reason. This action will be
							logged in the ticket.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4 space-y-4">
						<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
							<AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
							<div>
								<p className="text-sm font-medium text-yellow-800">Warning</p>
								<p className="text-xs text-yellow-700">
									Partial refunds will be processed to the original payment
									method within 5-7 business days.
								</p>
							</div>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700">
								Refund Amount *
							</label>
							<div className="relative mt-1">
								<DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
								<Input
									className="pl-9"
									type="number"
									min="0"
									step="0.01"
									value={partialRefundAmount}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setPartialRefundAmount(e.target.value)
									}
									placeholder="Enter amount"
								/>
							</div>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700">
								Reason *
							</label>
							<Textarea
								className="mt-1"
								rows={3}
								value={partialRefundReason}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
									setPartialRefundReason(e.target.value)
								}
								placeholder="Enter reason for partial refund..."
							/>
						</div>
					</div>
					<DialogFooter>
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
						<Button variant="destructive" onClick={handlePartialRefund}>
							Confirm Partial Refund
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Assign Agent Modal */}
			<Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Assign Agent</DialogTitle>
						<DialogDescription>
							Select an agent to assign this ticket to. The agent will be
							notified.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<div>
							<label className="text-sm font-medium text-gray-700 mb-2 block">
								Select Agent
							</label>
							<Select
								value={selectedAgentId}
								onValueChange={setSelectedAgentId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Choose an agent..." />
								</SelectTrigger>
								<SelectContent>
									{agents.map((agent) => (
										<SelectItem key={agent.id} value={agent.id}>
											<div className="flex items-center justify-between w-full">
												<span>{agent.name}</span>
												{agent.specialties && (
													<span className="text-xs text-gray-500 ml-2">
														({agent.specialties.slice(0, 2).join(", ")})
													</span>
												)}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{selectedAgentId && (
							<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
								<p className="text-sm text-blue-800">
									<strong>
										{agents.find((a) => a.id === selectedAgentId)?.name}
									</strong>{" "}
									will be assigned to this ticket.
								</p>
							</div>
						)}
					</div>
					<DialogFooter>
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
							className="bg-blue-600 hover:bg-blue-700"
						>
							Assign Agent
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Agent Metrics Modal */}
			<Dialog open={showAgentMetrics} onOpenChange={setShowAgentMetrics}>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Agent Performance Metrics</DialogTitle>
						<DialogDescription>
							View performance statistics for all support agents
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						{agentMetrics.length === 0 ? (
							<div className="text-center py-8 text-gray-500">
								<BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
								<p>No agent metrics available yet</p>
							</div>
						) : (
							<div className="space-y-4">
								{agentMetrics.map((metric) => (
									<div
										key={metric.agentId}
										className="border border-gray-200 rounded-lg p-4"
									>
										<div className="flex items-center justify-between mb-3">
											<div>
												<h3 className="font-semibold text-lg">
													{metric.agentName}
												</h3>
												<p className="text-sm text-gray-500">
													Agent ID: {metric.agentId}
												</p>
											</div>
											<Badge
												className={
													metric.resolutionRate >= 80
														? "bg-green-100 text-green-700"
														: "bg-yellow-100 text-yellow-700"
												}
											>
												{metric.resolutionRate}% Resolution Rate
											</Badge>
										</div>
										<div className="grid grid-cols-4 gap-4">
											<div>
												<p className="text-xs text-gray-500">Total Tickets</p>
												<p className="text-2xl font-bold">
													{metric.totalTickets}
												</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">Resolved</p>
												<p className="text-2xl font-bold text-green-600">
													{metric.resolved}
												</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">Satisfaction</p>
												<p className="text-2xl font-bold text-blue-600">
													{metric.satisfaction}%
												</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">Avg Response</p>
												<p className="text-2xl font-bold">
													{metric.avgResponseTime}m
												</p>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowAgentMetrics(false);
								loadAgentMetrics();
							}}
						>
							Close
						</Button>
						<Button
							onClick={loadAgentMetrics}
							className="bg-blue-600 hover:bg-blue-700"
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

