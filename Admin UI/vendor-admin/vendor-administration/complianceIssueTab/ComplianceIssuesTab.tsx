import { useState, useEffect } from "react";
import { Eye, Phone } from "lucide-react";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";
import { CustomDropdown } from "../CustomDropdown";

interface ComplianceIssue {
	id: string;
	vendorName: string;
	vendorId: string;
	alertDetails: string;
	priority: "high" | "medium" | "low";
	type: "rating" | "complaints" | "license" | "documentation";
	dateReported: string;
	status: "open" | "investigating" | "resolved" | "closed";
}

export function ComplianceIssuesTab() {
	const [issues, setIssues] = useState<ComplianceIssue[]>([]);
	const [loading, setLoading] = useState(true);
	const [typeFilter, setTypeFilter] = useState("all");
	const [priorityFilter, setPriorityFilter] = useState("all");

	useEffect(() => {
		loadComplianceIssues();
	}, []);

	const loadComplianceIssues = async () => {
		try {
			setLoading(true);

			const response = await fetch(
				`${getApiBaseUrl()}/admin/vendors/compliance/issues`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setIssues(data.issues || []);
			}
		} catch (error) {
			console.error("Error loading compliance issues:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleViewIssue = (issueId: string) => {
		console.log("View issue:", issueId);
		// Open issue details modal
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
			case "investigating":
				return "text-blue-600";
			case "resolved":
				return "text-green-600";
			case "closed":
				return "text-gray-600";
			default:
				return "text-gray-600";
		}
	};

	const filteredIssues = issues.filter((issue) => {
		if (priorityFilter !== "all" && issue.priority !== priorityFilter)
			return false;
		if (typeFilter !== "all" && issue.type !== typeFilter) return false;
		return true;
	});

	return (
		<div>
			<div className="mb-4">
				<div className="text-sm text-gray-600 mb-4">
					Current Compliance Issues
				</div>

				<div className="flex items-center justify-between mb-4">
					<h3 className="text-base">Compliance Issues</h3>
					<div className="flex gap-3">
						<CustomDropdown
							options={[
								{ value: "all", label: "All Types" },
								{ value: "rating", label: "Rating" },
								{ value: "complaints", label: "Complaints" },
								{ value: "license", label: "License" },
								{ value: "documentation", label: "Documentation" },
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
				<div className="col-span-3">Alert Details</div>
				<div className="col-span-2">Priority</div>
				<div className="col-span-2">Type</div>
				<div className="col-span-2">Date Reported</div>
				<div className="col-span-2">Status</div>
				<div className="col-span-1">Actions</div>
			</div>

			{/* Issues List */}
			<div className="space-y-2">
				{loading ? (
					<div className="text-center py-12 text-gray-500">
						<div className="text-sm">Loading compliance issues...</div>
					</div>
				) : filteredIssues.length === 0 ? (
					<div className="text-center py-12 text-gray-500">
						<div className="text-sm">No compliance issues found</div>
					</div>
				) : (
					filteredIssues.map((issue) => (
						<div
							key={issue.id}
							className="grid grid-cols-12 gap-4 px-4 py-4 bg-white border border-gray-200 rounded-lg items-center hover:bg-gray-50"
						>
							<div className="col-span-3">
								<div className="flex items-center gap-2 mb-1">
									<span
										className={`w-2 h-2 rounded-full ${
											issue.priority === "high"
												? "bg-red-500"
												: issue.priority === "medium"
													? "bg-orange-500"
													: "bg-yellow-500"
										}`}
									></span>
									<div className="text-sm">{issue.vendorName}</div>
								</div>
								<div className="text-xs text-red-600 ml-4">
									{issue.alertDetails}
								</div>
							</div>

							<div className="col-span-2">
								<span
									className={`inline-block px-3 py-1 text-xs rounded-full border ${getPriorityColor(issue.priority)}`}
								>
									{issue.priority.charAt(0).toUpperCase() +
										issue.priority.slice(1)}
								</span>
							</div>

							<div className="col-span-2">
								<div className="text-sm">
									{issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}
								</div>
							</div>

							<div className="col-span-2">
								<div className="text-sm">{issue.dateReported}</div>
							</div>

							<div className="col-span-2">
								<span className={`text-sm ${getStatusColor(issue.status)}`}>
									{issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
								</span>
							</div>

							<div className="col-span-1 flex items-center gap-2">
								<button
									onClick={() => handleViewIssue(issue.id)}
									className="p-1.5 hover:bg-blue-50 rounded-lg"
								>
									<Eye className="w-4 h-4 text-blue-600" />
								</button>
								<button
									onClick={() => handleCallVendor(issue.vendorId)}
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
