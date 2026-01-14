"use client";

import React, { useState, useEffect } from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Label,
	Badge,
	Card,
	Input,
	Button,
} from "@warmpawz/ui";

import {
	Megaphone,
	Plus,
	Search,
	Trash2,
	Edit,
	LayoutTemplate,
	Save,
	RotateCcw,
	Star,
	Zap,
	Tag,
	Image as ImageIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast, Toaster } from "sonner";
import {
	CouponManagement,
	AdvancedPromotionsEngine,
} from "@/components/admin/marketing";

import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function MarketingPromotionsTab() {
	const [activeTab, setActiveTab] = useState<
		| "promotions"
		| "ui-config"
		| "spotlight"
		| "coupons"
		| "advanced"
	>("promotions");
	const [loading, setLoading] = useState(false);

	// Spotlight State
	const [spotlights, setSpotlights] = useState<any[]>([]);
	const [availableVendors, setAvailableVendors] = useState<any[]>([]);
	const [spotlightModal, setSpotlightModal] = useState(false);
	const [selectedVendorId, setSelectedVendorId] = useState("");
	const [spotlightDuration, setSpotlightDuration] = useState("7");
	const [spotlightType, setSpotlightType] = useState("featured_vendor");

	// Promotions State
	const [promotions, setPromotions] = useState<any[]>([]);
	const [showPromoModal, setShowPromoModal] = useState(false);
	const [editingPromo, setEditingPromo] = useState<any>(null);
	const [promoForm, setPromoForm] = useState({
		title: "",
		subtitle: "",
		discountType: "percentage",
		discountValue: 0,
		code: "",
		serviceCategory: "all",
		serviceStyle: "all",
		validFrom: "",
		validUntil: "",
		isActive: true,
		displayType: "spotlight",
	});

	// UI Config State
	const [uiConfig, setUiConfig] = useState<any[]>([]);
	const [selectedRole, setSelectedRole] = useState("veterinarian");
	const [availableRoles, setAvailableRoles] = useState<any[]>([]);
	const [configLoading, setConfigLoading] = useState(false);

	

	useEffect(() => {
		if (activeTab === "promotions") {
			loadPromotions();
			loadRoles();
		} else if (activeTab === "spotlight") {
			loadSpotlights();
			loadVendors();
		} else {
			loadRoles(); // Load roles first
		}
	}, [activeTab]);

	// Reload config when role changes or tab is opened
	useEffect(() => {
		if (activeTab === "ui-config" && selectedRole) {
			loadUiConfig();
		}
	}, [selectedRole, activeTab]);

	// Safety net: Ensure uiConfig is always an array
	useEffect(() => {
		if (!Array.isArray(uiConfig)) {
			console.error('[Safety Check] uiConfig is not an array! Fixing...', uiConfig, typeof uiConfig);
			setUiConfig([]);
		}
	}, [uiConfig]);

	const loadRoles = async () => {
		try {
			// Try /admin/roles first (preferred), fallback to /config/roles
			let data: any;
			try {
				data = await apiClient.get<any>("/admin/roles");
				if (data.success && data.roles) {
					// Ensure roles is an array
					const roles = Array.isArray(data.roles) ? data.roles : [];
					setAvailableRoles(roles);
					return;
				}
			} catch (err) {
				console.warn('Failed to load from /admin/roles, trying /config/roles:', err);
			}
			
			// Fallback to /config/roles
			data = await apiClient.get("/config/roles");
			// Ensure roles is an array
			const roles = Array.isArray((data as any).roles) ? (data as any).roles : [];
			setAvailableRoles(roles);

			// If current selected role is not in the list and we have roles, select the first one
			if (Array.isArray(roles) && roles.length > 0) {
				// Check if currently selected role exists in the fetched roles
				const roleExists = roles.some((r: any) => r.id === selectedRole);
				if (!roleExists) {
					setSelectedRole(roles[0].id);
				}
			}
		} catch (error) {
			console.error("Error loading roles:", error);
			setAvailableRoles([]); // Set to empty array on error
		}
	};

	// ===========================
	// SPOTLIGHT LOGIC
	// ===========================

	const loadSpotlights = async () => {
		setLoading(true);
		try {
			const data = await apiClient.get("/marketing/spotlights");
			// Ensure spotlights is an array
			const spotlights = Array.isArray((data as any).spotlights) 
				? (data as any).spotlights 
				: [];
			setSpotlights(spotlights);
		} catch (error) {
			console.error("Error loading spotlights:", error);
			setSpotlights([]); // Set to empty array on error
		} finally {
			setLoading(false);
		}
	};

	const loadVendors = async () => {
		try {
			// Fetch only active vendors
			const data = await apiClient.get("/admin/vendors");
			const vendors = Array.isArray((data as any).vendors) 
				? (data as any).vendors 
				: [];
			const activeVendors = vendors.filter(
				(v: any) => v.status === "approved"
			);
			setAvailableVendors(activeVendors);
		} catch (error) {
			console.error("Error loading vendors:", error);
			setAvailableVendors([]); // Set to empty array on error
		}
	};

	const handleAddSpotlight = async () => {
		if (!selectedVendorId) {
			toast.error("Please select a vendor");
			return;
		}

		try {
			const vendor = availableVendors.find(
				(v) => v.id === selectedVendorId || v.vendorId === selectedVendorId
			);

			const payload = {
				vendorId: selectedVendorId,
				vendorName:
					vendor?.businessName || vendor?.fullName || "Unknown Vendor",
				type: spotlightType,
				durationDays: parseInt(spotlightDuration),
				startDate: new Date().toISOString(),
				status: "active",
			};

			await apiClient.post("/marketing/spotlights", payload);
			toast.success("Vendor added to spotlight");
			setSpotlightModal(false);
			loadSpotlights();
			setSelectedVendorId("");
		} catch (error) {
			console.error("Error adding spotlight:", error);
			toast.error("Error adding spotlight");
		}
	};

	const handleRemoveSpotlight = async (id: string) => {
		if (!confirm("Remove this vendor from spotlight?")) return;

		try {
			await apiClient.delete(`/marketing/spotlights/${id}`);
			toast.success("Spotlight removed");
			loadSpotlights();
		} catch (error) {
			toast.error("Failed to remove spotlight");
		}
	};

	// ===========================
	// PROMOTIONS LOGIC
	// ===========================

	const loadPromotions = async () => {
		setLoading(true);
		try {
			const data = await apiClient.get("/marketing/promotions");
			if ((data as any).success) {
				// Ensure promotions is an array
				const promotions = Array.isArray((data as any).promotions) 
					? (data as any).promotions 
					: [];
				setPromotions(promotions);
			}
		} catch (error) {
			console.error("Error loading promotions:", error);
			toast.error("Failed to load promotions");
			setPromotions([]); // Set to empty array on error
		} finally {
			setLoading(false);
		}
	};

	const handleSavePromo = async () => {
		try {
			if (editingPromo) {
				await apiClient.put(`/marketing/promotions/${editingPromo.id}`, promoForm);
			} else {
				await apiClient.post("/marketing/promotions", promoForm);
			}
			toast.success(
				`Promotion ${editingPromo ? "updated" : "created"} successfully`
			);
			setShowPromoModal(false);
			loadPromotions();
			resetForm();
		} catch (error) {
			console.error("Error saving promotion:", error);
			toast.error("Error saving promotion");
		}
	};

	const handleDeletePromo = async (id: string) => {
		if (!confirm("Are you sure you want to delete this promotion?")) return;

		try {
			await apiClient.delete(`/marketing/promotions/${id}`);
			toast.success("Promotion deleted");
			loadPromotions();
		} catch (error) {
			toast.error("Failed to delete promotion");
		}
	};

	const resetForm = () => {
		setEditingPromo(null);
		setPromoForm({
			title: "",
			subtitle: "",
			discountType: "percentage",
			discountValue: 0,
			code: "",
			serviceCategory: "all",
			serviceStyle: "all",
			validFrom: "",
			validUntil: "",
			isActive: true,
			displayType: "spotlight",
		});
	};

	const openEditModal = (promo: any) => {
		setEditingPromo(promo);
		setPromoForm({
			title: promo.title,
			subtitle: promo.subtitle,
			discountType: promo.discountType,
			discountValue: promo.discountValue,
			code: promo.code,
			serviceCategory: promo.serviceCategory,
			serviceStyle: promo.serviceStyle,
			validFrom: promo.validFrom,
			validUntil: promo.validUntil,
			isActive: promo.isActive,
			displayType: promo.displayType,
		});
		setShowPromoModal(true);
	};

	// ===========================
	// UI CONFIG LOGIC
	// ===========================

	const loadUiConfig = async () => {
		setConfigLoading(true);
		// Always initialize to empty array to prevent null/undefined issues
		setUiConfig([]);
		try {
			const data = await apiClient.get(`/config/ui/dashboard?roleId=${selectedRole}`);
			
			// Debug logging
			console.log('[loadUiConfig] Raw API response:', data);
			console.log('[loadUiConfig] Response type:', typeof data);
			console.log('[loadUiConfig] Is array:', Array.isArray(data));
			
			// Handle various response structures
			let config: any = null;
			
			// Case 1: Response has success and config properties
			if (data && typeof data === 'object' && 'success' in data && (data as any).success) {
				config = (data as any).config;
				console.log('[loadUiConfig] Extracted config from success response:', config);
			}
			// Case 2: Response is the config directly (array or object)
			else if (data && typeof data === 'object') {
				// Check if data itself is an array
				if (Array.isArray(data)) {
					console.log('[loadUiConfig] Data is array, using directly');
					setUiConfig(data);
					return;
				}
				// Check if data has config property (even without success)
				if ('config' in data) {
					config = (data as any).config;
					console.log('[loadUiConfig] Extracted config from data.config:', config);
				}
				// Otherwise, treat data as the config
				else {
					config = data;
					console.log('[loadUiConfig] Using data as config:', config);
				}
			}
			
			// Now process the config
			if (config === null || config === undefined) {
				console.log('[loadUiConfig] Config is null/undefined, setting empty array');
				setUiConfig([]);
				return;
			}
			
			// If config is an array, use it directly
			if (Array.isArray(config)) {
				console.log('[loadUiConfig] Config is array, using directly, length:', config.length);
				setUiConfig(config);
				return;
			}
			
			// If config is an object, try to extract buttons or widgets array
			if (config && typeof config === 'object') {
				if (Array.isArray(config.buttons)) {
					console.log('[loadUiConfig] Found config.buttons array, length:', config.buttons.length);
					setUiConfig(config.buttons);
					return;
				}
				if (Array.isArray(config.widgets)) {
					console.log('[loadUiConfig] Found config.widgets array, length:', config.widgets.length);
					setUiConfig(config.widgets);
					return;
				}
				console.log('[loadUiConfig] Config object but no buttons/widgets array found. Config keys:', Object.keys(config));
			}
			
			// Default to empty array if structure is unexpected
			console.warn('[loadUiConfig] Unexpected config structure, defaulting to empty array. Config:', config);
			setUiConfig([]);
		} catch (error) {
			console.error("Error loading config:", error);
			toast.error("Failed to load UI config");
			setUiConfig([]); // Set to empty array on error
		} finally {
			setConfigLoading(false);
		}
	};

	const handleToggleService = (index: number) => {
		if (!Array.isArray(uiConfig) || index < 0 || index >= uiConfig.length) return;
		const newConfig = [...uiConfig];
		if (newConfig[index]) {
			newConfig[index].enabled = !newConfig[index].enabled;
			setUiConfig(newConfig);
		}
	};

	const handleSaveConfig = async () => {
		try {
			if (!Array.isArray(uiConfig)) {
				toast.error("Invalid configuration format");
				return;
			}
			await apiClient.put("/config/ui/dashboard", {
				roleId: selectedRole,
				config: uiConfig,
			});
			toast.success("Dashboard configuration saved");
		} catch (error) {
			console.error("Error saving config:", error);
			toast.error("Error saving configuration");
		}
	};

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col min-h-screen bg-gray-50">
				<Toaster position="top-right" richColors />
				
				{/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
				<div className="bg-white border-b border-gray-200">
					<div className="max-w-7xl mx-auto px-6 py-4">
						<div className="flex items-center justify-between mb-4">
							<div>
								{/* ✅ FIX: Match wireframe - text-2xl font-bold for marketing page */}
								<h1 className="text-2xl font-bold text-gray-900">
									Marketing & Promotions
								</h1>
								<p className="text-gray-500 text-sm mt-1">
									Manage promotions and customize customer dashboard experience
								</p>
							</div>
							<div className="flex items-center gap-2">
								<div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
									Live
								</div>
							</div>
						</div>

						{/* Tabs - Match wireframe: Integrated into header with border-b pattern */}
						<div className="flex gap-1 overflow-x-auto">
							<button
								onClick={() => setActiveTab("promotions")}
								className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
									activeTab === "promotions"
										? "border-[#FF8C42] text-[#FF8C42]"
										: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
							>
								<Megaphone className="w-5 h-5" />
								<span className="font-medium">Promotions</span>
							</button>
							<button
								onClick={() => setActiveTab("ui-config")}
								className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
									activeTab === "ui-config"
										? "border-[#FF8C42] text-[#FF8C42]"
										: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
							>
								<LayoutTemplate className="w-5 h-5" />
								<span className="font-medium">Dashboard UI</span>
							</button>
							<button
								onClick={() => setActiveTab("spotlight")}
								className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
									activeTab === "spotlight"
										? "border-[#FF8C42] text-[#FF8C42]"
										: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
							>
								<Star className="w-5 h-5" />
								<span className="font-medium">Spotlight</span>
							</button>
							<button
								onClick={() => setActiveTab("coupons")}
								className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
									activeTab === "coupons"
										? "border-[#FF8C42] text-[#FF8C42]"
										: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
							>
								<Tag className="w-5 h-5" />
								<span className="font-medium">Coupons</span>
							</button>
							<button
								onClick={() => setActiveTab("advanced")}
								className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
									activeTab === "advanced"
										? "border-[#FF8C42] text-[#FF8C42]"
										: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
							>
								<Zap className="w-5 h-5" />
								<span className="font-medium">Advanced</span>
							</button>
						</div>
					</div>
				</div>

				{/* Content - Match wireframe: max-w-7xl mx-auto p-6 */}
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-7xl mx-auto p-6">
						{/* PROMOTIONS TAB */}
						{activeTab === "promotions" && (
							<Card className="p-6">
								<div className="flex justify-between items-center mb-6">
						<div className="relative w-64">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<Input placeholder="Search promotions..." className="pl-9" />
						</div>
						<Button
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
							onClick={() => {
								resetForm();
								setShowPromoModal(true);
							}}
						>
							<Plus className="w-4 h-4 mr-2" />
							Create Promotion
						</Button>
					</div>

					{loading ? (
						<div className="text-center py-12">Loading promotions...</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Title</TableHead>
									<TableHead>Discount</TableHead>
									<TableHead>Code</TableHead>
									<TableHead>Category</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{Array.isArray(promotions) && promotions.map((promo) => (
									<TableRow key={promo.id}>
										<TableCell className="font-medium">
											<div>{promo.title}</div>
											<div className="text-xs text-gray-500">
												{promo.subtitle}
											</div>
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className="bg-green-50 text-green-700 border-green-200"
											>
												{promo.discountType === "percentage"
													? `${promo.discountValue}%`
													: `₹${promo.discountValue}`}{" "}
												OFF
											</Badge>
										</TableCell>
										<TableCell className="font-mono text-xs">
											{promo.code}
										</TableCell>
										<TableCell className="capitalize">
											{promo.serviceCategory.replace("_", " ")}
										</TableCell>
										<TableCell>
											<Switch
												checked={promo.isActive}
												onCheckedChange={async () => {
													// Toggle active status
													await apiClient.put(`/marketing/promotions/${promo.id}`, {
														isActive: !promo.isActive,
													});
													loadPromotions();
												}}
											/>
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => openEditModal(promo)}
											>
												<Edit className="w-4 h-4 text-blue-600" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleDeletePromo(promo.id)}
											>
												<Trash2 className="w-4 h-4 text-red-600" />
											</Button>
										</TableCell>
									</TableRow>
								))}
								{(!Array.isArray(promotions) || promotions.length === 0) && (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center py-8 text-gray-500"
										>
											No promotions found. Create one to get started.
										</TableCell>
									</TableRow>
										)}
									</TableBody>
								</Table>
							)}
						</Card>
						)}

						{/* UI CONFIG TAB */}
						{activeTab === "ui-config" && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<Card className="p-6 col-span-1 h-fit">
									<h3 className="font-semibold mb-4">Configuration Scope</h3>
									<div className="space-y-4">
										<div>
											<Label>Target Role</Label>
											<Select value={selectedRole} onValueChange={setSelectedRole}>
												<SelectTrigger>
													<SelectValue placeholder="Select a role" />
												</SelectTrigger>
												<SelectContent>
													{Array.isArray(availableRoles) && availableRoles.length > 0 ? (
														availableRoles.map((role) => (
															<SelectItem key={role.id} value={role.id}>
																{role.name}
															</SelectItem>
														))
													) : (
														<>
															<SelectItem value="veterinarian">
																Veterinarian
															</SelectItem>
															<SelectItem value="groomer">Groomer</SelectItem>
															<SelectItem value="walker">Walker</SelectItem>
															<SelectItem value="trainer">Trainer</SelectItem>
														</>
													)}
												</SelectContent>
											</Select>
										</div>
										<div className="pt-4 border-t text-sm text-gray-500">
											Use this section to show or hide service buttons on the customer
											dashboard. Changes reflect immediately in the app.
										</div>
									</div>
								</Card>

								<Card className="p-6 col-span-2">
									<div className="flex justify-between items-center mb-6">
										<h3 className="font-semibold">Dashboard Buttons</h3>
										<Button
											onClick={handleSaveConfig}
											disabled={configLoading}
											className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										>
											<Save className="w-4 h-4 mr-2" />
											Save Changes
										</Button>
									</div>

									{configLoading ? (
										<div className="text-center py-12">Loading configuration...</div>
									) : (
										<div className="space-y-4">
											{(() => {
												// Double-check uiConfig is an array before mapping
												if (!Array.isArray(uiConfig)) {
													console.error('[UI Config Render] uiConfig is not an array!', uiConfig, typeof uiConfig);
													return null;
												}
												if (uiConfig.length === 0) {
													return null;
												}
												return uiConfig.map((btn: any, index: number) => (
													<div
														key={btn.id}
														className="p-4 border rounded-lg bg-gray-50 space-y-3"
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center">
																	<span className="text-xs font-bold text-gray-500">
																		{btn.icon || "🔘"}
																	</span>
																</div>
																<div className="flex-1">
																	<div className="font-medium">{btn.label || btn.id}</div>
																	<div className="text-xs text-gray-500 font-mono">
																		ID: {btn.id}
																	</div>
																	{btn.serviceId && (
																		<div className="text-xs text-gray-400 font-mono">
																			Service: {btn.serviceId}
																		</div>
																	)}
																</div>
															</div>
															<div className="flex items-center gap-2">
																<span
																	className={`text-xs font-medium ${btn.enabled ? "text-green-600" : "text-gray-400"}`}
																>
																	{btn.enabled ? "Visible" : "Hidden"}
																</span>
																<Switch
																	checked={btn.enabled}
																	onCheckedChange={() => handleToggleService(index)}
																/>
															</div>
														</div>
														
														{/* Advanced Configuration */}
														<div className="pt-2 border-t space-y-2">
															<div className="grid grid-cols-2 gap-2 text-xs">
																<div>
																	<span className="text-gray-500 block mb-1">Launch Phase:</span>
																	<Select
																		value={btn.launchPhase || "full"}
																		onValueChange={(value) => {
																			const newConfig = [...uiConfig];
																			newConfig[index].launchPhase = value;
																			setUiConfig(newConfig);
																		}}
																	>
																		<SelectTrigger className="h-8 text-xs">
																			<SelectValue />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value="coming_soon">Coming Soon</SelectItem>
																			<SelectItem value="beta">Beta</SelectItem>
																			<SelectItem value="full">Full Launch</SelectItem>
																		</SelectContent>
																	</Select>
																</div>
																<div>
																	<span className="text-gray-500 block mb-1">Rollout %:</span>
																	<Input
																		type="number"
																		min="0"
																		max="100"
																		value={btn.rolloutPercentage || 100}
																		onChange={(e) => {
																			const newConfig = [...uiConfig];
																			newConfig[index].rolloutPercentage = parseInt(e.target.value) || 100;
																			setUiConfig(newConfig);
																		}}
																		className="h-8 text-xs"
																		placeholder="100"
																	/>
																</div>
															</div>
															{btn.launchPhase === "coming_soon" && (
																<div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
																	⚠️ Service will be blocked from booking
																</div>
															)}
															{btn.launchPhase === "beta" && (
																<div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
																	ℹ️ Service available for beta users only
																</div>
															)}
														</div>
													</div>
												));
											})()}
											{(() => {
												// Double-check before showing empty state
												if (!Array.isArray(uiConfig)) {
													console.error('[UI Config Empty State] uiConfig is not an array!', uiConfig, typeof uiConfig);
													return (
														<div className="text-center py-8 text-gray-500">
															Configuration error. Please refresh the page.
														</div>
													);
												}
												if (uiConfig.length === 0) {
													return (
												<div className="text-center py-8 text-gray-500">
													No configuration found for this role.
													<Button
														variant="outline"
														onClick={loadUiConfig}
														className="mt-2"
													>
														<RotateCcw className="w-4 h-4 mr-2" /> Retry
													</Button>
													</div>
													);
												}
												return null;
											})()}
										</div>
									)}
								</Card>
							</div>
						)}

						{/* SPOTLIGHT TAB */}
						{activeTab === "spotlight" && (
							<div className="space-y-6">
								<div className="flex justify-between items-center">
									<div>
										<h3 className="text-lg font-medium">Featured Vendors</h3>
										<p className="text-sm text-gray-500">
											Highlight top performing vendors on the home screen
										</p>
									</div>
									<Button
										className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
										onClick={() => setSpotlightModal(true)}
									>
										<Plus className="w-4 h-4 mr-2" />
										Add Spotlight
									</Button>
								</div>

											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									{Array.isArray(spotlights) && spotlights.map((spot) => (
										<Card
											key={spot.id}
											className="overflow-hidden border-orange-100 shadow-sm hover:shadow-md transition-all"
										>
											<div className="bg-gradient-to-r from-orange-50 to-white p-4 border-b border-orange-100 flex justify-between items-start">
												<div className="flex items-center gap-2">
													<div className="p-2 bg-white rounded-full shadow-sm">
														<Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
													</div>
													<span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
														Featured
													</span>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 -mr-2 hover:text-red-600"
													onClick={() => handleRemoveSpotlight(spot.id)}
												>
													<Trash2 className="w-3 h-3" />
												</Button>
											</div>
											<div className="p-4">
												<h4 className="font-bold text-lg mb-1">{spot.vendorName}</h4>
												<div className="flex items-center gap-2 mb-3">
													<Badge variant="secondary" className="text-xs">
														{spot.type === "featured_vendor"
															? "Vendor Spotlight"
															: "Service Highlight"}
													</Badge>
												</div>
												<div className="text-sm text-gray-500 flex justify-between items-center pt-2 border-t mt-2">
													<span>Expires in:</span>
													<span className="font-medium text-gray-900">
														{Math.max(
															0,
															Math.ceil(
																(new Date(
																	new Date(spot.startDate).getTime() +
																		spot.durationDays * 86400000
																).getTime() -
																	new Date().getTime()) /
																	(1000 * 3600 * 24)
															)
														)}{" "}
														days
													</span>
												</div>
											</div>
										</Card>
									))}

									{(!Array.isArray(spotlights) || spotlights.length === 0) && (
										<div className="col-span-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
											<Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
											<h3 className="text-gray-900 font-medium">
												No Active Spotlights
											</h3>
											<p className="text-gray-500 text-sm mt-1 mb-4">
												Feature your best vendors to boost their visibility
											</p>
											<Button
												variant="outline"
												onClick={() => setSpotlightModal(true)}
											>
												Add First Spotlight
											</Button>
										</div>
									)}
								</div>
							</div>
						)}

						{/* COUPONS TAB */}
						{activeTab === "coupons" && <CouponManagement />}

						{/* ADVANCED TAB */}
						{activeTab === "advanced" && <AdvancedPromotionsEngine />}
					</div>
				</div>
			</div>

			{/* CREATE/EDIT PROMO MODAL */}
			<Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>
							{editingPromo ? "Edit Promotion" : "Create New Promotion"}
						</DialogTitle>
						<DialogDescription>
							Configure details for the marketing campaign.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Title</Label>
								<Input
									value={promoForm.title}
									onChange={(e) =>
										setPromoForm({ ...promoForm, title: e.target.value })
									}
									placeholder="e.g. Summer Sale"
								/>
							</div>
							<div>
								<Label>Subtitle</Label>
								<Input
									value={promoForm.subtitle}
									onChange={(e) =>
										setPromoForm({ ...promoForm, subtitle: e.target.value })
									}
									placeholder="e.g. 20% off on grooming"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Discount Type</Label>
								<Select
									value={promoForm.discountType}
									onValueChange={(v) =>
										setPromoForm({ ...promoForm, discountType: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="percentage">Percentage (%)</SelectItem>
										<SelectItem value="flat">Flat Amount (₹)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Discount Value</Label>
								<Input
									type="number"
									value={promoForm.discountValue}
									onChange={(e) =>
										setPromoForm({
											...promoForm,
											discountValue: parseFloat(e.target.value) || 0,
										})
									}
									placeholder="0"
								/>
							</div>
						</div>

						<div>
							<Label>Promo Code</Label>
							<Input
								value={promoForm.code}
								onChange={(e) =>
									setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })
								}
								placeholder="SUMMER2024"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Category</Label>
								<Select
									value={promoForm.serviceCategory}
									onValueChange={(v) =>
										setPromoForm({ ...promoForm, serviceCategory: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Categories</SelectItem>
										<SelectItem value="vet">Veterinary</SelectItem>
										<SelectItem value="grooming">Grooming</SelectItem>
										<SelectItem value="walking">Walking</SelectItem>
										<SelectItem value="training">Training</SelectItem>
										<SelectItem value="boarding">Boarding</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Service Style</Label>
								<Select
									value={promoForm.serviceStyle}
									onValueChange={(v) =>
										setPromoForm({ ...promoForm, serviceStyle: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Styles</SelectItem>
										<SelectItem value="home_visit">Home Visit</SelectItem>
										<SelectItem value="clinic">Clinic</SelectItem>
										<SelectItem value="online">Online</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Valid From</Label>
								<Input
									type="datetime-local"
									value={promoForm.validFrom}
									onChange={(e) =>
										setPromoForm({ ...promoForm, validFrom: e.target.value })
									}
								/>
							</div>
							<div>
								<Label>Valid Until</Label>
								<Input
									type="datetime-local"
									value={promoForm.validUntil}
									onChange={(e) =>
										setPromoForm({ ...promoForm, validUntil: e.target.value })
									}
								/>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Switch
								checked={promoForm.isActive}
								onCheckedChange={(checked) =>
									setPromoForm({ ...promoForm, isActive: checked })
								}
							/>
							<Label>Active</Label>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowPromoModal(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSavePromo}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							Save Promotion
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* SPOTLIGHT MODAL */}
			<Dialog open={spotlightModal} onOpenChange={setSpotlightModal}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Add Spotlight</DialogTitle>
						<DialogDescription>
							Feature a vendor or service on the homepage.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Select Vendor</Label>
							<Select
								value={selectedVendorId}
								onValueChange={setSelectedVendorId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Search vendors..." />
								</SelectTrigger>
								<SelectContent className="max-h-60">
									{Array.isArray(availableVendors) && availableVendors.map((v) => (
										<SelectItem
											key={v.id || v.vendorId}
											value={v.id || v.vendorId}
										>
											{v.businessName || v.fullName} ({v.vendorType})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Spotlight Type</Label>
							<Select value={spotlightType} onValueChange={setSpotlightType}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="featured_vendor">Featured Vendor</SelectItem>
									<SelectItem value="service_highlight">Service Highlight</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Duration (Days)</Label>
							<Select
								value={spotlightDuration}
								onValueChange={setSpotlightDuration}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="3">3 Days</SelectItem>
									<SelectItem value="7">7 Days</SelectItem>
									<SelectItem value="14">14 Days</SelectItem>
									<SelectItem value="30">30 Days</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setSpotlightModal(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAddSpotlight}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							Add Spotlight
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminLayout>
	);
}
