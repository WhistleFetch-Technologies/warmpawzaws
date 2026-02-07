/**
 * CANCELLATION POLICY MANAGEMENT
 * Enterprise-grade cancellation policy management with vendor-specific rules and grace periods
 */

import { useState, useEffect } from "react";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
	Checkbox,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Badge,
	Switch,
	Label,
	Input,
	Button,
} from "@repo/ui";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from '../../ui/table';
import {
	Plus,
	Edit2,
	Trash2,
	FileCheck,
	Search,
	RefreshCw,
	Clock,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";
import { toast } from "sonner";

interface CancellationPolicy {
	id: string;
	name: string;
	description: string;
	policyType: "standard" | "vendor_specific" | "service_specific";
	vendorTypes: string[];
	serviceTypes: string[];
	gracePeriodHours: number;
	cancellationWindows: {
		hoursBefore: number;
		refundPercentage: number;
		cancellationFee: number;
		penaltyPercentage: number;
	}[];
	vendorCancellationPenalty: {
		enabled: boolean;
		penaltyPercentage: number;
		compensationPercentage: number;
	};
	noShowPolicy: {
		enabled: boolean;
		refundPercentage: number;
		penaltyAmount: number;
	};
	isActive: boolean;
	priority: number;
	createdAt?: string;
	updatedAt?: string;
}

const VENDOR_TYPES = [
	{ id: "veterinarian", name: "Veterinarian", icon: "⚕️" },
	{ id: "veterinary_clinic", name: "Veterinary Clinic", icon: "🏥" },
	{ id: "pet_groomer", name: "Pet Groomer", icon: "✂️" },
	{ id: "pet_trainer", name: "Pet Trainer", icon: "🎓" },
	{ id: "pet_walker", name: "Pet Walker", icon: "🐕" },
	{ id: "pet_boarding", name: "Pet Boarding", icon: "🏖️" },
	{ id: "pet_resort", name: "Pet Resort", icon: "🏨" },
	{ id: "pet_sitter", name: "Pet Sitter", icon: "🏡" },
	{ id: "pet_pharmacy", name: "Pet Pharmacy", icon: "💊" },
	{ id: "pet_products_store", name: "Pet Products Store", icon: "🛒" },
	{ id: "pet_cafe", name: "Pet Cafe", icon: "☕" },
	{ id: "nutritionist", name: "Nutritionist", icon: "🥗" },
	{ id: "pet_behaviorist", name: "Pet Behaviorist", icon: "🧠" },
];

const SERVICE_TYPES = [
	{ id: "at_home", name: "At Home", icon: "🏠" },
	{ id: "at_center", name: "At Center", icon: "🏢" },
	{ id: "video_consultation", name: "Video Consultation", icon: "📹" },
	{ id: "delivery", name: "Delivery", icon: "🚚" },
	{ id: "pickup", name: "Pickup", icon: "📦" },
];

export function CancellationPolicyManagement() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
	const [showModal, setShowModal] = useState(false);
	const [editingPolicy, setEditingPolicy] = useState<CancellationPolicy | null>(
		null
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<
		"all" | "standard" | "vendor_specific" | "service_specific"
	>("all");

	const API_BASE = `${getApiBaseUrl()}`;

	useEffect(() => {
		loadPolicies();
	}, []);

	const loadPolicies = async () => {
		setLoading(true);
		try {
			const response = await fetch(
				`${API_BASE}/admin/finance/cancellation-policies`,
				{
					headers: { ...getAuthHeaders() },
				}
			);

			if (response.ok) {
				const data = await response.json();
				setPolicies(data.policies || []);
			}
		} catch (error) {
			console.error("Error loading cancellation policies:", error);
			toast.error("Failed to load cancellation policies");
		} finally {
			setLoading(false);
		}
	};

	const handleSavePolicy = async () => {
		if (!editingPolicy || !editingPolicy.name) {
			toast.error("Please fill all required fields");
			return;
		}

		if (editingPolicy.cancellationWindows.length === 0) {
			toast.error("Please add at least one cancellation window");
			return;
		}

		setSaving(true);
		try {
			const method = editingPolicy.id ? "PUT" : "POST";
			const url = editingPolicy.id
				? `${API_BASE}/admin/finance/cancellation-policies/${editingPolicy.id}`
				: `${API_BASE}/admin/finance/cancellation-policies`;

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					...getAuthHeaders(),
				},
				body: JSON.stringify(editingPolicy),
			});

			if (response.ok) {
				toast.success(
					`Cancellation policy ${editingPolicy.id ? "updated" : "created"} successfully`
				);
				setShowModal(false);
				setEditingPolicy(null);
				loadPolicies();
			} else {
				toast.error("Failed to save cancellation policy");
			}
		} catch (error) {
			toast.error("Error saving cancellation policy");
		} finally {
			setSaving(false);
		}
	};

	const handleDeletePolicy = async (id: string) => {
		if (!confirm("Are you sure you want to delete this cancellation policy?"))
			return;

		try {
			const response = await fetch(
				`${API_BASE}/admin/finance/cancellation-policies/${id}`,
				{
					method: "DELETE",
					headers: { ...getAuthHeaders() },
				}
			);

			if (response.ok) {
				toast.success("Cancellation policy deleted successfully");
				loadPolicies();
			} else {
				toast.error("Failed to delete cancellation policy");
			}
		} catch (error) {
			toast.error("Error deleting cancellation policy");
		}
	};

	const openCreatePolicy = () => {
		setEditingPolicy({
			id: "",
			name: "",
			description: "",
			policyType: "standard",
			vendorTypes: [],
			serviceTypes: [],
			gracePeriodHours: 24,
			cancellationWindows: [
				{
					hoursBefore: 24,
					refundPercentage: 100,
					cancellationFee: 0,
					penaltyPercentage: 0,
				},
			],
			vendorCancellationPenalty: {
				enabled: true,
				penaltyPercentage: 20,
				compensationPercentage: 10,
			},
			noShowPolicy: {
				enabled: true,
				refundPercentage: 0,
				penaltyAmount: 0,
			},
			isActive: true,
			priority: 100,
		});
		setShowModal(true);
	};

	const openEditPolicy = (policy: CancellationPolicy) => {
		setEditingPolicy(policy);
		setShowModal(true);
	};

	const addCancellationWindow = () => {
		if (!editingPolicy) return;
		setEditingPolicy({
			...editingPolicy,
			cancellationWindows: [
				...editingPolicy.cancellationWindows,
				{
					hoursBefore: 24,
					refundPercentage: 100,
					cancellationFee: 0,
					penaltyPercentage: 0,
				},
			],
		});
	};

	const removeCancellationWindow = (index: number) => {
		if (!editingPolicy) return;
		setEditingPolicy({
			...editingPolicy,
			cancellationWindows: editingPolicy.cancellationWindows.filter(
				(_, i) => i !== index
			),
		});
	};

	const updateCancellationWindow = (
		index: number,
		field: string,
		value: any
	) => {
		if (!editingPolicy) return;
		const updated = [...editingPolicy.cancellationWindows];
		updated[index] = { ...updated[index], [field]: value };
		setEditingPolicy({
			...editingPolicy,
			cancellationWindows: updated,
		});
	};

	const toggleVendorType = (vendorTypeId: string) => {
		if (!editingPolicy) return;
		const updated = editingPolicy.vendorTypes.includes(vendorTypeId)
			? editingPolicy.vendorTypes.filter((id) => id !== vendorTypeId)
			: [...editingPolicy.vendorTypes, vendorTypeId];
		setEditingPolicy({ ...editingPolicy, vendorTypes: updated });
	};

	const toggleServiceType = (serviceTypeId: string) => {
		if (!editingPolicy) return;
		const updated = editingPolicy.serviceTypes.includes(serviceTypeId)
			? editingPolicy.serviceTypes.filter((id) => id !== serviceTypeId)
			: [...editingPolicy.serviceTypes, serviceTypeId];
		setEditingPolicy({ ...editingPolicy, serviceTypes: updated });
	};

	const filteredPolicies = policies.filter((policy) => {
		const matchesSearch =
			policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			policy.description.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesFilter =
			filterType === "all" || policy.policyType === filterType;
		return matchesSearch && matchesFilter;
	});

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between pb-4 border-b border-gray-200">
				<div>
					<h3 className="text-lg font-medium text-gray-900">
						Cancellation Policy Management
					</h3>
					<p className="text-sm text-gray-500">
						Configure cancellation policies with grace periods and refund tiers
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button variant="outline" size="sm" onClick={loadPolicies}>
						<RefreshCw className="w-4 h-4 mr-2" />
						Refresh
					</Button>
					<Button
						onClick={openCreatePolicy}
						className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
					>
						<Plus className="w-4 h-4 mr-2" />
						Create Policy
					</Button>
				</div>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<Input
						placeholder="Search policies..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
					<SelectTrigger className="w-[200px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="standard">Standard</SelectItem>
						<SelectItem value="vendor_specific">Vendor Specific</SelectItem>
						<SelectItem value="service_specific">Service Specific</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Policies List */}
			{filteredPolicies.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-gray-900 mb-2">
							No Cancellation Policies
						</h3>
						<p className="text-gray-500 mb-4">
							Create your first cancellation policy to get started
						</p>
						<Button
							onClick={openCreatePolicy}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							<Plus className="w-4 h-4 mr-2" />
							Create Policy
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{filteredPolicies.map((policy) => (
						<Card key={policy.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-2">
											<CardTitle className="text-lg">{policy.name}</CardTitle>
											<Badge
												variant={policy.isActive ? "default" : "secondary"}
											>
												{policy.isActive ? "Active" : "Inactive"}
											</Badge>
											<Badge variant="outline" className="capitalize">
												{policy.policyType.replace("_", " ")}
											</Badge>
											<Badge variant="outline">
												Priority: {policy.priority}
											</Badge>
										</div>
										{policy.description && (
											<p className="text-sm text-gray-600 mt-1">
												{policy.description}
											</p>
										)}
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => openEditPolicy(policy)}
										>
											<Edit2 className="w-4 h-4" />
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleDeletePolicy(policy.id)}
											className="text-red-600 hover:text-red-700"
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
									<div>
										<Label className="text-xs text-gray-500 mb-2 block">
											Grace Period
										</Label>
										<div className="flex items-center gap-2">
											<Clock className="w-4 h-4 text-gray-400" />
											<span className="font-medium">
												{policy.gracePeriodHours} hours
											</span>
										</div>
									</div>
									<div>
										<Label className="text-xs text-gray-500 mb-2 block">
											Cancellation Windows
										</Label>
										<span className="font-medium">
											{policy.cancellationWindows.length} tiers
										</span>
									</div>
									<div>
										<Label className="text-xs text-gray-500 mb-2 block">
											Applicable To
										</Label>
										<div className="flex flex-wrap gap-1">
											{policy.vendorTypes.length > 0 && (
												<Badge variant="outline" className="text-xs">
													{policy.vendorTypes.length} vendor types
												</Badge>
											)}
											{policy.serviceTypes.length > 0 && (
												<Badge variant="outline" className="text-xs">
													{policy.serviceTypes.length} service types
												</Badge>
											)}
											{policy.vendorTypes.length === 0 &&
												policy.serviceTypes.length === 0 && (
													<Badge variant="outline" className="text-xs">
														All
													</Badge>
												)}
										</div>
									</div>
								</div>

								{/* Cancellation Windows Preview */}
								<div className="mt-4 pt-4 border-t">
									<Label className="text-xs text-gray-500 mb-2 block">
										Cancellation Windows
									</Label>
									<div className="space-y-2">
										{policy.cancellationWindows.map((window, idx) => (
											<div
												key={idx}
												className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded"
											>
												<span>
													<span className="font-medium">
														{window.hoursBefore}h
													</span>{" "}
													before service
												</span>
												<span className="text-gray-600">
													{window.refundPercentage}% refund
													{window.cancellationFee > 0 &&
														` - ₹${window.cancellationFee} fee`}
												</span>
											</div>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Create/Edit Modal */}
			<Dialog open={showModal} onOpenChange={setShowModal}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingPolicy?.id
								? "Edit Cancellation Policy"
								: "Create Cancellation Policy"}
						</DialogTitle>
						<DialogDescription>
							Configure cancellation policy with grace periods, refund tiers,
							and vendor penalties
						</DialogDescription>
					</DialogHeader>

					{editingPolicy && (
						<div className="space-y-6 py-4">
							{/* Basic Info */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Policy Name *</Label>
									<Input
										value={editingPolicy.name}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												name: e.target.value,
											})
										}
										placeholder="e.g., Standard 24-Hour Policy"
									/>
								</div>
								<div className="space-y-2">
									<Label>Policy Type *</Label>
									<Select
										value={editingPolicy.policyType}
										onValueChange={(v: any) =>
											setEditingPolicy({ ...editingPolicy, policyType: v })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="standard">Standard (All)</SelectItem>
											<SelectItem value="vendor_specific">
												Vendor Specific
											</SelectItem>
											<SelectItem value="service_specific">
												Service Specific
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Description</Label>
								<Input
									value={editingPolicy.description}
									onChange={(e) =>
										setEditingPolicy({
											...editingPolicy,
											description: e.target.value,
										})
									}
									placeholder="Policy description"
								/>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label>Grace Period (Hours) *</Label>
									<Input
										type="number"
										value={editingPolicy.gracePeriodHours}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												gracePeriodHours: parseInt(e.target.value) || 0,
											})
										}
										min="0"
									/>
								</div>
								<div className="space-y-2">
									<Label>Priority *</Label>
									<Input
										type="number"
										value={editingPolicy.priority}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												priority: parseInt(e.target.value) || 100,
											})
										}
										min="0"
									/>
									<p className="text-xs text-gray-500">
										Lower = higher priority
									</p>
								</div>
								<div className="space-y-2">
									<Label>Status</Label>
									<div className="flex items-center gap-2 pt-2">
										<Switch
											checked={editingPolicy.isActive}
											onCheckedChange={(c) =>
												setEditingPolicy({ ...editingPolicy, isActive: c })
											}
										/>
										<span className="text-sm">
											{editingPolicy.isActive ? "Active" : "Inactive"}
										</span>
									</div>
								</div>
							</div>

							{/* Vendor Types (if vendor_specific) */}
							{(editingPolicy.policyType === "vendor_specific" ||
								editingPolicy.policyType === "standard") && (
								<div className="space-y-2">
									<Label>Applicable Vendor Types</Label>
									<div className="grid grid-cols-3 gap-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
										{VENDOR_TYPES.map((vt) => (
											<div key={vt.id} className="flex items-center gap-2">
												<Checkbox
													checked={editingPolicy.vendorTypes.includes(vt.id)}
													onCheckedChange={() => toggleVendorType(vt.id)}
												/>
												<label className="text-sm cursor-pointer flex items-center gap-1">
													<span>{vt.icon}</span>
													<span>{vt.name}</span>
												</label>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Service Types (if service_specific) */}
							{(editingPolicy.policyType === "service_specific" ||
								editingPolicy.policyType === "standard") && (
								<div className="space-y-2">
									<Label>Applicable Service Types</Label>
									<div className="grid grid-cols-3 gap-2 border rounded-lg p-3">
										{SERVICE_TYPES.map((st) => (
											<div key={st.id} className="flex items-center gap-2">
												<Checkbox
													checked={editingPolicy.serviceTypes.includes(st.id)}
													onCheckedChange={() => toggleServiceType(st.id)}
												/>
												<label className="text-sm cursor-pointer flex items-center gap-1">
													<span>{st.icon}</span>
													<span>{st.name}</span>
												</label>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Cancellation Windows */}
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<Label>Cancellation Windows *</Label>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={addCancellationWindow}
									>
										<Plus className="w-4 h-4 mr-2" />
										Add Window
									</Button>
								</div>

								<div className="space-y-3">
									{editingPolicy.cancellationWindows.map((window, idx) => (
										<Card key={idx}>
											<CardContent className="p-4">
												<div className="flex items-start justify-between mb-3">
													<span className="font-medium text-sm">
														Window {idx + 1}
													</span>
													{editingPolicy.cancellationWindows.length > 1 && (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => removeCancellationWindow(idx)}
															className="text-red-600 hover:text-red-700"
														>
															<Trash2 className="w-4 h-4" />
														</Button>
													)}
												</div>
												<div className="grid grid-cols-4 gap-3">
													<div className="space-y-2">
														<Label className="text-xs">Hours Before *</Label>
														<Input
															type="number"
															value={window.hoursBefore}
															onChange={(e) =>
																updateCancellationWindow(
																	idx,
																	"hoursBefore",
																	parseInt(e.target.value) || 0
																)
															}
															min="0"
														/>
													</div>
													<div className="space-y-2">
														<Label className="text-xs">Refund % *</Label>
														<Input
															type="number"
															value={window.refundPercentage}
															onChange={(e) =>
																updateCancellationWindow(
																	idx,
																	"refundPercentage",
																	parseFloat(e.target.value) || 0
																)
															}
															min="0"
															max="100"
														/>
													</div>
													<div className="space-y-2">
														<Label className="text-xs">Fee (₹)</Label>
														<Input
															type="number"
															value={window.cancellationFee}
															onChange={(e) =>
																updateCancellationWindow(
																	idx,
																	"cancellationFee",
																	parseFloat(e.target.value) || 0
																)
															}
															min="0"
														/>
													</div>
													<div className="space-y-2">
														<Label className="text-xs">Penalty %</Label>
														<Input
															type="number"
															value={window.penaltyPercentage}
															onChange={(e) =>
																updateCancellationWindow(
																	idx,
																	"penaltyPercentage",
																	parseFloat(e.target.value) || 0
																)
															}
															min="0"
															max="100"
														/>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</div>

							{/* Vendor Cancellation Penalty */}
							<div className="space-y-4 border-t pt-4">
								<div className="flex items-center justify-between">
									<div>
										<Label>Vendor Cancellation Penalty</Label>
										<p className="text-xs text-gray-500">
											Penalties when vendor cancels
										</p>
									</div>
									<Switch
										checked={editingPolicy.vendorCancellationPenalty.enabled}
										onCheckedChange={(c) =>
											setEditingPolicy({
												...editingPolicy,
												vendorCancellationPenalty: {
													...editingPolicy.vendorCancellationPenalty,
													enabled: c,
												},
											})
										}
									/>
								</div>
								{editingPolicy.vendorCancellationPenalty.enabled && (
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Penalty %</Label>
											<Input
												type="number"
												value={
													editingPolicy.vendorCancellationPenalty
														.penaltyPercentage
												}
												onChange={(e) =>
													setEditingPolicy({
														...editingPolicy,
														vendorCancellationPenalty: {
															...editingPolicy.vendorCancellationPenalty,
															penaltyPercentage:
																parseFloat(e.target.value) || 0,
														},
													})
												}
												min="0"
												max="100"
											/>
										</div>
										<div className="space-y-2">
											<Label>Compensation %</Label>
											<Input
												type="number"
												value={
													editingPolicy.vendorCancellationPenalty
														.compensationPercentage
												}
												onChange={(e) =>
													setEditingPolicy({
														...editingPolicy,
														vendorCancellationPenalty: {
															...editingPolicy.vendorCancellationPenalty,
															compensationPercentage:
																parseFloat(e.target.value) || 0,
														},
													})
												}
												min="0"
												max="100"
											/>
										</div>
									</div>
								)}
							</div>

							{/* No-Show Policy */}
							<div className="space-y-4 border-t pt-4">
								<div className="flex items-center justify-between">
									<div>
										<Label>No-Show Policy</Label>
										<p className="text-xs text-gray-500">
											Policy when customer doesn&apos;t show up
										</p>
									</div>
									<Switch
										checked={editingPolicy.noShowPolicy.enabled}
										onCheckedChange={(c) =>
											setEditingPolicy({
												...editingPolicy,
												noShowPolicy: {
													...editingPolicy.noShowPolicy,
													enabled: c,
												},
											})
										}
									/>
								</div>
								{editingPolicy.noShowPolicy.enabled && (
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Refund %</Label>
											<Input
												type="number"
												value={editingPolicy.noShowPolicy.refundPercentage}
												onChange={(e) =>
													setEditingPolicy({
														...editingPolicy,
														noShowPolicy: {
															...editingPolicy.noShowPolicy,
															refundPercentage: parseFloat(e.target.value) || 0,
														},
													})
												}
												min="0"
												max="100"
											/>
										</div>
										<div className="space-y-2">
											<Label>Penalty Amount (₹)</Label>
											<Input
												type="number"
												value={editingPolicy.noShowPolicy.penaltyAmount}
												onChange={(e) =>
													setEditingPolicy({
														...editingPolicy,
														noShowPolicy: {
															...editingPolicy.noShowPolicy,
															penaltyAmount: parseFloat(e.target.value) || 0,
														},
													})
												}
												min="0"
											/>
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowModal(false);
								setEditingPolicy(null);
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSavePolicy}
							disabled={
								saving ||
								!editingPolicy?.name ||
								editingPolicy.cancellationWindows.length === 0
							}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							{saving
								? "Saving..."
								: editingPolicy?.id
									? "Update Policy"
									: "Create Policy"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
