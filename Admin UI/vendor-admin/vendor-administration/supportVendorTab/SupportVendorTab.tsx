import { useState, useEffect } from "react";
import { Eye, Phone, ChevronDown } from "lucide-react";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";
import { CustomDropdown } from "../CustomDropdown";

interface SupportTicket {
	id: string;
	ticketId: string;
	vendorName: string;
	vendorId: string;
	issue: string;
	priority: "high" | "medium" | "low";
	status: "open" | "in-progress" | "resolved" | "closed";
	assignedTo: string;
	created: string;
}

export function SupportVendorTab() {
	const [tickets, setTickets] = useState<SupportTicket[]>([]);
	const [loading, setLoading] = useState(true);
	const [typeFilter, setTypeFilter] = useState("all");
	const [priorityFilter, setPriorityFilter] = useState("all");

	useEffect(() => {
		loadSupportTickets();
	}, []);

	const loadSupportTickets = async () => {
		try {
			setLoading(true);

			const response = await fetch(
				`${getApiBaseUrl()}/admin/vendors/support/tickets`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setTickets(data.tickets || []);
			}
		} catch (error) {
			console.error("Error loading support tickets:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleViewTicket = (ticketId: string) => {
		console.log("View ticket:", ticketId);
		// Open ticket details modal
	};

	const handleCallVendor = (vendorId: string) => {
		console.log("Call vendor:", vendorId);
		// Initiate call or show contact modal
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "text-red-600 bg-red-50 border-red-200";
			case "medium":
				return "text-orange-600 bg-orange-50 border-orange-200";
			case "low":
				return "text-green-600 bg-green-50 border-green-200";
			default:
				return "text-gray-600 bg-gray-50 border-gray-200";
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "open":
				return "text-red-600";
			case "in-progress":
				return "text-blue-600";
			case "resolved":
				return "text-green-600";
			case "closed":
				return "text-gray-600";
			default:
				return "text-gray-600";
		}
	};

	const filteredTickets = tickets.filter((ticket) => {
		if (priorityFilter !== "all" && ticket.priority !== priorityFilter)
			return false;
		if (typeFilter !== "all" && ticket.status !== typeFilter) return false;
		return true;
	});

	return (
		<div>
			<div className="mb-4">
				<div className="text-sm text-gray-600 mb-4">
					Current Vendor's who need support
				</div>

				<div className="flex items-center justify-between mb-4">
					<h3 className="text-base">Vendor's Issues</h3>
					<div className="flex gap-3">
						<CustomDropdown
							options={[
								{ value: "all", label: "All Types" },
								{ value: "open", label: "Open" },
								{ value: "in-progress", label: "In Progress" },
								{ value: "resolved", label: "Resolved" },
								{ value: "closed", label: "Closed" },
							]}
							value={typeFilter}
							onChange={setTypeFilter}
							placeholder="All Types"
						/>
						<CustomDropdown
							options={[
								{ value: "all", label: "Priority" },
								{ value: "high", label: "High" },
								{ value: "medium", label: "Medium" },
								{ value: "low", label: "Low" },
							]}
							value={priorityFilter}
							onChange={setPriorityFilter}
							placeholder="Priority"
						/>
					</div>
				</div>
			</div>

			{/* Table Header */}
			<div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 mb-2">
				<div className="col-span-3">Ticket Details</div>
				<div className="col-span-2">Priority</div>
				<div className="col-span-2">Status</div>
				<div className="col-span-2">Assigned To</div>
				<div className="col-span-2">Created</div>
				<div className="col-span-1">Actions</div>
			</div>

			{/* Tickets List */}
			<div className="space-y-2">
				{loading ? (
					<div className="text-center py-12 text-gray-500">
						<div className="text-sm">Loading support tickets...</div>
					</div>
				) : filteredTickets.length === 0 ? (
					<div className="text-center py-12 text-gray-500">
						<div className="text-sm">No support tickets found</div>
					</div>
				) : (
					filteredTickets.map((ticket) => (
						<div
							key={ticket.id}
							className="grid grid-cols-12 gap-4 px-4 py-4 bg-white border border-gray-200 rounded-lg items-center hover:bg-gray-50"
						>
							<div className="col-span-3">
								<div className="text-sm mb-1">{ticket.ticketId}</div>
								<div className="text-sm text-gray-900">{ticket.vendorName}</div>
								<div className="text-xs text-gray-500 mt-1">{ticket.issue}</div>
							</div>

							<div className="col-span-2">
								<span
									className={`inline-block px-3 py-1 text-xs rounded-full border ${getPriorityColor(ticket.priority)}`}
								>
									{ticket.priority.charAt(0).toUpperCase() +
										ticket.priority.slice(1)}
								</span>
							</div>

							<div className="col-span-2">
								<span className={`text-sm ${getStatusColor(ticket.status)}`}>
									{ticket.status === "in-progress"
										? "In Progress"
										: ticket.status.charAt(0).toUpperCase() +
											ticket.status.slice(1)}
								</span>
							</div>

							<div className="col-span-2">
								<div className="text-sm">{ticket.assignedTo}</div>
							</div>

							<div className="col-span-2">
								<div className="text-sm">{ticket.created}</div>
							</div>

							<div className="col-span-1 flex items-center gap-2">
								<button
									onClick={() => handleViewTicket(ticket.id)}
									className="p-1.5 hover:bg-blue-50 rounded-lg"
								>
									<Eye className="w-4 h-4 text-blue-600" />
								</button>
								<button
									onClick={() => handleCallVendor(ticket.vendorId)}
									className="p-1.5 hover:bg-green-50 rounded-lg"
								>
									<Phone className="w-4 h-4 text-green-600" />
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
