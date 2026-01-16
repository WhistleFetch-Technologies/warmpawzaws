import { useState, useEffect } from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Badge,
	Textarea,
	Switch,
	Label,
	Input,
	Button,
	Card,
} from "@repo/ui";

import {
	ArrowLeft,
	Plus,
	Zap,
	Gift,
	TrendingUp,
	Target,
	Percent,
	Tag,
	Calendar,
	Users,
	Package,
	Edit,
	Trash2,
	Copy,
	BarChart,
	Clock,
} from "lucide-react";

import { toast, Toaster } from "sonner";

import { projectId, publicAnonKey } from "@repo/utils/supabase/info";

interface AdvancedPromotionsEngineProps {
	onBack: () => void;
}

interface Promotion {
	id: string;
	name: string;
	description: string;
	type:
		| "flash_sale"
		| "buy_x_get_y"
		| "bundle"
		| "category_discount"
		| "first_order"
		| "loyalty_tier"
		| "seasonal";
	discountType: "percentage" | "flat";
	discountValue: number;
	maxDiscount?: number;
	conditions: PromotionCondition[];
	rewards: PromotionReward[];
	validFrom: string;
	validUntil: string;
	priority: number;
	stackable: boolean;
	active: boolean;
	usageCount: number;
	usageLimit: number;
	targetAudience: "all" | "new_users" | "returning_users" | "vip";
	applicableTo: string[];
	regions: string[];
	minOrderValue?: number;
	createdAt: string;
	analytics?: {
		views: number;
		conversions: number;
		revenue: number;
	};
}

interface PromotionCondition {
	type: "min_purchase" | "category" | "product" | "quantity" | "user_segment";
	value: any;
}

interface PromotionReward {
	type: "discount" | "free_product" | "free_shipping" | "loyalty_points";
	value: any;
}

