import { useState, useEffect } from "react";
// import { Badge } from "../../ui/badge";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
	Textarea,
	Switch,
	Label,
	Input,
	Button,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@repo/ui";
import { Plus, Edit2, Trash2, Layers, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";

interface Tier {
	id: string;
	name: string;
	displayName: string;
	description: string;
	commissionRate: number;
	payoutPeriodDays: number;
	monthlyCost: number;
	yearlyCost: number;
	sixMonthCost?: number;
	sixMonthDiscountPercentage?: number;
	twelveMonthCost?: number;
	twelveMonthDiscountPercentage?: number;
	allowSplitPayment?: boolean;
	splitPaymentInstallments?: number;
	splitPaymentIntervalDays?: number;
	features: string[];
	roles: string[];
	isDefault: boolean;
	isActive: boolean;
}

const AVAILABLE_ROLES = [
	{ id: "veterinarian", label: "Veterinarian" },
	{ id: "groomer", label: "Pet Groomer" },
	{ id: "trainer", label: "Pet Trainer" },
	{ id: "boarding", label: "Boarding Facility" },
	{ id: "walker", label: "Pet Walker" },
	{ id: "shop", label: "Pet Shop" },
];

export function TierManagement() {
	const [tiers, setTiers] = useState<Tier[]>([]);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [currentTier, setCurrentTier] = useState<Tier | null>(null);
	const [saving, setSaving] = useState(false);

	const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

	useEffect(() => {
		loadTiers();
	}, []);

	const loadTiers = async () => {
		setLoading(true);
		try {
			const response = await fetch(`${API_BASE}/payments/tiers`, {
				headers: { Authorization: `Bearer ${publicAnonKey}` },
			});

			if (response.ok) {
				const data = await response.json();
				setTiers(data.tiers || []);
			} else {
				toast.error("Failed to load payment tiers");
			}
		} catch (error) {
			console.error("Error loading tiers:", error);
			toast.error("Failed to load payment tiers");
		} finally {
			setLoading(false);
		}
	};

	const handleSeedDefaults = async () => {
		setLoading(true);
		try {
			const response = await fetch(
				`${API_BASE}/admin/payments/tiers/seed-defaults`,
				{
					method: "POST",
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (response.ok) {
				const data = await response.json();
				setTiers(data.tiers || []);
				toast.success("Default tiers seeded successfully");
			} else {
				toast.error("Failed to seed tiers");
			}
		} catch (error) {
			toast.error("Error seeding tiers");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveTier = async () => {
		if (!currentTier) return;

		setSaving(true);
		try {
			const method = currentTier.id ? "PUT" : "POST";
			const url = currentTier.id
				? `${API_BASE}/admin/payments/tiers/${currentTier.id}`
				: `${API_BASE}/admin/payments/tiers`;

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${publicAnonKey}`,
				},
				body: JSON.stringify(currentTier),
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(
					`Tier ${currentTier.id ? "updated" : "created"} successfully`
				);

				if (currentTier.id) {
					setTiers(tiers.map((t) => (t.id === currentTier.id ? data.tier : t)));
				} else {
					setTiers([...tiers, data.tier]);
				}
				setIsModalOpen(false);
			} else {
				toast.error("Failed to save tier");
			}
		} catch (error) {
			toast.error("Failed to save tier");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteTier = async (id: string) => {
		if (!confirm("Are you sure you want to delete this tier?")) return;

		try {
			const response = await fetch(`${API_BASE}/admin/payments/tiers/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${publicAnonKey}` },
			});

			if (response.ok) {
				setTiers(tiers.filter((t) => t.id !== id));
				toast.success("Tier deleted successfully");
			} else {
				toast.error("Failed to delete tier");
			}
		} catch (error) {
			toast.error("Failed to delete tier");
		}
	};

	const openModal = (tier?: Tier) => {
		if (tier) {
			setCurrentTier({ ...tier });
		} else {
			setCurrentTier({
				id: "",
				name: "",
				displayName: "",
				description: "",
				commissionRate: 15,
				payoutPeriodDays: 7,
				monthlyCost: 0,
				yearlyCost: 0,
				sixMonthCost: undefined,
				sixMonthDiscountPercentage: 0,
				twelveMonthCost: undefined,
				twelveMonthDiscountPercentage: 0,
				allowSplitPayment: false,
				splitPaymentInstallments: 3,
				splitPaymentIntervalDays: 30,
				features: [],
				roles: [],
				isDefault: false,
				isActive: true,
			});
		}
		setIsModalOpen(true);
	};

	const toggleRole = (roleId: string) => {
		if (!currentTier) return;
		const newRoles = currentTier.roles.includes(roleId)
			? currentTier.roles.filter((r) => r !== roleId)
			: [...currentTier.roles, roleId];
		setCurrentTier({ ...currentTier, roles: newRoles });
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-xl font-semibold text-slate-900">
						Tier Configuration
					</h2>
					<p className="text-sm text-slate-500">
						Manage vendor commission tiers and payout rules
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={handleSeedDefaults}
						disabled={loading}
					>
						<RefreshCw
							className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
						/>
						Seed Defaults
					</Button>
					<Button
						onClick={() => openModal()}
						className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
					>
						<Plus className="w-4 h-4 mr-2" />
						Create New Tier
					</Button>
				</div>
			</div>

			{loading && tiers.length === 0 ? (
				<div className="flex justify-center py-12">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
				</div>
			) : tiers.length === 0 ? (
				<div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
					<Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
					<h3 className="text-lg font-medium text-slate-900">
						No Tiers Configured
					</h3>
					<p className="text-slate-500 mb-4">
						Create a new tier or seed defaults to get started.
					</p>
					<Button onClick={handleSeedDefaults} variant="outline">
						Seed Default Tiers
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-full">
					{tiers.map((tier) => (
						<Card
							key={tier.id}
							className={`relative overflow-hidden border-2 transition-all w-full max-w-full ${tier.isDefault ? "border-blue-200 bg-blue-50/30" : "border-slate-200 hover:border-orange-200"}`}
						>
							{tier.isDefault && (
								<div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
									Default
								</div>
							)}
							<CardHeader className="pb-2">
								<div className="flex justify-between items-start">
									<div>
										<CardTitle className="text-lg font-bold text-slate-900">
											{tier.displayName}
										</CardTitle>
										<div className="text-sm font-medium text-slate-500 mt-1">
											{tier.name}
										</div>
									</div>
									<div
										className={`p-2 rounded-lg ${tier.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
									>
										<Layers className="w-5 h-5" />
									</div>
								</div>
								<CardDescription className="mt-2 line-clamp-2 h-10">
									{tier.description}
								</CardDescription>
							</CardHeader>

							<CardContent className="space-y-6">
								<div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-slate-100">
									<div>
										<div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
											Commission
										</div>
										<div className="text-2xl font-bold text-slate-900">
											{tier.commissionRate}%
										</div>
									</div>
									<div>
										<div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
											Payout
										</div>
										<div className="text-2xl font-bold text-slate-900">
											T+{tier.payoutPeriodDays}
										</div>
									</div>
								</div>

								<div className="space-y-3">
									<div className="flex items-center justify-between text-sm">
										<span className="text-slate-600">Monthly Cost</span>
										<span className="font-semibold">
											{tier.monthlyCost === 0 ? "Free" : `₹${tier.monthlyCost}`}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-slate-600">Applicable Roles</span>
										<span className="font-medium text-slate-900">
											{tier.roles.length === 0
												? "All Roles"
												: `${tier.roles.length} Roles`}
										</span>
									</div>
								</div>

								<div className="flex gap-2 pt-2">
									<Button
										variant="outline"
										className="flex-1"
										onClick={() => openModal(tier)}
									>
										<Edit2 className="w-4 h-4 mr-2" /> Edit
									</Button>
									{!tier.isDefault && (
										<Button
											variant="ghost"
											size="icon"
											className="text-red-500 hover:bg-red-50"
											onClick={() => handleDeleteTier(tier.id)}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Tier Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="w-full max-w-lg md:max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{currentTier?.id ? "Edit Tier" : "Create New Tier"}
						</DialogTitle>
						<DialogDescription>
							Configure commission rates, payouts costs and features.
						</DialogDescription>
					</DialogHeader>

					{currentTier && (
						<div className="grid grid-cols-2 gap-6 py-4">
							<div className="space-y-4 col-span-2 md:col-span-1">
								<div className="space-y-2">
									<Label>Display Name</Label>
									<Input
										value={currentTier.displayName}
										onChange={(e) =>
											setCurrentTier({
												...currentTier,
												displayName: e.target.value,
											})
										}
										placeholder="e.g. Professional Tier"
									/>
								</div>
								<div className="space-y-2">
									<Label>Internal Name</Label>
									<Input
										value={currentTier.name}
										onChange={(e) =>
											setCurrentTier({ ...currentTier, name: e.target.value })
										}
										placeholder="e.g. Tier 2"
									/>
								</div>
								<div className="space-y-2">
									<Label>Description</Label>
									<Textarea
										value={currentTier.description}
										onChange={(e) =>
											setCurrentTier({
												...currentTier,
												description: e.target.value,
											})
										}
										placeholder="Tier details..."
										className="resize-none h-20"
									/>
								</div>
								<div className="space-y-4 pt-2">
									<div className="flex items-center justify-between border p-3 rounded-lg">
										<Label className="cursor-pointer" htmlFor="active-mode">
											Active Status
										</Label>
										<Switch
											id="active-mode"
											checked={currentTier.isActive}
											onCheckedChange={(c) =>
												setCurrentTier({ ...currentTier, isActive: c })
											}
										/>
									</div>
									<div className="flex items-center justify-between border p-3 rounded-lg">
										<div className="space-y-0.5">
											<Label className="cursor-pointer" htmlFor="default-mode">
												Set as Default
											</Label>
											<p className="text-xs text-muted-foreground">
												Apply to new vendors
											</p>
										</div>
										<Switch
											id="default-mode"
											checked={currentTier.isDefault}
											onCheckedChange={(c) =>
												setCurrentTier({ ...currentTier, isDefault: c })
											}
										/>
									</div>
								</div>
							</div>

							<div className="space-y-4 col-span-2 md:col-span-1">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Commission (%)</Label>
										<div className="relative">
											<Input
												type="number"
												value={currentTier.commissionRate}
												onChange={(e) =>
													setCurrentTier({
														...currentTier,
														commissionRate: parseFloat(e.target.value),
													})
												}
												className="pr-8"
											/>
											<div className="absolute right-3 top-2.5 text-slate-400 text-sm">
												%
											</div>
										</div>
									</div>
									<div className="space-y-2">
										<Label>Payout (Days)</Label>
										<div className="relative">
											<Input
												type="number"
												value={currentTier.payoutPeriodDays}
												onChange={(e) =>
													setCurrentTier({
														...currentTier,
														payoutPeriodDays: parseInt(e.target.value),
													})
												}
												className="pr-8"
											/>
											<div className="absolute right-3 top-2.5 text-slate-400 text-sm">
												T+
											</div>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Monthly Cost (₹)</Label>
										<Input
											type="number"
											value={currentTier.monthlyCost}
											onChange={(e) =>
												setCurrentTier({
													...currentTier,
													monthlyCost: parseFloat(e.target.value),
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Yearly Cost (₹)</Label>
										<Input
											type="number"
											value={currentTier.yearlyCost}
											onChange={(e) =>
												setCurrentTier({
													...currentTier,
													yearlyCost: parseFloat(e.target.value),
												})
											}
										/>
									</div>
								</div>

								{/* ✅ NEW: 6 Month Pricing */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>6 Month Cost (₹)</Label>
										<Input
											type="number"
											value={currentTier.sixMonthCost || ""}
											onChange={(e) =>
												setCurrentTier({
													...currentTier,
													sixMonthCost: parseFloat(e.target.value) || undefined,
												})
											}
											placeholder="Auto: Monthly × 6"
										/>
									</div>
									<div className="space-y-2">
										<Label>6 Month Discount (%)</Label>
										<Input
											type="number"
											value={currentTier.sixMonthDiscountPercentage || 0}
											onChange={(e) =>
												setCurrentTier({
													...currentTier,
													sixMonthDiscountPercentage:
														parseFloat(e.target.value) || 0,
												})
											}
										/>
									</div>
								</div>

								{/* ✅ NEW: 12 Month Pricing */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>12 Month Cost (₹)</Label>
										<Input
											type="number"
											value={currentTier.twelveMonthCost || ""}
											onChange={(e) =>
												setCurrentTier({
													...currentTier,
													twelveMonthCost:
														parseFloat(e.target.value) || undefined,
												})
											}
											placeholder="Auto: Yearly cost"
										/>
									</div>
									<div className="space-y-2">
										<Label>12 Month Discount (%)</Label>
										<Input
											type="number"
											value={currentTier.twelveMonthDiscountPercentage || 0}
											onChange={(e) =>
												setCurrentTier({
													...currentTier,
													twelveMonthDiscountPercentage:
														parseFloat(e.target.value) || 0,
												})
											}
										/>
									</div>
								</div>

								{/* ✅ NEW: Split Payment Options */}
								<div className="space-y-4 border rounded-lg p-4 bg-slate-50">
									<div className="flex items-center justify-between">
										<div>
											<Label>Allow Split Payment</Label>
											<p className="text-xs text-slate-500">
												Enable monthly installments
											</p>
										</div>
										<Switch
											checked={currentTier.allowSplitPayment || false}
											onCheckedChange={(c) =>
												setCurrentTier({ ...currentTier, allowSplitPayment: c })
											}
										/>
									</div>

									{currentTier.allowSplitPayment && (
										<div className="grid grid-cols-2 gap-4 pt-2">
											<div className="space-y-2">
												<Label>Installments (2-4)</Label>
												<Input
													type="number"
													min="2"
													max="4"
													value={currentTier.splitPaymentInstallments || 3}
													onChange={(e) => {
														const val = parseInt(e.target.value);
														if (val >= 2 && val <= 4) {
															setCurrentTier({
																...currentTier,
																splitPaymentInstallments: val,
															});
														}
													}}
												/>
											</div>
											<div className="space-y-2">
												<Label>Interval (Days)</Label>
												<Input
													type="number"
													value={currentTier.splitPaymentIntervalDays || 30}
													onChange={(e) =>
														setCurrentTier({
															...currentTier,
															splitPaymentIntervalDays:
																parseInt(e.target.value) || 30,
														})
													}
												/>
											</div>
										</div>
									)}
								</div>

								<div className="space-y-2">
									<Label>Applicable Roles</Label>
									<div className="border rounded-lg p-3 h-48 overflow-y-auto space-y-2 bg-slate-50">
										{AVAILABLE_ROLES.map((role) => (
											<div
												key={role.id}
												className="flex items-center space-x-2"
											>
												<Switch
													id={`role-${role.id}`}
													checked={
														currentTier.roles.includes(role.id) ||
														currentTier.roles.length === 0
													}
													onCheckedChange={() => toggleRole(role.id)}
													disabled={currentTier.roles.length === 0 && false} // TODO: Fix logic for "All"
												/>
												<Label
													htmlFor={`role-${role.id}`}
													className="text-sm font-normal"
												>
													{role.label}
												</Label>
											</div>
										))}
										<p className="text-xs text-muted-foreground pt-2 italic">
											* If no roles selected, applies to all
										</p>
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
							onClick={handleSaveTier}
							disabled={saving}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							{saving ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
