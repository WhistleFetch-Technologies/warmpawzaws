import { useState, useEffect } from "react";
import { Check, X, Eye, Download, Sparkles, MessageSquare } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Textarea,
	Button,
} from "@repo/ui";

import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
import { toast } from "sonner";

interface RateChangeRequest {
	id: string;
	originalRequestId?: string;
	vendorId: string;
	businessName: string;
	service: string;
	description?: string;
	currentRate: number;
	proposedRate: number;
	changePercentage: string;
	reason: string;
	status: "pending" | "approved" | "rejected";
	requestedAt: string;
	adminNote?: string;
	type?: "custom_service" | "rate_change";
	duration?: number;
	categoryName?: string;
	subCategoryName?: string;
	isCustomService?: boolean;
	serviceStyle?: string;
	isPackage?: boolean;
	packageDetails?: any;
}

export function RateChangesTab() {
	const [requests, setRequests] = useState<RateChangeRequest[]>([]);
	const [loading, setLoading] = useState(true);

	// Modal states
	const [detailModalOpen, setDetailModalOpen] = useState(false);
	const [approveModalOpen, setApproveModalOpen] = useState(false);
	const [rejectModalOpen, setRejectModalOpen] = useState(false);
	const [clarifyModalOpen, setClarifyModalOpen] = useState(false);

	const [selectedRequest, setSelectedRequest] =
		useState<RateChangeRequest | null>(null);
	const [adminNote, setAdminNote] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [clarificationMessage, setClarificationMessage] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	useEffect(() => {
		loadRequests();
	}, []);

	const loadRequests = async () => {
		try {
			setLoading(true);
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes`,
				{
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (response.ok) {
				const data = await response.json();
				console.log("📊 Rate Changes loaded:", data.rateChanges?.length || 0);
				setRequests(data.rateChanges || []);
			}
		} catch (error) {
			console.error("Error loading rate changes:", error);
			toast.error("Failed to load rate changes");
		} finally {
			setLoading(false);
		}
	};

	const openDetailModal = (request: RateChangeRequest) => {
		setSelectedRequest(request);
		setDetailModalOpen(true);
	};

	const openApproveModal = (request: RateChangeRequest) => {
		setSelectedRequest(request);
		setAdminNote("");
		setApproveModalOpen(true);
	};

	const openRejectModal = (request: RateChangeRequest) => {
		setSelectedRequest(request);
		setRejectionReason("");
		setRejectModalOpen(true);
	};

	const openClarifyModal = (request: RateChangeRequest) => {
		setSelectedRequest(request);
		setClarificationMessage("");
		setClarifyModalOpen(true);
	};

	const handleApprove = async () => {
		if (!selectedRequest) return;

		const requestId = selectedRequest.originalRequestId || selectedRequest.id;

		setActionLoading(true);
		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes/${requestId}/approve`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${publicAnonKey}`,
					},
					body: JSON.stringify({ adminNote: adminNote || "" }),
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to approve");
			}

			const result = await response.json();
			console.log("✅ Approve result:", result);

			toast.success(`Service "${selectedRequest.service}" approved!`, {
				description: "The service is now live and visible to customers.",
			});

			setApproveModalOpen(false);
			setDetailModalOpen(false);
			loadRequests();
		} catch (error) {
			console.error("❌ Error approving:", error);
			toast.error("Failed to approve service", {
				description: String(error),
			});
		} finally {
			setActionLoading(false);
		}
	};

	const handleReject = async () => {
		if (!selectedRequest || !rejectionReason.trim()) {
			toast.error("Rejection reason is required");
			return;
		}

		const requestId = selectedRequest.originalRequestId || selectedRequest.id;

		setActionLoading(true);
		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes/${requestId}/reject`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${publicAnonKey}`,
					},
					body: JSON.stringify({ adminNote: rejectionReason }),
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to reject");
			}

			const result = await response.json();
			console.log("❌ Reject result:", result);

			toast.success(`Service "${selectedRequest.service}" rejected`, {
				description: "Vendor has been notified with your reason.",
			});

			setRejectModalOpen(false);
			setDetailModalOpen(false);
			loadRequests();
		} catch (error) {
			console.error("❌ Error rejecting:", error);
			toast.error("Failed to reject service", {
				description: String(error),
			});
		} finally {
			setActionLoading(false);
		}
	};

	const handleClarification = async () => {
		if (!selectedRequest || !clarificationMessage.trim()) {
			toast.error("Clarification message is required");
			return;
		}

		const requestId = selectedRequest.originalRequestId || selectedRequest.id;

		setActionLoading(true);
		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/rate-changes/${requestId}/clarification`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${publicAnonKey}`,
					},
					body: JSON.stringify({ adminNote: clarificationMessage }),
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to request clarification");
			}

			const result = await response.json();
			console.log("💬 Clarification result:", result);

			toast.success("Clarification requested", {
				description: "Vendor has been notified and can provide more details.",
			});

			setClarifyModalOpen(false);
			setDetailModalOpen(false);
			loadRequests();
		} catch (error) {
			console.error("❌ Error requesting clarification:", error);
			toast.error("Failed to request clarification", {
				description: String(error),
			});
		} finally {
			setActionLoading(false);
		}
	};

	const handleExport = () => {
		const csv = [
			[
				"Request ID",
				"Business Name",
				"Service",
				"Current Rate",
				"Proposed Rate",
				"Change %",
				"Status",
				"Type",
			],
			...requests.map((r) => [
				r.id,
				r.businessName,
				r.service,
				r.currentRate || 0,
				r.proposedRate,
				r.changePercentage,
				r.status,
				r.type || "rate_change",
			]),
		]
			.map((row) => row.join(","))
			.join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `rate-changes-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-600">Loading rate change requests...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-gray-900">Service Rate Changes & Approvals</h2>
					<p className="text-sm text-gray-500 mt-1">
						Review and approve custom services, packages, and rate changes from
						vendors
					</p>
				</div>
				<Button
					onClick={handleExport}
					variant="outline"
					size="sm"
					className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
				>
					<Download className="w-4 h-4" />
					Export List
				</Button>
			</div>

			{/* Table */}
			<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
				<table className="w-full">
					<thead className="bg-gray-50 border-b border-gray-200">
						<tr>
							<th className="px-6 py-3.5 text-left text-xs text-gray-500">
								Rate Change Details
							</th>
							<th className="px-6 py-3.5 text-left text-xs text-gray-500">
								Service
							</th>
							<th className="px-6 py-3.5 text-left text-xs text-gray-500">
								Current
							</th>
							<th className="px-6 py-3.5 text-left text-xs text-gray-500">
								Proposed
							</th>
							<th className="px-6 py-3.5 text-left text-xs text-gray-500">
								Change %
							</th>
							<th className="px-6 py-3.5 text-left text-xs text-gray-500">
								Status
							</th>
							<th className="px-6 py-3.5 text-right text-xs text-gray-500">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200">
						{requests.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-6 py-12 text-center">
									<div className="text-gray-400">
										<Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
										<p className="text-gray-600 font-medium">
											No pending rate changes
										</p>
										<p className="text-sm text-gray-500 mt-1">
											All custom services and rate changes have been reviewed
										</p>
									</div>
								</td>
							</tr>
						) : (
							requests.map((request) => (
								<tr
									key={request.id}
									className="hover:bg-gray-50 transition-colors"
								>
									<td className="px-6 py-4">
										<div>
											<div className="flex items-center gap-2 mb-1">
												<div className="text-xs text-gray-500">
													#{request.id.substring(0, 20)}
												</div>
												{request.type === "custom_service" && (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200">
														<Sparkles className="w-3 h-3" />
														Custom Service
													</span>
												)}
											</div>
											<div className="text-gray-900">
												{request.businessName}
											</div>
											{request.description && (
												<div className="text-sm text-gray-600 mt-1 line-clamp-2">
													{request.description}
												</div>
											)}
											<div className="text-sm text-gray-500 mt-1 line-clamp-1">
												{request.reason}
											</div>
											{request.categoryName && (
												<div className="text-xs text-gray-500 mt-1">
													Category: {request.categoryName}
													{request.subCategoryName &&
														` / ${request.subCategoryName}`}
												</div>
											)}
										</div>
									</td>
									<td className="px-6 py-4">
										<div className="text-gray-900">{request.service}</div>
										{request.duration && (
											<div className="text-xs text-gray-500 mt-1">
												{request.duration} min
											</div>
										)}
									</td>
									<td className="px-6 py-4">
										<div className="text-gray-900">
											{request.type === "custom_service"
												? "—"
												: `₹${request.currentRate}`}
										</div>
									</td>
									<td className="px-6 py-4">
										<div className="text-blue-600">₹{request.proposedRate}</div>
									</td>
									<td className="px-6 py-4">
										<div
											className={
												request.type === "custom_service"
													? "text-orange-600 font-medium"
													: "text-green-600"
											}
										>
											{request.changePercentage}
										</div>
									</td>
									<td className="px-6 py-4">
										<span
											className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
												request.status === "pending"
													? "bg-blue-50 text-blue-700 border border-blue-200"
													: request.status === "approved"
														? "bg-green-50 text-green-700 border border-green-200"
														: "bg-red-50 text-red-700 border border-red-200"
											}`}
										>
											{request.status.charAt(0).toUpperCase() +
												request.status.slice(1)}
										</span>
									</td>
									<td className="px-6 py-4">
										<div className="flex items-center justify-end gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={() => openDetailModal(request)}
												className="gap-1.5 border-gray-300"
											>
												<Eye className="w-3.5 h-3.5" />
												View
											</Button>
											{request.status === "pending" && (
												<>
													<Button
														size="sm"
														onClick={() => openApproveModal(request)}
														className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
													>
														<Check className="w-3.5 h-3.5" />
														Approve
													</Button>
													<Button
														size="sm"
														variant="destructive"
														onClick={() => openRejectModal(request)}
														className="gap-1.5"
													>
														<X className="w-3.5 h-3.5" />
														Reject
													</Button>
												</>
											)}
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* ============================================ */}
			{/* DETAIL MODAL */}
			{/* ============================================ */}
			<Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					{selectedRequest && (
						<>
							<DialogHeader>
								<DialogTitle>Service Details</DialogTitle>
								<DialogDescription>
									Complete information about this service request
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-6">
								{/* Vendor Info */}
								<div className="bg-gray-50 rounded-lg p-4 space-y-3">
									<h3 className="font-medium text-gray-900">
										Vendor Information
									</h3>
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<span className="text-gray-500">Business Name:</span>
											<p className="font-medium text-gray-900 mt-1">
												{selectedRequest.businessName}
											</p>
										</div>
										<div>
											<span className="text-gray-500">Vendor ID:</span>
											<p className="font-medium text-gray-900 mt-1">
												{selectedRequest.vendorId}
											</p>
										</div>
										<div>
											<span className="text-gray-500">Service Style:</span>
											<p className="font-medium text-gray-900 mt-1 capitalize">
												{selectedRequest.serviceStyle?.replace("_", " ") ||
													"N/A"}
											</p>
										</div>
										<div>
											<span className="text-gray-500">Submitted:</span>
											<p className="font-medium text-gray-900 mt-1">
												{new Date(selectedRequest.requestedAt).toLocaleString()}
											</p>
										</div>
									</div>
								</div>

								{/* Service Info */}
								<div className="bg-blue-50 rounded-lg p-4 space-y-3">
									<div className="flex items-center justify-between">
										<h3 className="font-medium text-gray-900">
											Service Information
										</h3>
										{selectedRequest.type === "custom_service" && (
											<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700 border border-orange-300">
												<Sparkles className="w-3 h-3" />
												Custom Service
											</span>
										)}
									</div>
									<div className="space-y-3 text-sm">
										<div>
											<span className="text-gray-600">Service Name:</span>
											<p className="font-medium text-gray-900 mt-1">
												{selectedRequest.service}
											</p>
										</div>
										{selectedRequest.description && (
											<div>
												<span className="text-gray-600">Description:</span>
												<p className="text-gray-900 mt-1">
													{selectedRequest.description}
												</p>
											</div>
										)}
										<div className="grid grid-cols-2 gap-4">
											<div>
												<span className="text-gray-600">Category:</span>
												<p className="font-medium text-gray-900 mt-1">
													{selectedRequest.categoryName || "N/A"}
												</p>
											</div>
											{selectedRequest.subCategoryName && (
												<div>
													<span className="text-gray-600">Sub-Category:</span>
													<p className="font-medium text-gray-900 mt-1">
														{selectedRequest.subCategoryName}
													</p>
												</div>
											)}
										</div>
										{selectedRequest.duration && (
											<div>
												<span className="text-gray-600">Duration:</span>
												<p className="font-medium text-gray-900 mt-1">
													{selectedRequest.duration} minutes
												</p>
											</div>
										)}
									</div>
								</div>

								{/* Pricing Info */}
								<div className="bg-green-50 rounded-lg p-4 space-y-3">
									<h3 className="font-medium text-gray-900">Pricing Details</h3>
									<div className="grid grid-cols-3 gap-4 text-sm">
										<div>
											<span className="text-gray-600">Current Rate:</span>
											<p className="text-xl font-medium text-gray-900 mt-1">
												{selectedRequest.type === "custom_service"
													? "—"
													: `₹${selectedRequest.currentRate}`}
											</p>
										</div>
										<div>
											<span className="text-gray-600">Proposed Rate:</span>
											<p className="text-xl font-medium text-blue-600 mt-1">
												₹{selectedRequest.proposedRate}
											</p>
										</div>
										<div>
											<span className="text-gray-600">Change:</span>
											<p
												className={`text-xl font-medium mt-1 ${
													selectedRequest.type === "custom_service"
														? "text-orange-600"
														: "text-green-600"
												}`}
											>
												{selectedRequest.changePercentage}
											</p>
										</div>
									</div>
								</div>

								{/* Reason */}
								<div>
									<span className="text-sm text-gray-600">
										Reason for Change:
									</span>
									<p className="text-gray-900 mt-1 bg-gray-50 p-3 rounded-lg">
										{selectedRequest.reason}
									</p>
								</div>

								{/* Package Details */}
								{selectedRequest.isPackage &&
									selectedRequest.packageDetails && (
										<div className="bg-purple-50 rounded-lg p-4 space-y-2">
											<h3 className="font-medium text-gray-900">
												Package Details
											</h3>
											<pre className="text-xs text-gray-700 overflow-auto">
												{JSON.stringify(
													selectedRequest.packageDetails,
													null,
													2
												)}
											</pre>
										</div>
									)}
							</div>

							<DialogFooter className="gap-2">
								<Button
									variant="outline"
									onClick={() => setDetailModalOpen(false)}
								>
									Close
								</Button>
								{selectedRequest.status === "pending" && (
									<>
										<Button
											variant="outline"
											onClick={() => {
												setDetailModalOpen(false);
												openClarifyModal(selectedRequest);
											}}
											className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
										>
											<MessageSquare className="w-4 h-4" />
											Request Clarification
										</Button>
										<Button
											variant="destructive"
											onClick={() => {
												setDetailModalOpen(false);
												openRejectModal(selectedRequest);
											}}
											className="gap-2"
										>
											<X className="w-4 h-4" />
											Reject
										</Button>
										<Button
											onClick={() => {
												setDetailModalOpen(false);
												openApproveModal(selectedRequest);
											}}
											className="gap-2 bg-green-600 hover:bg-green-700"
										>
											<Check className="w-4 h-4" />
											Approve & Publish
										</Button>
									</>
								)}
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* ============================================ */}
			{/* APPROVE MODAL */}
			{/* ============================================ */}
			<Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
				<DialogContent className="sm:max-w-md">
					{selectedRequest && (
						<>
							<DialogHeader>
								<DialogTitle>Approve Service</DialogTitle>
								<DialogDescription>
									You're approving "{selectedRequest.service}" from{" "}
									{selectedRequest.businessName}
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								<div className="bg-green-50 border border-green-200 rounded-lg p-4">
									<p className="text-sm text-gray-700">
										This service will be set to{" "}
										<span className="font-semibold text-green-700">"live"</span>{" "}
										status and will be{" "}
										<span className="font-semibold">
											immediately visible to customers
										</span>
										.
									</p>
									<p className="text-sm text-green-700 font-medium mt-2">
										Rate: ₹{selectedRequest.proposedRate}
										{selectedRequest.duration &&
											` • ${selectedRequest.duration} min`}
									</p>
								</div>

								<div>
									<label className="text-sm font-medium text-gray-700">
										Admin Note (Optional)
									</label>
									<Textarea
										placeholder="e.g., Approved - pricing is reasonable for this service"
										value={adminNote}
										onChange={(e) => setAdminNote(e.target.value)}
										rows={3}
										className="mt-1"
									/>
								</div>
							</div>

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setApproveModalOpen(false)}
									disabled={actionLoading}
								>
									Cancel
								</Button>
								<Button
									onClick={handleApprove}
									disabled={actionLoading}
									className="bg-green-600 hover:bg-green-700"
								>
									{actionLoading ? "Approving..." : "✅ Approve & Publish"}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* ============================================ */}
			{/* REJECT MODAL */}
			{/* ============================================ */}
			<Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
				<DialogContent className="sm:max-w-md">
					{selectedRequest && (
						<>
							<DialogHeader>
								<DialogTitle>Reject Service</DialogTitle>
								<DialogDescription>
									You're rejecting "{selectedRequest.service}" from{" "}
									{selectedRequest.businessName}
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								<div className="bg-red-50 border border-red-200 rounded-lg p-4">
									<p className="text-sm text-gray-700">
										This service will be set to{" "}
										<span className="font-semibold text-red-700">
											"rejected"
										</span>{" "}
										status.
									</p>
									<p className="text-sm text-red-700 font-medium mt-2">
										• Service will be DISABLED in vendor app
										<br />
										• Will NOT be visible to customers
										<br />• Vendor will receive notification with your reason
									</p>
								</div>

								<div>
									<label className="text-sm font-medium text-red-600">
										Rejection Reason (Required) *
									</label>
									<Textarea
										placeholder="e.g., Price is too high compared to market rates. Please adjust to ₹800-1000 range."
										value={rejectionReason}
										onChange={(e) => setRejectionReason(e.target.value)}
										rows={4}
										className="mt-1 border-red-300 focus:border-red-500"
										required
									/>
									<p className="text-xs text-gray-500 mt-1">
										Vendor will receive this message and can edit and resubmit.
									</p>
								</div>
							</div>

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setRejectModalOpen(false)}
									disabled={actionLoading}
								>
									Cancel
								</Button>
								<Button
									variant="destructive"
									onClick={handleReject}
									disabled={actionLoading || !rejectionReason.trim()}
								>
									{actionLoading ? "Rejecting..." : "❌ Reject Service"}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* ============================================ */}
			{/* CLARIFICATION MODAL */}
			{/* ============================================ */}
			<Dialog open={clarifyModalOpen} onOpenChange={setClarifyModalOpen}>
				<DialogContent className="sm:max-w-md">
					{selectedRequest && (
						<>
							<DialogHeader>
								<DialogTitle>Request Clarification</DialogTitle>
								<DialogDescription>
									Ask "{selectedRequest.businessName}" for more details about "
									{selectedRequest.service}"
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4">
								<div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
									<p className="text-sm text-gray-700">
										This service will be set to{" "}
										<span className="font-semibold text-orange-700">
											"needs_clarification"
										</span>{" "}
										status.
									</p>
									<p className="text-sm text-orange-700 font-medium mt-2">
										• Vendor can edit and provide more details
										<br />
										• Service will NOT be visible to customers
										<br />• Returns to pending after vendor resubmits
									</p>
								</div>

								<div>
									<label className="text-sm font-medium text-orange-600">
										Clarification Message (Required) *
									</label>
									<Textarea
										placeholder="e.g., Can you provide more details about what's included in this service? Please specify duration and any additional charges."
										value={clarificationMessage}
										onChange={(e) => setClarificationMessage(e.target.value)}
										rows={4}
										className="mt-1 border-orange-300 focus:border-orange-500"
										required
									/>
									<p className="text-xs text-gray-500 mt-1">
										Vendor will receive this message via notification.
									</p>
								</div>
							</div>

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setClarifyModalOpen(false)}
									disabled={actionLoading}
								>
									Cancel
								</Button>
								<Button
									onClick={handleClarification}
									disabled={actionLoading || !clarificationMessage.trim()}
									className="bg-orange-600 hover:bg-orange-700"
								>
									{actionLoading ? "Sending..." : "💬 Request Clarification"}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
