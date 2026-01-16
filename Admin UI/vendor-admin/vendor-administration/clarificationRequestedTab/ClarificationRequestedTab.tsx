import { useState, useEffect } from "react";
import {
	MessageCircle,
	Eye,
	Clock,
	AlertCircle,
	Send,
	RefreshCw,
} from "lucide-react";
import { Button } from "@repo/ui";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
interface ClarificationVendor {
	id: string;
	vendorId: string;
	fullName: string;
	businessName?: string;
	phone: string;
	email: string;
	vendorType: string;
	status: string;
	infoRequestedAt: string;
	infoRequestedBy: string;
	infoRequestMessage: string;
	infoRequiredFields: string[];
	daysSinceRequest: number;
}

interface ClarificationRequestedTabProps {
	onViewDetails: (vendor: ClarificationVendor) => void;
}

export function ClarificationRequestedTab({
	onViewDetails,
}: ClarificationRequestedTabProps) {
	const [vendors, setVendors] = useState<ClarificationVendor[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<"all" | "urgent" | "recent">("all");

	useEffect(() => {
		loadClarificationVendors();
	}, []);

	const loadClarificationVendors = async () => {
		try {
			setLoading(true);
			console.log("📋 Loading vendors with clarification requests...");

			// Fetch all vendors and filter by more_info_required status
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/all`,
				{
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (response.ok) {
				const data = await response.json();
				const allVendors = data.vendors || [];

				// Filter vendors with more_info_required status
				const clarificationVendors = allVendors
					.filter(
						(v: any) =>
							v.status === "more_info_required" ||
							v.status === "clarification_requested"
					)
					.map((v: any) => {
						const requestedDate = new Date(v.infoRequestedAt || v.createdAt);
						const daysSinceRequest = Math.floor(
							(Date.now() - requestedDate.getTime()) / (1000 * 60 * 60 * 24)
						);

						return {
							id: v.id,
							vendorId: v.id,
							fullName: v.fullName || v.businessName || "Unknown",
							businessName: v.businessName,
							phone: v.phone,
							email: v.email,
							vendorType: v.vendorType || v.roleName || "Service Provider",
							status: v.status,
							infoRequestedAt: v.infoRequestedAt,
							infoRequestedBy: v.infoRequestedBy || "Admin",
							infoRequestMessage:
								v.infoRequestMessage || "Clarification required",
							infoRequiredFields: v.infoRequiredFields || [],
							daysSinceRequest,
						};
					});

				console.log(
					`✅ Found ${clarificationVendors.length} vendors awaiting clarification`
				);
				setVendors(clarificationVendors);
			} else {
				console.error("❌ Failed to load vendors");
				setVendors([]);
			}
		} catch (error) {
			console.error("Error loading clarification vendors:", error);
			setVendors([]);
		} finally {
			setLoading(false);
		}
	};

	const filteredVendors = vendors.filter((vendor) => {
		if (filter === "urgent") {
			return vendor.daysSinceRequest > 3; // More than 3 days waiting
		}
		if (filter === "recent") {
			return vendor.daysSinceRequest <= 1; // Requested today or yesterday
		}
		return true; // all
	});

	const handleFollowUp = async (vendor: ClarificationVendor) => {
		const followUpMessage = prompt("Enter follow-up message:");
		if (!followUpMessage) return;

		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/request-info`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						vendorId: vendor.vendorId,
						requestedBy: "Admin",
						message: `FOLLOW-UP: ${followUpMessage}`,
						requiredFields: vendor.infoRequiredFields,
					}),
				}
			);

			if (response.ok) {
				alert("Follow-up sent successfully!");
				loadClarificationVendors();
			} else {
				alert("Failed to send follow-up");
			}
		} catch (error) {
			console.error("Error sending follow-up:", error);
			alert("Error sending follow-up");
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center">
					<RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
					<p className="text-sm text-gray-500">
						Loading clarification requests...
					</p>
				</div>
			</div>
		);
	}

	if (vendors.length === 0) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center">
					<MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
					<h3 className="text-base text-gray-900 mb-1">
						No Clarification Requests
					</h3>
					<p className="text-sm text-gray-500">
						All vendors have complete applications
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-base text-gray-900">
						Vendors Awaiting Clarification
					</h3>
					<p className="text-sm text-gray-500">
						{filteredVendors.length} vendor(s) need to provide additional
						information
					</p>
				</div>

				<div className="flex items-center gap-3">
					<select
						value={filter}
						onChange={(e) => setFilter(e.target.value as any)}
						className="text-sm border border-gray-200 rounded-lg px-3 py-2"
					>
						<option value="all">All Requests</option>
						<option value="urgent">Urgent (3+ days)</option>
						<option value="recent">Recent (0-1 days)</option>
					</select>

					<Button
						variant="outline"
						size="sm"
						onClick={loadClarificationVendors}
					>
						<RefreshCw className="w-4 h-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			{/* Clarification List */}
			<div className="space-y-3">
				{filteredVendors.map((vendor) => (
					<div
						key={vendor.id}
						className={`border rounded-lg p-4 transition-all ${
							vendor.daysSinceRequest > 7
								? "border-red-200 bg-red-50"
								: vendor.daysSinceRequest > 3
									? "border-orange-200 bg-orange-50"
									: "border-gray-200 bg-white hover:bg-gray-50"
						}`}
					>
						<div className="flex items-start justify-between">
							<div className="flex-1">
								<div className="flex items-center gap-3 mb-2">
									<div>
										<h4 className="text-sm font-medium text-gray-900">
											{vendor.fullName}
											{vendor.businessName &&
												vendor.businessName !== vendor.fullName && (
													<span className="text-gray-500 ml-2">
														({vendor.businessName})
													</span>
												)}
										</h4>
										<p className="text-xs text-gray-500 mt-0.5">
											{vendor.vendorType} • {vendor.phone}
										</p>
									</div>

									{/* Urgency Badge */}
									{vendor.daysSinceRequest > 7 && (
										<span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
											<AlertCircle className="w-3 h-3" />
											Overdue
										</span>
									)}
									{vendor.daysSinceRequest > 3 &&
										vendor.daysSinceRequest <= 7 && (
											<span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
												<Clock className="w-3 h-3" />
												Urgent
											</span>
										)}
								</div>

								{/* Request Message */}
								<div className="bg-white/80 rounded-lg p-3 mb-2 border border-gray-100">
									<div className="flex items-start gap-2">
										<MessageCircle className="w-4 h-4 text-[#FF8C42] mt-0.5 flex-shrink-0" />
										<div className="flex-1">
											<p className="text-xs text-gray-600 mb-1">
												<span className="font-medium text-gray-900">
													{vendor.infoRequestedBy}
												</span>{" "}
												requested clarification:
											</p>
											<p className="text-sm text-gray-900">
												{vendor.infoRequestMessage}
											</p>

											{vendor.infoRequiredFields &&
												vendor.infoRequiredFields.length > 0 && (
													<div className="mt-2">
														<p className="text-xs text-gray-500 mb-1">
															Required fields:
														</p>
														<div className="flex flex-wrap gap-1">
															{vendor.infoRequiredFields.map((field, idx) => (
																<span
																	key={idx}
																	className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
																>
																	{field}
																</span>
															))}
														</div>
													</div>
												)}
										</div>
									</div>
								</div>

								{/* Timeline */}
								<div className="flex items-center gap-4 text-xs text-gray-500">
									<span className="flex items-center gap-1">
										<Clock className="w-3 h-3" />
										Requested{" "}
										{vendor.daysSinceRequest === 0
											? "today"
											: `${vendor.daysSinceRequest} day${vendor.daysSinceRequest > 1 ? "s" : ""} ago`}
									</span>
									<span>
										{new Date(vendor.infoRequestedAt).toLocaleDateString(
											"en-US",
											{
												month: "short",
												day: "numeric",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											}
										)}
									</span>
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-2 ml-4">
								<button
									onClick={() => handleFollowUp(vendor)}
									className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
									title="Send Follow-up"
								>
									<Send className="w-4 h-4 text-orange-600" />
								</button>
								<button
									onClick={() => onViewDetails(vendor)}
									className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
									title="View Application Details"
								>
									<Eye className="w-4 h-4 text-blue-600" />
								</button>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Summary Footer */}
			<div className="mt-6 pt-4 border-t border-gray-200">
				<div className="grid grid-cols-3 gap-4 text-center">
					<div>
						<div className="text-2xl font-semibold text-gray-900">
							{vendors.length}
						</div>
						<div className="text-xs text-gray-500">Total Requests</div>
					</div>
					<div>
						<div className="text-2xl font-semibold text-orange-600">
							{vendors.filter((v) => v.daysSinceRequest > 3).length}
						</div>
						<div className="text-xs text-gray-500">Urgent (3+ days)</div>
					</div>
					<div>
						<div className="text-2xl font-semibold text-red-600">
							{vendors.filter((v) => v.daysSinceRequest > 7).length}
						</div>
						<div className="text-xs text-gray-500">Overdue (7+ days)</div>
					</div>
				</div>
			</div>
		</div>
	);
}
