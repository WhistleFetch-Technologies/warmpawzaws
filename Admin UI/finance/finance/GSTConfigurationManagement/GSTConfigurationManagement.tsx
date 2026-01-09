/**
 * GST CONFIGURATION MANAGEMENT
 * Enterprise-grade GST management with HSN codes, tax categories, and regional settings
 */

import { useState, useEffect } from "react";

// import {
// 	Select,
// 	SelectContent,
// 	SelectItem,
// 	SelectTrigger,
// 	SelectValue,
// } from "../../ui/select";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Badge,
	Switch,
	Label,
	Input,
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@repo/ui";

import {
	Plus,
	Edit2,
	Trash2,
	ReceiptText,
	Search,
	RefreshCw,
	Check,
	X,
	AlertCircle,
} from "lucide-react";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
import { toast } from "sonner";

interface HSNCode {
	id: string;
	code: string;
	description: string;
	category: string;
	gstRate: number;
	cgst?: number;
	sgst?: number;
	igst?: number;
	isActive: boolean;
	createdAt?: string;
	updatedAt?: string;
}

interface TaxCategory {
	id: string;
	name: string;
	description: string;
	defaultGSTRate: number;
	applicableServices: string[];
	isActive: boolean;
	createdAt?: string;
	updatedAt?: string;
}