export function AdvancedPromotionsEngine({
	onBack,
}: AdvancedPromotionsEngineProps) {
	const [loading, setLoading] = useState(false);
	const [promotions, setPromotions] = useState<Promotion[]>([]);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(
		null
	);

	// Form state
	const [formData, setFormData] = useState<Partial<Promotion>>({
		name: "",
		description: "",
		type: "flash_sale",
		discountType: "percentage",
		discountValue: 10,
		validFrom: new Date().toISOString().split("T")[0],
		validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0],
		priority: 1,
		stackable: false,
		active: true,
		usageLimit: 1000,
		targetAudience: "all",
		applicableTo: ["all"],
		regions: ["india"],
		conditions: [],
		rewards: [],
	});

	// Stats
	const [stats, setStats] = useState({
		activePromotions: 0,
		totalConversions: 0,
		totalRevenue: 0,
		avgDiscountGiven: 0,
	});

	useEffect(() => {
		loadPromotions();
		loadStats();
	}, []);

	const loadPromotions = async () => {
		setLoading(true);
		try {
			// GET /make-server-3dd53475/admin/promotions
			// Mock data
			const mockPromotions: Promotion[] = [
				{
					id: "promo_1",
					name: "Flash Friday Sale",
					description: "50% off on all grooming services for 4 hours",
					type: "flash_sale",
					discountType: "percentage",
					discountValue: 50,
					maxDiscount: 500,
					conditions: [
						{ type: "min_purchase", value: 1000 },
						{ type: "category", value: ["grooming"] },
					],
					rewards: [{ type: "discount", value: 50 }],
					validFrom: "2024-12-06",
					validUntil: "2024-12-06",
					priority: 10,
					stackable: false,
					active: true,
					usageCount: 234,
					usageLimit: 1000,
					targetAudience: "all",
					applicableTo: ["grooming"],
					regions: ["india"],
					minOrderValue: 1000,
					createdAt: "2024-12-01T00:00:00Z",
					analytics: {
						views: 5678,
						conversions: 234,
						revenue: 456000,
					},
				},
				{
					id: "promo_2",
					name: "Buy 2 Get 1 Free - Pet Food",
					description: "Buy any 2 pet food items and get the cheapest one free",
					type: "buy_x_get_y",
					discountType: "percentage",
					discountValue: 100,
					conditions: [
						{ type: "category", value: ["food"] },
						{ type: "quantity", value: 2 },
					],
					rewards: [{ type: "free_product", value: 1 }],
					validFrom: "2024-12-01",
					validUntil: "2024-12-31",
					priority: 5,
					stackable: true,
					active: true,
					usageCount: 567,
					usageLimit: 5000,
					targetAudience: "all",
					applicableTo: ["food"],
					regions: ["india"],
					createdAt: "2024-12-01T00:00:00Z",
					analytics: {
						views: 8900,
						conversions: 567,
						revenue: 892000,
					},
				},
				{
					id: "promo_3",
					name: "First Order Welcome Bonus",
					description: "₹200 off on first order above ₹1000",
					type: "first_order",
					discountType: "flat",
					discountValue: 200,
					conditions: [
						{ type: "min_purchase", value: 1000 },
						{ type: "user_segment", value: "new_users" },
					],
					rewards: [
						{ type: "discount", value: 200 },
						{ type: "loyalty_points", value: 100 },
					],
					validFrom: "2024-12-01",
					validUntil: "2024-12-31",
					priority: 8,
					stackable: false,
					active: true,
					usageCount: 1234,
					usageLimit: -1,
					targetAudience: "new_users",
					applicableTo: ["all"],
					regions: ["india"],
					minOrderValue: 1000,
					createdAt: "2024-12-01T00:00:00Z",
					analytics: {
						views: 12450,
						conversions: 1234,
						revenue: 2468000,
					},
				},
			];

			setPromotions(mockPromotions);
		} catch (error) {
			console.error("Error loading promotions:", error);
			toast.error("Failed to load promotions");
		} finally {
			setLoading(false);
		}
	};

	const loadStats = async () => {
		try {
			// GET /make-server-3dd53475/admin/promotions/stats
			setStats({
				activePromotions: 12,
				totalConversions: 3456,
				totalRevenue: 5678000,
				avgDiscountGiven: 234,
			});
		} catch (error) {
			console.error("Error loading stats:", error);
		}
	};

	const savePromotion = async () => {
		if (!formData.name || !formData.description) {
			toast.error("Please fill in all required fields");
			return;
		}

		setLoading(true);
		try {
			const method = editingPromotion ? "PUT" : "POST";
			const url = editingPromotion
				? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions/${editingPromotion.id}`
				: `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions`;

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${publicAnonKey}`,
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				toast.success(
					editingPromotion ? "Promotion updated" : "Promotion created"
				);
				setShowCreateModal(false);
				setEditingPromotion(null);
				resetForm();
				loadPromotions();
			}
		} catch (error) {
			console.error("Error saving promotion:", error);
			toast.error("Failed to save promotion");
		} finally {
			setLoading(false);
		}
	};

	const deletePromotion = async (promotionId: string) => {
		if (!confirm("Are you sure you want to delete this promotion?")) return;

		try {
			// ✅ FIXED: Actually call the backend endpoint
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/marketing/admin/promotions/${promotionId}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to delete promotion");
			}

			toast.success("Promotion deleted successfully");
			loadPromotions(); // Reload the list
		} catch (error) {
			console.error("Error deleting promotion:", error);
			toast.error("Failed to delete promotion");
		}
	};

	const togglePromotionStatus = async (
		promotionId: string,
		active: boolean
	) => {
		try {
			// PATCH /make-server-3dd53475/admin/promotions/{id}/status
			setPromotions(
				promotions.map((p) => (p.id === promotionId ? { ...p, active } : p))
			);
			toast.success(`Promotion ${active ? "activated" : "deactivated"}`);
		} catch (error) {
			console.error("Error toggling promotion:", error);
			toast.error("Failed to update promotion status");
		}
	};

	const duplicatePromotion = (promotion: Promotion) => {
		setFormData({
			...promotion,
			name: `${promotion.name} (Copy)`,
			id: undefined,
		});
		setEditingPromotion(null);
		setShowCreateModal(true);
	};

	const resetForm = () => {
		setFormData({
			name: "",
			description: "",
			type: "flash_sale",
			discountType: "percentage",
			discountValue: 10,
			validFrom: new Date().toISOString().split("T")[0],
			validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0],
			priority: 1,
			stackable: false,
			active: true,
			usageLimit: 1000,
			targetAudience: "all",
			applicableTo: ["all"],
			regions: ["india"],
			conditions: [],
			rewards: [],
		});
	};

	const getPromotionTypeIcon = (type: string) => {
		const icons = {
			flash_sale: <Zap className="w-5 h-5" />,
			buy_x_get_y: <Gift className="w-5 h-5" />,
			bundle: <Package className="w-5 h-5" />,
			category_discount: <Tag className="w-5 h-5" />,
			first_order: <Users className="w-5 h-5" />,
			loyalty_tier: <Target className="w-5 h-5" />,
			seasonal: <Calendar className="w-5 h-5" />,
		};
		return icons[type as keyof typeof icons] || <Percent className="w-5 h-5" />;
	};

	const getPromotionTypeLabel = (type: string) => {
		return type
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<Toaster position="top-right" richColors />

			{/* Header */}
			<div className="bg-white border-b sticky top-0 z-10">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16">
						<div className="flex items-center gap-4">
							<Button variant="ghost" size="sm" onClick={onBack}>
								<ArrowLeft className="w-4 h-4" />
							</Button>
							<div>
								<h1 className="text-xl font-semibold">Promotions Engine</h1>
								<p className="text-sm text-gray-500">
									Create and manage advanced promotional campaigns
								</p>
							</div>
						</div>
						<Button
							onClick={() => {
								resetForm();
								setEditingPromotion(null);
								setShowCreateModal(true);
							}}
							className="bg-[#FF8C42] hover:bg-[#ff7a28]"
						>
							<Plus className="w-4 h-4 mr-2" />
							Create Promotion
						</Button>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Stats Dashboard */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
					<Card className="p-6">
						<div className="flex items-center gap-3">
							<div className="bg-[#FF8C42] text-white p-3 rounded-lg">
								<Zap className="w-5 h-5" />
							</div>
							<div>
								<p className="text-2xl font-bold">{stats.activePromotions}</p>
								<p className="text-sm text-gray-500">Active Promotions</p>
							</div>
						</div>
					</Card>

					<Card className="p-6">
						<div className="flex items-center gap-3">
							<div className="bg-green-500 text-white p-3 rounded-lg">
								<TrendingUp className="w-5 h-5" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									{stats.totalConversions.toLocaleString()}
								</p>
								<p className="text-sm text-gray-500">Total Conversions</p>
							</div>
						</div>
					</Card>

					<Card className="p-6">
						<div className="flex items-center gap-3">
							<div className="bg-purple-500 text-white p-3 rounded-lg">
								<BarChart className="w-5 h-5" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									₹{(stats.totalRevenue / 1000000).toFixed(1)}M
								</p>
								<p className="text-sm text-gray-500">Revenue Generated</p>
							</div>
						</div>
					</Card>

					<Card className="p-6">
						<div className="flex items-center gap-3">
							<div className="bg-blue-500 text-white p-3 rounded-lg">
								<Percent className="w-5 h-5" />
							</div>
							<div>
								<p className="text-2xl font-bold">₹{stats.avgDiscountGiven}</p>
								<p className="text-sm text-gray-500">Avg Discount</p>
							</div>
						</div>
					</Card>
				</div>

				{/* Promotions Grid */}
				<Tabs defaultValue="all">
					<TabsList className="mb-6">
						<TabsTrigger value="all">All Promotions</TabsTrigger>
						<TabsTrigger value="flash_sale">Flash Sales</TabsTrigger>
						<TabsTrigger value="buy_x_get_y">Buy X Get Y</TabsTrigger>
						<TabsTrigger value="first_order">First Order</TabsTrigger>
						<TabsTrigger value="loyalty_tier">Loyalty</TabsTrigger>
					</TabsList>

					<TabsContent value="all" className="space-y-4">
						{promotions.map((promotion) => (
							<Card
								key={promotion.id}
								className="p-6 hover:shadow-lg transition-shadow"
							>
								<div className="flex items-start gap-6">
									{/* Icon */}
									<div className="bg-[#FF8C42] bg-opacity-10 text-[#FF8C42] p-4 rounded-lg">
										{getPromotionTypeIcon(promotion.type)}
									</div>

									{/* Details */}
									<div className="flex-1">
										<div className="flex items-start justify-between mb-3">
											<div>
												<h3 className="font-semibold text-lg mb-1">
													{promotion.name}
												</h3>
												<p className="text-sm text-gray-600">
													{promotion.description}
												</p>
											</div>
											<Switch
												checked={promotion.active}
												onCheckedChange={(checked) =>
													togglePromotionStatus(promotion.id, checked)
												}
											/>
										</div>

										<div className="flex flex-wrap gap-2 mb-4">
											<Badge className="bg-purple-100 text-purple-700">
												{getPromotionTypeLabel(promotion.type)}
											</Badge>
											<Badge className="bg-blue-100 text-blue-700">
												{promotion.discountType === "percentage"
													? `${promotion.discountValue}% off`
													: `₹${promotion.discountValue} off`}
											</Badge>
											{promotion.stackable && (
												<Badge className="bg-green-100 text-green-700">
													Stackable
												</Badge>
											)}
											<Badge variant="outline">
												Priority: {promotion.priority}
											</Badge>
										</div>

										{/* Analytics */}
										{promotion.analytics && (
											<div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
												<div>
													<p className="text-sm text-gray-500">Views</p>
													<p className="font-bold">
														{promotion.analytics.views.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-sm text-gray-500">Conversions</p>
													<p className="font-bold text-green-600">
														{promotion.analytics.conversions.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-sm text-gray-500">Revenue</p>
													<p className="font-bold text-[#FF8C42]">
														₹{(promotion.analytics.revenue / 1000).toFixed(0)}K
													</p>
												</div>
											</div>
										)}

										{/* Date Range & Usage */}
										<div className="flex items-center justify-between mb-4">
											<div className="flex items-center gap-4 text-sm text-gray-600">
												<div className="flex items-center gap-1">
													<Calendar className="w-4 h-4" />
													{new Date(
														promotion.validFrom
													).toLocaleDateString()} -{" "}
													{new Date(promotion.validUntil).toLocaleDateString()}
												</div>
												<div className="flex items-center gap-1">
													<Users className="w-4 h-4" />
													{promotion.usageCount} /{" "}
													{promotion.usageLimit === -1
														? "∞"
														: promotion.usageLimit}{" "}
													used
												</div>
											</div>
										</div>

										{/* Actions */}
										<div className="flex gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={() => {
													setEditingPromotion(promotion);
													setFormData(promotion);
													setShowCreateModal(true);
												}}
											>
												<Edit className="w-4 h-4 mr-1" />
												Edit
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() => duplicatePromotion(promotion)}
											>
												<Copy className="w-4 h-4 mr-1" />
												Duplicate
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="text-red-600"
												onClick={() => deletePromotion(promotion.id)}
											>
												<Trash2 className="w-4 h-4 mr-1" />
												Delete
											</Button>
										</div>
									</div>
								</div>
							</Card>
						))}
					</TabsContent>
				</Tabs>
			</div>

			{/* Create/Edit Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-xl font-semibold">
									{editingPromotion ? "Edit Promotion" : "Create New Promotion"}
								</h2>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowCreateModal(false)}
								>
									✕
								</Button>
							</div>

							<div className="space-y-4">
								<div>
									<Label>Promotion Name *</Label>
									<Input
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										placeholder="e.g., Flash Friday Sale"
										className="mt-2"
									/>
								</div>

								<div>
									<Label>Description *</Label>
									<Textarea
										value={formData.description}
										onChange={(e) =>
											setFormData({ ...formData, description: e.target.value })
										}
										placeholder="Describe the promotion..."
										className="mt-2"
										rows={3}
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Promotion Type</Label>
										<Select
											value={formData.type}
											onValueChange={(value: any) =>
												setFormData({ ...formData, type: value })
											}
										>
											<SelectTrigger className="mt-2">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="flash_sale">Flash Sale</SelectItem>
												<SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
												<SelectItem value="bundle">Bundle Discount</SelectItem>
												<SelectItem value="category_discount">
													Category Discount
												</SelectItem>
												<SelectItem value="first_order">
													First Order Bonus
												</SelectItem>
												<SelectItem value="loyalty_tier">
													Loyalty Tier
												</SelectItem>
												<SelectItem value="seasonal">
													Seasonal Campaign
												</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div>
										<Label>Discount Type</Label>
										<Select
											value={formData.discountType}
											onValueChange={(value: any) =>
												setFormData({ ...formData, discountType: value })
											}
										>
											<SelectTrigger className="mt-2">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="percentage">
													Percentage (%)
												</SelectItem>
												<SelectItem value="flat">Flat Amount (₹)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Discount Value</Label>
										<Input
											type="number"
											value={formData.discountValue}
											onChange={(e) =>
												setFormData({
													...formData,
													discountValue: parseFloat(e.target.value),
												})
											}
											className="mt-2"
										/>
									</div>

									{formData.discountType === "percentage" && (
										<div>
											<Label>Max Discount (₹)</Label>
											<Input
												type="number"
												value={formData.maxDiscount || ""}
												onChange={(e) =>
													setFormData({
														...formData,
														maxDiscount:
															parseFloat(e.target.value) || undefined,
													})
												}
												placeholder="No limit"
												className="mt-2"
											/>
										</div>
									)}
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Valid From</Label>
										<Input
											type="date"
											value={formData.validFrom}
											onChange={(e) =>
												setFormData({ ...formData, validFrom: e.target.value })
											}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>Valid Until</Label>
										<Input
											type="date"
											value={formData.validUntil}
											onChange={(e) =>
												setFormData({ ...formData, validUntil: e.target.value })
											}
											className="mt-2"
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Usage Limit</Label>
										<Input
											type="number"
											value={formData.usageLimit}
											onChange={(e) =>
												setFormData({
													...formData,
													usageLimit: parseInt(e.target.value),
												})
											}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>Priority</Label>
										<Input
											type="number"
											value={formData.priority}
											onChange={(e) =>
												setFormData({
													...formData,
													priority: parseInt(e.target.value),
												})
											}
											className="mt-2"
										/>
										<p className="text-xs text-gray-500 mt-1">
											Higher number = higher priority
										</p>
									</div>
								</div>

								<div>
									<Label>Target Audience</Label>
									<Select
										value={formData.targetAudience}
										onValueChange={(value: any) =>
											setFormData({ ...formData, targetAudience: value })
										}
									>
										<SelectTrigger className="mt-2">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Users</SelectItem>
											<SelectItem value="new_users">New Users Only</SelectItem>
											<SelectItem value="returning_users">
												Returning Users
											</SelectItem>
											<SelectItem value="vip">VIP Members</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
									<div className="flex-1">
										<Label>Stackable with Other Promotions</Label>
										<p className="text-xs text-gray-500">
											Allow combining with other offers
										</p>
									</div>
									<Switch
										checked={formData.stackable}
										onCheckedChange={(checked) =>
											setFormData({ ...formData, stackable: checked })
										}
									/>
								</div>

								<div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
									<div className="flex-1">
										<Label>Active</Label>
										<p className="text-xs text-gray-500">
											Make promotion live immediately
										</p>
									</div>
									<Switch
										checked={formData.active}
										onCheckedChange={(checked) =>
											setFormData({ ...formData, active: checked })
										}
									/>
								</div>

								<div className="flex gap-3 pt-4">
									<Button
										variant="outline"
										className="flex-1"
										onClick={() => setShowCreateModal(false)}
									>
										Cancel
									</Button>
									<Button
										className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28]"
										onClick={savePromotion}
										disabled={loading}
									>
										{editingPromotion ? "Update" : "Create"} Promotion
									</Button>
								</div>
							</div>
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
