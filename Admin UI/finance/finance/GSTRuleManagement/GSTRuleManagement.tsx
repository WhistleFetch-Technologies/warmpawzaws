/**
 * GST RULE MANAGEMENT
 *
 * Admin component for managing GST rules based on category and role
 * Located in Finance & Logistics > Settings tab
 */

import { useState, useEffect } from "react";

import {
	Switch,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
	Separator,
	Badge,
	Label,
	Input,
	Button,
} from "@repo/ui";

import {
	Plus,
	Edit2,
	Trash2,
	Percent,
	Tag,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";

interface GSTRule {
	id: string;
	name: string;
	enabled: boolean;
	priority: number;
	conditions: {
		categories?: string[];
		roles?: string[];
		serviceTypes?: string[];
		states?: string[];
		minAmount?: number;
		maxAmount?: number;
	};
	gst: {
		type: "percentage" | "fixed";
		rate: number;
		cgst?: number;
		sgst?: number;
		igst?: number;
	};
	description?: string;
	createdAt: string;
	updatedAt: string;
}

const AVAILABLE_CATEGORIES = [
	"veterinary",
	"grooming",
	"training",
	"boarding",
	"walking",
	"sitting",
	"pharmacy",
	"products",
	"food",
	"insurance",
	"photography",
	"adoption",
];

const AVAILABLE_ROLES = [
	"veterinarian",
	"veterinary_clinic",
	"pet_groomer",
	"pet_trainer",
	"pet_boarding",
	"pet_walker",
	"pet_sitter",
	"pet_pharmacy",
	"pet_products_store",
	"pet_cafe",
	"nutritionist",
	"insurance",
];

const SERVICE_TYPES = ["at_home", "at_center", "tele", "delivery", "pickup"];

export function GSTRuleManagement() {
	const [rules, setRules] = useState<GSTRule[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [currentRule, setCurrentRule] = useState<Partial<GSTRule> | null>(null);

	const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

	useEffect(() => {
		loadRules();
	}, []);

	const loadRules = async () => {
		setLoading(true);
		try {
			const response = await fetch(`${API_BASE}/admin/finance/gst-rules`, {
				headers: { Authorization: `Bearer ${publicAnonKey}` },
			});

			if (response.ok) {
				const data = await response.json();
				setRules(data.rules || []);
			}
		} catch (error) {
			console.error("Error loading GST rules:", error);
			toast.error("Failed to load GST rules");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveRule = async () => {
		if (!currentRule) return;

		setSaving(true);
		try {
			const method = currentRule.id ? "PUT" : "POST";
			const url = currentRule.id
				? `${API_BASE}/admin/finance/gst-rules/${currentRule.id}`
				: `${API_BASE}/admin/finance/gst-rules`;

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${publicAnonKey}`,
				},
				body: JSON.stringify(currentRule),
			});

			if (response.ok) {
				toast.success(
					`GST rule ${currentRule.id ? "updated" : "created"} successfully`
				);
				setIsModalOpen(false);
				setCurrentRule(null);
				loadRules();
			} else {
				toast.error("Failed to save GST rule");
			}
		} catch (error) {
			toast.error("Error saving GST rule");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteRule = async (ruleId: string) => {
		if (!confirm("Are you sure you want to delete this GST rule?")) return;

		try {
			const response = await fetch(
				`${API_BASE}/admin/finance/gst-rules/${ruleId}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (response.ok) {
				toast.success("GST rule deleted successfully");
				loadRules();
			} else {
				toast.error("Failed to delete GST rule");
			}
		} catch (error) {
			toast.error("Error deleting GST rule");
		}
	};

	const openCreateModal = () => {
		setCurrentRule({
			name: "",
			enabled: true,
			priority: 100,
			conditions: {},
			gst: {
				type: "percentage",
				rate: 18,
			},
		});
		setIsModalOpen(true);
	};

	const openEditModal = (rule: GSTRule) => {
		setCurrentRule(rule);
		setIsModalOpen(true);
	};

	if (loading) {
		return (
			<div className="flex justify-center py-12">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-semibold text-slate-900">GST Rules</h2>
					<p className="text-sm text-slate-500">
						Manage GST calculation rules by category, role, and service type
					</p>
				</div>
				<Button
					onClick={openCreateModal}
					className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
				>
					<Plus className="w-4 h-4 mr-2" />
					Create Rule
				</Button>
			</div>

			{/* Rules List */}
			<div className="space-y-4">
				{rules.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
							<h3 className="text-lg font-semibold text-gray-900 mb-2">
								No GST Rules
							</h3>
							<p className="text-gray-600 mb-4">
								Create your first GST rule to get started
							</p>
							<Button
								onClick={openCreateModal}
								className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
							>
								<Plus className="w-4 h-4 mr-2" />
								Create Rule
							</Button>
						</CardContent>
					</Card>
				) : (
					rules.map((rule) => (
						<Card key={rule.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-2">
											<CardTitle className="text-lg">{rule.name}</CardTitle>
											<Badge variant={rule.enabled ? "default" : "secondary"}>
												{rule.enabled ? "Active" : "Disabled"}
											</Badge>
											<Badge variant="outline">Priority: {rule.priority}</Badge>
										</div>
										{rule.description && (
											<CardDescription>{rule.description}</CardDescription>
										)}
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => openEditModal(rule)}
										>
											<Edit2 className="w-4 h-4" />
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleDeleteRule(rule.id)}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label className="text-xs text-slate-500 mb-2 block">
											Conditions
										</Label>
										<div className="space-y-1 text-sm">
											{rule.conditions.categories &&
												rule.conditions.categories.length > 0 && (
													<div>
														<span className="font-medium">Categories:</span>{" "}
														{rule.conditions.categories.join(", ")}
													</div>
												)}
											{rule.conditions.roles &&
												rule.conditions.roles.length > 0 && (
													<div>
														<span className="font-medium">Roles:</span>{" "}
														{rule.conditions.roles.join(", ")}
													</div>
												)}
											{rule.conditions.serviceTypes &&
												rule.conditions.serviceTypes.length > 0 && (
													<div>
														<span className="font-medium">Service Types:</span>{" "}
														{rule.conditions.serviceTypes.join(", ")}
													</div>
												)}
											{rule.conditions.minAmount && (
												<div>
													<span className="font-medium">Min Amount:</span> ₹
													{rule.conditions.minAmount}
												</div>
											)}
											{rule.conditions.maxAmount && (
												<div>
													<span className="font-medium">Max Amount:</span> ₹
													{rule.conditions.maxAmount}
												</div>
											)}
										</div>
									</div>
									<div>
										<Label className="text-xs text-slate-500 mb-2 block">
											GST Rate
										</Label>
										<div className="space-y-1 text-sm">
											<div>
												<span className="font-medium">Type:</span>{" "}
												{rule.gst.type}
											</div>
											<div>
												<span className="font-medium">Rate:</span>{" "}
												{rule.gst.type === "percentage"
													? `${rule.gst.rate}%`
													: `₹${rule.gst.rate}`}
											</div>
											{rule.gst.cgst && (
												<div>
													<span className="font-medium">CGST:</span>{" "}
													{rule.gst.cgst}%
												</div>
											)}
											{rule.gst.sgst && (
												<div>
													<span className="font-medium">SGST:</span>{" "}
													{rule.gst.sgst}%
												</div>
											)}
											{rule.gst.igst && (
												<div>
													<span className="font-medium">IGST:</span>{" "}
													{rule.gst.igst}%
												</div>
											)}
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))
				)}
			</div>

			{/* Create/Edit Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{currentRule?.id ? "Edit GST Rule" : "Create GST Rule"}
						</DialogTitle>
						<DialogDescription>
							Configure GST calculation rules based on category, role, and
							service type
						</DialogDescription>
					</DialogHeader>

					{currentRule && (
						<div className="space-y-6 py-4">
							<div className="space-y-2">
								<Label>Rule Name *</Label>
								<Input
									value={currentRule.name || ""}
									onChange={(e) =>
										setCurrentRule({ ...currentRule, name: e.target.value })
									}
									placeholder="e.g., Veterinary Services - 18% GST"
								/>
							</div>

							<div className="space-y-2">
								<Label>Description</Label>
								<Input
									value={currentRule.description || ""}
									onChange={(e) =>
										setCurrentRule({
											...currentRule,
											description: e.target.value,
										})
									}
									placeholder="Optional description"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Priority *</Label>
									<Input
										type="number"
										value={currentRule.priority || 100}
										onChange={(e) =>
											setCurrentRule({
												...currentRule,
												priority: parseInt(e.target.value) || 100,
											})
										}
									/>
									<p className="text-xs text-slate-500">
										Lower number = higher priority
									</p>
								</div>

								<div className="space-y-2">
									<Label>Status</Label>
									<div className="flex items-center gap-2 pt-2">
										<Switch
											checked={currentRule.enabled !== false}
											onCheckedChange={(c) =>
												setCurrentRule({ ...currentRule, enabled: c })
											}
										/>
										<span className="text-sm">
											{currentRule.enabled ? "Enabled" : "Disabled"}
										</span>
									</div>
								</div>
							</div>

							<Separator />

							<div>
								<Label className="mb-3 block">Conditions</Label>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label className="text-sm">Categories (Optional)</Label>
										<Select
											value={(currentRule.conditions?.categories || []).join(
												","
											)}
											onValueChange={(value) => {
												const categories = value ? value.split(",") : [];
												setCurrentRule({
													...currentRule,
													conditions: { ...currentRule.conditions, categories },
												});
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select categories" />
											</SelectTrigger>
											<SelectContent>
												{AVAILABLE_CATEGORIES.map((cat) => (
													<SelectItem key={cat} value={cat}>
														{cat}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label className="text-sm">Roles (Optional)</Label>
										<Select
											value={(currentRule.conditions?.roles || []).join(",")}
											onValueChange={(value) => {
												const roles = value ? value.split(",") : [];
												setCurrentRule({
													...currentRule,
													conditions: { ...currentRule.conditions, roles },
												});
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select roles" />
											</SelectTrigger>
											<SelectContent>
												{AVAILABLE_ROLES.map((role) => (
													<SelectItem key={role} value={role}>
														{role}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label className="text-sm">Min Amount (Optional)</Label>
											<Input
												type="number"
												value={currentRule.conditions?.minAmount || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														conditions: {
															...currentRule.conditions,
															minAmount: e.target.value
																? parseInt(e.target.value)
																: undefined,
														},
													})
												}
												placeholder="₹0"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-sm">Max Amount (Optional)</Label>
											<Input
												type="number"
												value={currentRule.conditions?.maxAmount || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														conditions: {
															...currentRule.conditions,
															maxAmount: e.target.value
																? parseInt(e.target.value)
																: undefined,
														},
													})
												}
												placeholder="₹0"
											/>
										</div>
									</div>
								</div>
							</div>

							<Separator />

							<div>
								<Label className="mb-3 block">GST Configuration</Label>
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label className="text-sm">GST Type *</Label>
											<Select
												value={currentRule.gst?.type || "percentage"}
												onValueChange={(value: "percentage" | "fixed") =>
													setCurrentRule({
														...currentRule,
														gst: {
															...currentRule.gst,
															type: value,
															rate: currentRule.gst?.rate || 18,
														},
													})
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="percentage">Percentage</SelectItem>
													<SelectItem value="fixed">Fixed Amount</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label className="text-sm">GST Rate *</Label>
											<div className="relative">
												<Input
													type="number"
													value={currentRule.gst?.rate || 18}
													onChange={(e) =>
														setCurrentRule({
															...currentRule,
															gst: {
																...currentRule.gst,
																rate: parseFloat(e.target.value) || 18,
															},
														})
													}
													className={
														currentRule.gst?.type === "percentage"
															? "pr-8"
															: "pl-8"
													}
												/>
												{currentRule.gst?.type === "percentage" ? (
													<div className="absolute right-3 top-2.5 text-slate-400 text-sm">
														%
													</div>
												) : (
													<div className="absolute left-3 top-2.5 text-slate-400 text-sm">
														₹
													</div>
												)}
											</div>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-4">
										<div className="space-y-2">
											<Label className="text-sm">CGST % (Optional)</Label>
											<Input
												type="number"
												value={currentRule.gst?.cgst || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														gst: {
															...currentRule.gst,
															cgst: e.target.value
																? parseFloat(e.target.value)
																: undefined,
														},
													})
												}
												placeholder="Auto"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-sm">SGST % (Optional)</Label>
											<Input
												type="number"
												value={currentRule.gst?.sgst || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														gst: {
															...currentRule.gst,
															sgst: e.target.value
																? parseFloat(e.target.value)
																: undefined,
														},
													})
												}
												placeholder="Auto"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-sm">IGST % (Optional)</Label>
											<Input
												type="number"
												value={currentRule.gst?.igst || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														gst: {
															...currentRule.gst,
															igst: e.target.value
																? parseFloat(e.target.value)
																: undefined,
														},
													})
												}
												placeholder="Auto"
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsModalOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveRule}
							disabled={saving || !currentRule?.name}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							{saving
								? "Saving..."
								: currentRule?.id
									? "Update Rule"
									: "Create Rule"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