interface GSTConfig {
	id: string;
	region: string;
	gstInclusion: "inclusive" | "exclusive" | "none";
	defaultGSTRate: number;
	taxCategories: TaxCategory[];
	hsnCodes: HSNCode[];
	isActive: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export function GSTConfigurationManagement() {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [configs, setConfigs] = useState<GSTConfig[]>([]);
	const [hsnCodes, setHsnCodes] = useState<HSNCode[]>([]);
	const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
	const [activeTab, setActiveTab] = useState<
		"overview" | "hsn" | "categories" | "settings"
	>("overview");
	const [showHSNModal, setShowHSNModal] = useState(false);
	const [showCategoryModal, setShowCategoryModal] = useState(false);
	const [showSettingsModal, setShowSettingsModal] = useState(false);
	const [editingHSN, setEditingHSN] = useState<HSNCode | null>(null);
	const [editingCategory, setEditingCategory] = useState<TaxCategory | null>(
		null
	);
	const [editingConfig, setEditingConfig] = useState<GSTConfig | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			// Load GST configurations
			const configRes = await fetch(`${API_BASE}/admin/finance/gst-config`, {
				headers: { Authorization: `Bearer ${publicAnonKey}` },
			});
			if (configRes.ok) {
				const configData = await configRes.json();
				setConfigs(configData.configs || []);
			}

			// Load HSN codes
			const hsnRes = await fetch(`${API_BASE}/admin/finance/gst/hsn-codes`, {
				headers: { Authorization: `Bearer ${publicAnonKey}` },
			});
			if (hsnRes.ok) {
				const hsnData = await hsnRes.json();
				setHsnCodes(hsnData.hsnCodes || []);
			}

			// Load tax categories
			const categoryRes = await fetch(
				`${API_BASE}/admin/finance/gst/tax-categories`,
				{
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);
			if (categoryRes.ok) {
				const categoryData = await categoryRes.json();
				setTaxCategories(categoryData.categories || []);
			}
		} catch (error) {
			console.error("Error loading GST data:", error);
			toast.error("Failed to load GST configuration");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveHSN = async () => {
		if (!editingHSN || !editingHSN.code || !editingHSN.description) {
			toast.error("Please fill all required fields");
			return;
		}

		setSaving(true);
		try {
			const method = editingHSN.id ? "PUT" : "POST";
			const url = editingHSN.id
				? `${API_BASE}/admin/finance/gst/hsn-codes/${editingHSN.id}`
				: `${API_BASE}/admin/finance/gst/hsn-codes`;

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${publicAnonKey}`,
				},
				body: JSON.stringify(editingHSN),
			});

			if (response.ok) {
				toast.success(
					`HSN code ${editingHSN.id ? "updated" : "created"} successfully`
				);
				setShowHSNModal(false);
				setEditingHSN(null);
				loadData();
			} else {
				toast.error("Failed to save HSN code");
			}
		} catch (error) {
			toast.error("Error saving HSN code");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteHSN = async (id: string) => {
		if (!confirm("Are you sure you want to delete this HSN code?")) return;

		try {
			const response = await fetch(
				`${API_BASE}/admin/finance/gst/hsn-codes/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (response.ok) {
				toast.success("HSN code deleted successfully");
				loadData();
			} else {
				toast.error("Failed to delete HSN code");
			}
		} catch (error) {
			toast.error("Error deleting HSN code");
		}
	};

	const handleSaveCategory = async () => {
		if (!editingCategory || !editingCategory.name) {
			toast.error("Please fill all required fields");
			return;
		}

		setSaving(true);
		try {
			const method = editingCategory.id ? "PUT" : "POST";
			const url = editingCategory.id
				? `${API_BASE}/admin/finance/gst/tax-categories/${editingCategory.id}`
				: `${API_BASE}/admin/finance/gst/tax-categories`;

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${publicAnonKey}`,
				},
				body: JSON.stringify(editingCategory),
			});

			if (response.ok) {
				toast.success(
					`Tax category ${editingCategory.id ? "updated" : "created"} successfully`
				);
				setShowCategoryModal(false);
				setEditingCategory(null);
				loadData();
			} else {
				toast.error("Failed to save tax category");
			}
		} catch (error) {
			toast.error("Error saving tax category");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteCategory = async (id: string) => {
		if (!confirm("Are you sure you want to delete this tax category?")) return;

		try {
			const response = await fetch(
				`${API_BASE}/admin/finance/gst/tax-categories/${id}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${publicAnonKey}` },
				}
			);

			if (response.ok) {
				toast.success("Tax category deleted successfully");
				loadData();
			} else {
				toast.error("Failed to delete tax category");
			}
		} catch (error) {
			toast.error("Error deleting tax category");
		}
	};

	const openCreateHSN = () => {
		setEditingHSN({
			id: "",
			code: "",
			description: "",
			category: "",
			gstRate: 18,
			isActive: true,
		});
		setShowHSNModal(true);
	};

	const openEditHSN = (hsn: HSNCode) => {
		setEditingHSN(hsn);
		setShowHSNModal(true);
	};

	const openCreateCategory = () => {
		setEditingCategory({
			id: "",
			name: "",
			description: "",
			defaultGSTRate: 18,
			applicableServices: [],
			isActive: true,
		});
		setShowCategoryModal(true);
	};

	const openEditCategory = (category: TaxCategory) => {
		setEditingCategory(category);
		setShowCategoryModal(true);
	};

	const filteredHSN = hsnCodes.filter(
		(hsn) =>
			hsn.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
			hsn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
			hsn.category.toLowerCase().includes(searchQuery.toLowerCase())
	);

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
						GST Configuration
					</h3>
					<p className="text-sm text-gray-500">
						Manage HSN codes, tax categories, and GST settings
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button variant="outline" size="sm" onClick={loadData}>
						<RefreshCw className="w-4 h-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-2 border-b">
				<button
					onClick={() => setActiveTab("overview")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "overview"
							? "border-[#FF8C42] text-[#FF8C42]"
							: "border-transparent text-gray-600 hover:text-gray-900"
					}`}
				>
					Overview
				</button>
				<button
					onClick={() => setActiveTab("hsn")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "hsn"
							? "border-[#FF8C42] text-[#FF8C42]"
							: "border-transparent text-gray-600 hover:text-gray-900"
					}`}
				>
					HSN Codes ({hsnCodes.length})
				</button>
				<button
					onClick={() => setActiveTab("categories")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "categories"
							? "border-[#FF8C42] text-[#FF8C42]"
							: "border-transparent text-gray-600 hover:text-gray-900"
					}`}
				>
					Tax Categories ({taxCategories.length})
				</button>
				<button
					onClick={() => setActiveTab("settings")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						activeTab === "settings"
							? "border-[#FF8C42] text-[#FF8C42]"
							: "border-transparent text-gray-600 hover:text-gray-900"
					}`}
				>
					Regional Settings
				</button>
			</div>

			{/* Overview Tab */}
			{activeTab === "overview" && (
				<div className="grid grid-cols-3 gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">HSN Codes</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold mb-2">{hsnCodes.length}</div>
							<div className="text-sm text-gray-500">
								{hsnCodes.filter((h) => h.isActive).length} active
							</div>
							<Button
								variant="outline"
								size="sm"
								className="mt-4 w-full"
								onClick={() => setActiveTab("hsn")}
							>
								Manage HSN Codes
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Tax Categories</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold mb-2">
								{taxCategories.length}
							</div>
							<div className="text-sm text-gray-500">
								{taxCategories.filter((c) => c.isActive).length} active
							</div>
							<Button
								variant="outline"
								size="sm"
								className="mt-4 w-full"
								onClick={() => setActiveTab("categories")}
							>
								Manage Categories
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Regional Configs</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold mb-2">{configs.length}</div>
							<div className="text-sm text-gray-500">
								{configs.filter((c) => c.isActive).length} active
							</div>
							<Button
								variant="outline"
								size="sm"
								className="mt-4 w-full"
								onClick={() => setActiveTab("settings")}
							>
								Manage Settings
							</Button>
						</CardContent>
					</Card>
				</div>
			)}

			{/* HSN Codes Tab */}
			{activeTab === "hsn" && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<Input
								placeholder="Search HSN codes..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Button
							onClick={openCreateHSN}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							<Plus className="w-4 h-4 mr-2" />
							Add HSN Code
						</Button>
					</div>

					<Card>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>HSN Code</TableHead>
									<TableHead>Description</TableHead>
									<TableHead>Category</TableHead>
									<TableHead>GST Rate</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredHSN.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center py-8 text-gray-500"
										>
											No HSN codes found
										</TableCell>
									</TableRow>
								) : (
									filteredHSN.map((hsn) => (
										<TableRow key={hsn.id}>
											<TableCell className="font-mono font-medium">
												{hsn.code}
											</TableCell>
											<TableCell>{hsn.description}</TableCell>
											<TableCell>
												<Badge variant="outline">{hsn.category}</Badge>
											</TableCell>
											<TableCell>
												<span className="font-medium">{hsn.gstRate}%</span>
												{hsn.cgst && hsn.sgst && (
													<span className="text-xs text-gray-500 ml-2">
														(CGST: {hsn.cgst}%, SGST: {hsn.sgst}%)
													</span>
												)}
												{hsn.igst && (
													<span className="text-xs text-gray-500 ml-2">
														(IGST: {hsn.igst}%)
													</span>
												)}
											</TableCell>
											<TableCell>
												<Badge variant={hsn.isActive ? "default" : "secondary"}>
													{hsn.isActive ? "Active" : "Inactive"}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => openEditHSN(hsn)}
													>
														<Edit2 className="w-4 h-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleDeleteHSN(hsn.id)}
														className="text-red-600 hover:text-red-700"
													>
														<Trash2 className="w-4 h-4" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</Card>
				</div>
			)}

			{/* Tax Categories Tab */}
			{activeTab === "categories" && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h4 className="font-medium text-gray-900">Tax Categories</h4>
							<p className="text-sm text-gray-500">
								Manage tax categories for different service types
							</p>
						</div>
						<Button
							onClick={openCreateCategory}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							<Plus className="w-4 h-4 mr-2" />
							Add Category
						</Button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{taxCategories.length === 0 ? (
							<Card className="col-span-2">
								<CardContent className="py-12 text-center">
									<ReceiptText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
									<p className="text-gray-500 mb-4">
										No tax categories configured
									</p>
									<Button
										onClick={openCreateCategory}
										className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
									>
										<Plus className="w-4 h-4 mr-2" />
										Create First Category
									</Button>
								</CardContent>
							</Card>
						) : (
							taxCategories.map((category) => (
								<Card key={category.id}>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div>
												<CardTitle className="text-base">
													{category.name}
												</CardTitle>
												<p className="text-sm text-gray-500 mt-1">
													{category.description}
												</p>
											</div>
											<Badge
												variant={category.isActive ? "default" : "secondary"}
											>
												{category.isActive ? "Active" : "Inactive"}
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">Default GST Rate:</span>
												<span className="font-medium">
													{category.defaultGSTRate}%
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">
													Applicable Services:
												</span>
												<span className="font-medium">
													{category.applicableServices.length}
												</span>
											</div>
										</div>
										<div className="flex gap-2 mt-4">
											<Button
												variant="outline"
												size="sm"
												className="flex-1"
												onClick={() => openEditCategory(category)}
											>
												<Edit2 className="w-4 h-4 mr-2" />
												Edit
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleDeleteCategory(category.id)}
												className="text-red-600 hover:text-red-700"
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</div>
									</CardContent>
								</Card>
							))
						)}
					</div>
				</div>
			)}

			{/* Regional Settings Tab */}
			{activeTab === "settings" && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h4 className="font-medium text-gray-900">
								Regional GST Settings
							</h4>
							<p className="text-sm text-gray-500">
								Configure GST settings per region
							</p>
						</div>
						<Button
							onClick={() => {
								setEditingConfig({
									id: "",
									region: "India",
									gstInclusion: "inclusive",
									defaultGSTRate: 18,
									taxCategories: [],
									hsnCodes: [],
									isActive: true,
								});
								setShowSettingsModal(true);
							}}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							<Plus className="w-4 h-4 mr-2" />
							Add Regional Config
						</Button>
					</div>

					{configs.length === 0 ? (
						<Card>
							<CardContent className="py-12 text-center">
								<AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
								<p className="text-gray-500 mb-4">No regional configurations</p>
								<Button
									onClick={() => {
										setEditingConfig({
											id: "",
											region: "India",
											gstInclusion: "inclusive",
											defaultGSTRate: 18,
											taxCategories: [],
											hsnCodes: [],
											isActive: true,
										});
										setShowSettingsModal(true);
									}}
									className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
								>
									<Plus className="w-4 h-4 mr-2" />
									Create First Config
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{configs.map((config) => (
								<Card key={config.id}>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div>
												<CardTitle className="text-base">
													{config.region}
												</CardTitle>
												<p className="text-sm text-gray-500 mt-1">
													GST{" "}
													{config.gstInclusion === "inclusive"
														? "Inclusive"
														: config.gstInclusion === "exclusive"
															? "Exclusive"
															: "Not Applicable"}
												</p>
											</div>
											<Badge
												variant={config.isActive ? "default" : "secondary"}
											>
												{config.isActive ? "Active" : "Inactive"}
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">Default GST Rate:</span>
												<span className="font-medium">
													{config.defaultGSTRate}%
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">Tax Categories:</span>
												<span className="font-medium">
													{config.taxCategories.length}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">HSN Codes:</span>
												<span className="font-medium">
													{config.hsnCodes.length}
												</span>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</div>
			)}

			{/* HSN Code Modal */}
			<Dialog open={showHSNModal} onOpenChange={setShowHSNModal}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingHSN?.id ? "Edit HSN Code" : "Create HSN Code"}
						</DialogTitle>
						<DialogDescription>
							Add or update HSN code with GST rate and tax breakdown
						</DialogDescription>
					</DialogHeader>

					{editingHSN && (
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>HSN Code *</Label>
									<Input
										value={editingHSN.code}
										onChange={(e) =>
											setEditingHSN({ ...editingHSN, code: e.target.value })
										}
										placeholder="e.g., 998314"
										className="font-mono"
									/>
								</div>
								<div className="space-y-2">
									<Label>Category *</Label>
									<Input
										value={editingHSN.category}
										onChange={(e) =>
											setEditingHSN({ ...editingHSN, category: e.target.value })
										}
										placeholder="e.g., Veterinary Services"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Description *</Label>
								<Input
									value={editingHSN.description}
									onChange={(e) =>
										setEditingHSN({
											...editingHSN,
											description: e.target.value,
										})
									}
									placeholder="e.g., Veterinary consultation services"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>GST Rate (%) *</Label>
									<Input
										type="number"
										value={editingHSN.gstRate}
										onChange={(e) =>
											setEditingHSN({
												...editingHSN,
												gstRate: parseFloat(e.target.value) || 0,
											})
										}
										min="0"
										max="100"
									/>
								</div>
								<div className="space-y-2">
									<Label>Status</Label>
									<div className="flex items-center gap-2 pt-2">
										<Switch
											checked={editingHSN.isActive}
											onCheckedChange={(c) =>
												setEditingHSN({ ...editingHSN, isActive: c })
											}
										/>
										<span className="text-sm">
											{editingHSN.isActive ? "Active" : "Inactive"}
										</span>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label>CGST (%)</Label>
									<Input
										type="number"
										value={editingHSN.cgst || ""}
										onChange={(e) =>
											setEditingHSN({
												...editingHSN,
												cgst: e.target.value
													? parseFloat(e.target.value)
													: undefined,
											})
										}
										placeholder="Auto"
									/>
								</div>
								<div className="space-y-2">
									<Label>SGST (%)</Label>
									<Input
										type="number"
										value={editingHSN.sgst || ""}
										onChange={(e) =>
											setEditingHSN({
												...editingHSN,
												sgst: e.target.value
													? parseFloat(e.target.value)
													: undefined,
											})
										}
										placeholder="Auto"
									/>
								</div>
								<div className="space-y-2">
									<Label>IGST (%)</Label>
									<Input
										type="number"
										value={editingHSN.igst || ""}
										onChange={(e) =>
											setEditingHSN({
												...editingHSN,
												igst: e.target.value
													? parseFloat(e.target.value)
													: undefined,
											})
										}
										placeholder="Auto"
									/>
								</div>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowHSNModal(false);
								setEditingHSN(null);
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSaveHSN}
							disabled={saving || !editingHSN?.code || !editingHSN?.description}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							{saving ? "Saving..." : editingHSN?.id ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Tax Category Modal */}
			<Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingCategory?.id
								? "Edit Tax Category"
								: "Create Tax Category"}
						</DialogTitle>
						<DialogDescription>
							Define tax categories for different service types
						</DialogDescription>
					</DialogHeader>

					{editingCategory && (
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label>Category Name *</Label>
								<Input
									value={editingCategory.name}
									onChange={(e) =>
										setEditingCategory({
											...editingCategory,
											name: e.target.value,
										})
									}
									placeholder="e.g., Healthcare Services"
								/>
							</div>

							<div className="space-y-2">
								<Label>Description</Label>
								<Input
									value={editingCategory.description}
									onChange={(e) =>
										setEditingCategory({
											...editingCategory,
											description: e.target.value,
										})
									}
									placeholder="Description of this tax category"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Default GST Rate (%) *</Label>
									<Input
										type="number"
										value={editingCategory.defaultGSTRate}
										onChange={(e) =>
											setEditingCategory({
												...editingCategory,
												defaultGSTRate: parseFloat(e.target.value) || 0,
											})
										}
										min="0"
										max="100"
									/>
								</div>
								<div className="space-y-2">
									<Label>Status</Label>
									<div className="flex items-center gap-2 pt-2">
										<Switch
											checked={editingCategory.isActive}
											onCheckedChange={(c) =>
												setEditingCategory({ ...editingCategory, isActive: c })
											}
										/>
										<span className="text-sm">
											{editingCategory.isActive ? "Active" : "Inactive"}
										</span>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Applicable Services</Label>
								<Input
									value={editingCategory.applicableServices.join(", ")}
									onChange={(e) =>
										setEditingCategory({
											...editingCategory,
											applicableServices: e.target.value
												.split(",")
												.map((s) => s.trim())
												.filter((s) => s),
										})
									}
									placeholder="e.g., veterinary, grooming, training (comma-separated)"
								/>
								<p className="text-xs text-gray-500">
									Enter service types separated by commas
								</p>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowCategoryModal(false);
								setEditingCategory(null);
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSaveCategory}
							disabled={saving || !editingCategory?.name}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							{saving ? "Saving..." : editingCategory?.id ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
