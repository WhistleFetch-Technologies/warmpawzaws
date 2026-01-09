import { useState, useEffect, useMemo } from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Badge,
	Checkbox,
	ScrollArea,
	Separator,
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
	Button,
	Input,
	Label,
	Switch,
} from "@repo/ui";

import { useAdminIntegrations } from "@/hooks/platform-settings/useAdminIntegrations";
import {
	Plus,
	Truck,
	Key,
	Globe,
	MapPin,
	Package,
	AlertCircle,
	Settings2,
	IndianRupee,
	Check,
	X,
	Calculator,
} from "lucide-react";

import { ShiprocketConfig } from "../shipRocketConfig/ShiprocketConfig";
import { DelhiveryConfig } from "../delhiveryConfig/DelhiveryConfig";
// import { DeliveryRulesManager } from './DeliveryRulesManager';

// Types
type DeliveryType = "last_mile" | "intercity" | "pan_india" | "hyperlocal";

interface PricingRule {
	baseFee: number;
	perKm: number;
	minCartValue: number; // Free delivery above this
	surgeMultiplier: number;
}

interface LogisticsPartner {
	id: string;
	name: string;
	type: DeliveryType;
	enabled: boolean;
	apiEndpoint: string;
	apiKey: string;
	regions: string[]; // Cities
	categories: string[];
	pricing: PricingRule;
}

const DEFAULT_PARTNER: LogisticsPartner = {
	id: "",
	name: "",
	type: "last_mile",
	enabled: true,
	apiEndpoint: "",
	apiKey: "",
	regions: [],
	categories: [],
	pricing: {
		baseFee: 40,
		perKm: 10,
		minCartValue: 500,
		surgeMultiplier: 1,
	},
};

const PRODUCT_CATEGORIES = [
	"Pet Food",
	"Medicines",
	"Restaurant Food",
	"Pet Clothes",
	"Accessories",
	"Grooming Supplies",
	"Toys",
];

const DELIVERY_TYPES: { value: DeliveryType; label: string }[] = [
	{ value: "last_mile", label: "Last Mile (Bike/Scooter)" },
	{ value: "hyperlocal", label: "Hyperlocal (Within 5km)" },
	{ value: "intercity", label: "Intercity (Trucking)" },
	{ value: "pan_india", label: "Pan India (Courier)" },
];

export function LogisticsSettings() {
	const { fetchLogistics, saveLogisticsPartner, loading } =
		useAdminIntegrations();
	const [partners, setPartners] = useState<LogisticsPartner[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [currentPartner, setCurrentPartner] =
		useState<LogisticsPartner>(DEFAULT_PARTNER);
	const [activeTab, setActiveTab] = useState("partners");
	const [modalTab, setModalTab] = useState("details");

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		const data = await fetchLogistics();
		if (data.success) {
			// Migrate old data if necessary
			const migratedPartners = (data.partners || []).map((p: any) => ({
				...DEFAULT_PARTNER,
				...p,
				pricing: { ...DEFAULT_PARTNER.pricing, ...(p.pricing || {}) },
			}));
			setPartners(migratedPartners);
		}
	};

	const handleSave = async () => {
		if (!currentPartner.name || !currentPartner.id) return;

		// Optimistic update
		const newPartners = partners.some((p) => p.id === currentPartner.id)
			? partners.map((p) => (p.id === currentPartner.id ? currentPartner : p))
			: [...partners, currentPartner];

		setPartners(newPartners);

		await saveLogisticsPartner(currentPartner);
		setIsModalOpen(false);
	};

	const toggleCategory = (category: string) => {
		const current = currentPartner.categories || [];
		if (current.includes(category)) {
			setCurrentPartner({
				...currentPartner,
				categories: current.filter((c) => c !== category),
			});
		} else {
			setCurrentPartner({
				...currentPartner,
				categories: [...current, category],
			});
		}
	};

	return (
		<div className="space-y-6">
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<div className="flex items-center justify-between mb-4">
					<TabsList>
						<TabsTrigger value="partners">Partners & Rules</TabsTrigger>
						<TabsTrigger value="shiprocket">Shiprocket Integration</TabsTrigger>
						<TabsTrigger value="delhivery">Delhivery Integration</TabsTrigger>
						<TabsTrigger value="simulator">Cost Simulator</TabsTrigger>
					</TabsList>

					{activeTab === "partners" && (
						<Button
							onClick={() => {
								setCurrentPartner({
									...DEFAULT_PARTNER,
									id: `partner_${Date.now()}`,
								});
								setModalTab("details");
								setIsModalOpen(true);
							}}
							className="bg-orange-600 hover:bg-orange-700"
						>
							<Plus className="w-4 h-4 mr-2" /> Add Partner
						</Button>
					)}
				</div>

				<TabsContent value="partners" className="space-y-4">
					<div className="grid grid-cols-1 gap-4">
						{partners.map((p) => (
							<PartnerCard
								key={p.id}
								partner={p}
								onEdit={() => {
									setCurrentPartner(p);
									setModalTab("details");
									setIsModalOpen(true);
								}}
							/>
						))}

						{partners.length === 0 && (
							<div className="text-center py-16 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
								<div className="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
									<Truck className="w-8 h-8 text-slate-400" />
								</div>
								<h3 className="text-lg font-semibold text-slate-900">
									No Logistics Partners
								</h3>
								<p className="text-slate-500 max-w-sm mx-auto mt-2">
									Add your first delivery partner to start managing shipments
									and delivery rules.
								</p>
								<Button
									variant="outline"
									className="mt-6"
									onClick={() => {
										setCurrentPartner({
											...DEFAULT_PARTNER,
											id: `partner_${Date.now()}`,
										});
										setModalTab("details");
										setIsModalOpen(true);
									}}
								>
									Configure First Partner
								</Button>
							</div>
						)}
					</div>
				</TabsContent>

				<TabsContent value="shiprocket">
					<ShiprocketConfig />
				</TabsContent>

				<TabsContent value="delhivery">
					<DelhiveryConfig />
				</TabsContent>

				<TabsContent value="simulator">
					<RuleSimulator partners={partners} />
				</TabsContent>
			</Tabs>

			{/* ADD/EDIT MODAL */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
					<DialogHeader className="p-6 pb-4 border-b bg-slate-50/50">
						<DialogTitle className="flex items-center gap-2 text-xl">
							<div className="p-2 bg-orange-100 rounded-lg">
								<Truck className="w-5 h-5 text-orange-600" />
							</div>
							{partners.some((p) => p.id === currentPartner.id)
								? "Edit Partner Configuration"
								: "New Logistics Partner"}
						</DialogTitle>
						<DialogDescription className="ml-11">
							Configure connectivity, service regions, and pricing models.
						</DialogDescription>
					</DialogHeader>

					<div className="p-6">
						<Tabs
							value={modalTab}
							onValueChange={setModalTab}
							className="w-full"
						>
							<TabsList className="grid w-full grid-cols-3 mb-6">
								<TabsTrigger value="details">Details & API</TabsTrigger>
								<TabsTrigger value="coverage">Coverage</TabsTrigger>
								<TabsTrigger value="pricing">Pricing Rules</TabsTrigger>
							</TabsList>

							{/* TAB 1: DETAILS & API */}
							<TabsContent value="details" className="space-y-6 mt-0">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Partner Name</Label>
										<Input
											value={currentPartner.name}
											onChange={(e) =>
												setCurrentPartner({
													...currentPartner,
													name: e.target.value,
												})
											}
											placeholder="e.g. Dunzo"
											className="font-medium"
										/>
									</div>
									<div className="space-y-2">
										<Label>Internal ID</Label>
										<Input
											value={currentPartner.id}
											onChange={(e) =>
												setCurrentPartner({
													...currentPartner,
													id: e.target.value,
												})
											}
											disabled={partners.some(
												(p) =>
													p.id === currentPartner.id && p !== DEFAULT_PARTNER
											)}
											className="font-mono text-sm bg-slate-50"
											placeholder="dunzo_last_mile"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Delivery Type</Label>
									<Select
										value={currentPartner.type}
										onValueChange={(v: DeliveryType) =>
											setCurrentPartner({ ...currentPartner, type: v })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DELIVERY_TYPES.map((t) => (
												<SelectItem key={t.value} value={t.value}>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<Separator />

								<div className="space-y-4">
									<div className="flex items-center gap-2 text-sm font-medium text-slate-900">
										<Key className="w-4 h-4 text-slate-500" />
										API Credentials
									</div>
									<div className="space-y-3">
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Endpoint URL
											</Label>
											<Input
												value={currentPartner.apiEndpoint}
												onChange={(e) =>
													setCurrentPartner({
														...currentPartner,
														apiEndpoint: e.target.value,
													})
												}
												placeholder="https://api.partner.com/v1"
												className="font-mono text-sm"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												API Key / Token
											</Label>
											<Input
												type="password"
												value={currentPartner.apiKey}
												onChange={(e) =>
													setCurrentPartner({
														...currentPartner,
														apiKey: e.target.value,
													})
												}
												className="font-mono text-sm"
												placeholder="••••••••••••••••"
											/>
										</div>
									</div>
								</div>

								<div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
									<div className="space-y-0.5">
										<Label>Partner Status</Label>
										<p className="text-xs text-muted-foreground">
											Enable or disable this integration
										</p>
									</div>
									<Switch
										checked={currentPartner.enabled}
										onCheckedChange={(c) =>
											setCurrentPartner({ ...currentPartner, enabled: c })
										}
									/>
								</div>
							</TabsContent>

							{/* TAB 2: COVERAGE */}
							<TabsContent value="coverage" className="space-y-6 mt-0">
								<div className="space-y-4">
									<div className="space-y-2">
										<Label className="flex items-center gap-2">
											<Globe className="w-4 h-4" /> Operating Regions
										</Label>
										<div className="p-4 bg-slate-50 rounded-lg border space-y-4">
											{/* Input & Search */}
											<div className="space-y-2">
												<div className="relative">
													<MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
													<Input
														className="pl-9 bg-white"
														placeholder="Type city name and press Enter to add..."
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																e.preventDefault();
																const val = e.currentTarget.value.trim();
																if (
																	val &&
																	!currentPartner.regions?.includes(val)
																) {
																	setCurrentPartner({
																		...currentPartner,
																		regions: [
																			...(currentPartner.regions || []),
																			val,
																		],
																	});
																	e.currentTarget.value = "";
																}
															}
														}}
													/>
												</div>
											</div>

											{/* Quick Select */}
											<div>
												<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
													Major Cities
												</span>
												<div className="flex flex-wrap gap-2">
													{[
														"Bangalore",
														"Mumbai",
														"Delhi",
														"Hyderabad",
														"Chennai",
														"Kolkata",
														"Pune",
														"Gurgaon",
													].map((city) => (
														<Button
															key={city}
															variant="outline"
															size="sm"
															className={`h-7 text-xs border-slate-200 ${currentPartner.regions?.includes(city) ? "bg-blue-50 text-blue-600 border-blue-200 opacity-50" : "hover:border-blue-300 hover:text-blue-600"}`}
															onClick={() => {
																if (!currentPartner.regions?.includes(city)) {
																	setCurrentPartner({
																		...currentPartner,
																		regions: [
																			...(currentPartner.regions || []),
																			city,
																		],
																	});
																}
															}}
															disabled={currentPartner.regions?.includes(city)}
														>
															{currentPartner.regions?.includes(city) ? (
																<Check className="w-3 h-3 mr-1" />
															) : (
																<Plus className="w-3 h-3 mr-1" />
															)}
															{city}
														</Button>
													))}
												</div>
											</div>

											{/* Selected List */}
											<div className="bg-white rounded-lg border border-slate-200 p-3 min-h-[80px]">
												<div className="flex items-center justify-between mb-2">
													<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
														Selected Coverage
													</span>
													<span className="text-[10px] text-slate-400">
														{currentPartner.regions?.length || 0} regions
													</span>
												</div>

												{!currentPartner.regions ||
												currentPartner.regions.length === 0 ? (
													<div className="flex flex-col items-center justify-center h-12 text-slate-400 text-xs bg-slate-50 rounded border border-dashed border-slate-200">
														<span className="flex items-center gap-1">
															<Globe className="w-3 h-3" /> Global / Pan-India
															Availability
														</span>
													</div>
												) : (
													<div className="flex flex-wrap gap-2">
														{currentPartner.regions.map((region, idx) => (
															<Badge
																key={idx}
																variant="secondary"
																className="pl-2 pr-1 py-1 flex items-center gap-1 bg-orange-50 text-orange-700 border-orange-100 border hover:bg-orange-100 transition-colors group"
															>
																<MapPin className="w-3 h-3 opacity-50" />
																{region}
																<button
																	onClick={() => {
																		const newRegions = [
																			...currentPartner.regions,
																		];
																		newRegions.splice(idx, 1);
																		setCurrentPartner({
																			...currentPartner,
																			regions: newRegions,
																		});
																	}}
																	className="ml-1 p-0.5 hover:bg-orange-200 rounded-full transition-colors text-orange-600"
																>
																	<X className="w-3 h-3" />
																</button>
															</Badge>
														))}
													</div>
												)}
											</div>

											<p className="text-xs text-muted-foreground flex items-center gap-1">
												<AlertCircle className="w-3 h-3" />
												Leave empty to enable for all regions.
											</p>
										</div>
									</div>

									<Separator />

									<div className="space-y-3">
										<Label className="flex items-center gap-2">
											<Package className="w-4 h-4" /> Supported Categories
										</Label>
										<ScrollArea className="h-[240px] rounded-lg border p-4">
											<div className="grid grid-cols-2 gap-3">
												{PRODUCT_CATEGORIES.map((cat) => (
													<div
														key={cat}
														className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50 transition-colors"
													>
														<Checkbox
															id={cat}
															checked={currentPartner.categories?.includes(cat)}
															onCheckedChange={() => toggleCategory(cat)}
														/>
														<label
															htmlFor={cat}
															className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full"
														>
															{cat}
														</label>
													</div>
												))}
											</div>
										</ScrollArea>
										<p className="text-xs text-muted-foreground text-right">
											Selected: {currentPartner.categories?.length || 0}{" "}
											categories
										</p>
									</div>
								</div>
							</TabsContent>

							{/* TAB 3: PRICING */}
							<TabsContent value="pricing" className="space-y-6 mt-0">
								<div className="bg-green-50/50 border border-green-100 rounded-lg p-4">
									<h3 className="text-sm font-semibold text-green-900 mb-1">
										Dynamic Pricing Logic
									</h3>
									<p className="text-xs text-green-700">
										Total Cost = (Base Fee + (Distance × Per Km)) × Surge
										Multiplier
									</p>
								</div>

								<div className="grid grid-cols-2 gap-6">
									<div className="space-y-2">
										<Label>Base Fee (₹)</Label>
										<div className="relative">
											<IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
											<Input
												type="number"
												min="0"
												value={currentPartner.pricing.baseFee}
												onChange={(e) =>
													setCurrentPartner({
														...currentPartner,
														pricing: {
															...currentPartner.pricing,
															baseFee: Number(e.target.value),
														},
													})
												}
												className="pl-9"
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label>Charge Per Km (₹)</Label>
										<div className="relative">
											<IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
											<Input
												type="number"
												min="0"
												value={currentPartner.pricing.perKm}
												onChange={(e) =>
													setCurrentPartner({
														...currentPartner,
														pricing: {
															...currentPartner.pricing,
															perKm: Number(e.target.value),
														},
													})
												}
												className="pl-9"
											/>
										</div>
									</div>
								</div>

								<Separator />

								<div className="space-y-4">
									<div className="space-y-2">
										<Label>Free Delivery Threshold</Label>
										<div className="relative">
											<Input
												type="number"
												min="0"
												value={currentPartner.pricing.minCartValue}
												onChange={(e) =>
													setCurrentPartner({
														...currentPartner,
														pricing: {
															...currentPartner.pricing,
															minCartValue: Number(e.target.value),
														},
													})
												}
												className="pr-24"
											/>
											<div className="absolute right-3 top-2.5 text-xs text-slate-500 font-medium pointer-events-none">
												Min Cart Value
											</div>
										</div>
										<p className="text-xs text-muted-foreground">
											Orders above this amount will have ₹0 delivery fee. Set to
											0 to disable.
										</p>
									</div>

									<div className="space-y-2">
										<Label>Surge Pricing Multiplier</Label>
										<div className="flex items-center gap-4">
											<Input
												type="number"
												min="1"
												step="0.1"
												value={currentPartner.pricing.surgeMultiplier}
												onChange={(e) =>
													setCurrentPartner({
														...currentPartner,
														pricing: {
															...currentPartner.pricing,
															surgeMultiplier: Number(e.target.value),
														},
													})
												}
												className="w-32"
											/>
											<div className="text-xs text-slate-500">
												<span className="font-bold text-slate-900">1.0</span> =
												Standard Price
												<br />
												<span className="font-bold text-slate-900">1.5</span> =
												50% Extra (Peak Hours)
											</div>
										</div>
									</div>
								</div>
							</TabsContent>
						</Tabs>
					</div>

					<DialogFooter className="p-6 pt-2 border-t bg-slate-50/50">
						<div className="flex w-full justify-between items-center">
							<Button variant="ghost" onClick={() => setIsModalOpen(false)}>
								Cancel
							</Button>
							<div className="flex gap-2">
								{modalTab !== "pricing" && (
									<Button
										variant="outline"
										onClick={() => {
											if (modalTab === "details") setModalTab("coverage");
											else if (modalTab === "coverage") setModalTab("pricing");
										}}
									>
										Next Step
									</Button>
								)}
								<Button
									onClick={handleSave}
									disabled={loading}
									className="bg-slate-900 text-white hover:bg-slate-800"
								>
									{partners.some((p) => p.id === currentPartner.id)
										? "Update Partner"
										: "Add Partner"}
								</Button>
							</div>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function PartnerCard({
	partner,
	onEdit,
}: {
	partner: LogisticsPartner;
	onEdit: () => void;
}) {
	return (
		<Card className="overflow-hidden hover:shadow-md transition-shadow group">
			<div className="flex flex-col md:flex-row">
				{/* Status Strip */}
				<div
					className={`w-full md:w-1.5 h-2 md:h-auto transition-colors ${partner.enabled ? "bg-green-500" : "bg-slate-300"}`}
				/>

				<div className="p-5 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
					{/* Main Info */}
					<div className="md:col-span-4 space-y-1">
						<div className="flex items-center gap-2">
							<h3 className="font-bold text-lg text-slate-900">
								{partner.name}
							</h3>
							{!partner.enabled && (
								<Badge
									variant="outline"
									className="text-xs h-5 px-1.5 text-slate-500"
								>
									Disabled
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 text-sm text-slate-500">
							<Badge
								variant="secondary"
								className="text-[10px] px-1.5 font-normal tracking-wide uppercase"
							>
								{partner.type.replace("_", " ")}
							</Badge>
							<span className="text-xs font-mono text-slate-400">
								#{partner.id}
							</span>
						</div>
					</div>

					{/* Pricing Snapshot */}
					<div className="md:col-span-3">
						<div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
							Pricing Model
						</div>
						<div className="text-sm font-medium text-slate-700">
							₹{partner.pricing.baseFee}{" "}
							<span className="text-slate-400 font-normal">base</span> + ₹
							{partner.pricing.perKm}
							<span className="text-slate-400 font-normal">/km</span>
						</div>
						{partner.pricing.minCartValue > 0 && (
							<div className="text-[10px] text-green-600 font-medium mt-0.5">
								Free over ₹{partner.pricing.minCartValue}
							</div>
						)}
					</div>

					{/* Regions / Categories */}
					<div className="md:col-span-3">
						<div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
							Coverage
						</div>
						<div className="flex flex-wrap gap-1">
							{partner.regions?.length > 0 ? (
								partner.regions.slice(0, 2).map((r) => (
									<span
										key={r}
										className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100"
									>
										{r}
									</span>
								))
							) : (
								<span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
									Global
								</span>
							)}
							{partner.regions?.length > 2 && (
								<span className="text-[10px] text-slate-400">
									+{partner.regions.length - 2}
								</span>
							)}
						</div>
					</div>

					{/* Action */}
					<div className="md:col-span-2 flex justify-end opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
						<Button
							variant="ghost"
							size="sm"
							onClick={onEdit}
							className="hover:bg-slate-100"
						>
							<Settings2 className="w-4 h-4 mr-2" /> Config
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}

function RuleSimulator({ partners }: { partners: LogisticsPartner[] }) {
	const [simState, setSimState] = useState({
		cartValue: 450,
		distance: 5.5,
		category: "Pet Food",
		city: "Bangalore",
	});

	const results = useMemo(() => {
		return partners
			.filter((p) => p.enabled)
			.filter(
				(p) =>
					p.categories.length === 0 || p.categories.includes(simState.category)
			)
			.filter(
				(p) =>
					p.regions.length === 0 ||
					p.regions.some((r) => r.toLowerCase() === simState.city.toLowerCase())
			)
			.map((p) => {
				let cost = p.pricing.baseFee + simState.distance * p.pricing.perKm;
				let isFree = false;

				if (
					p.pricing.minCartValue > 0 &&
					simState.cartValue >= p.pricing.minCartValue
				) {
					cost = 0;
					isFree = true;
				}

				cost = cost * (p.pricing.surgeMultiplier || 1);

				return {
					partner: p,
					cost: Math.round(cost),
					isFree,
				};
			})
			.sort((a, b) => a.cost - b.cost);
	}, [partners, simState]);

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<div className="lg:col-span-1">
				<Card className="h-fit sticky top-6 border-slate-200 shadow-sm">
					<CardHeader className="pb-4 border-b bg-slate-50/50">
						<CardTitle className="flex items-center gap-2 text-base">
							<div className="p-1.5 bg-white border rounded shadow-sm">
								<Calculator className="w-4 h-4 text-slate-600" />
							</div>
							Simulation Parameters
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-5 pt-6">
						<div className="space-y-2">
							<Label>Order Value (₹)</Label>
							<Input
								type="number"
								value={simState.cartValue}
								onChange={(e) =>
									setSimState({
										...simState,
										cartValue: Number(e.target.value),
									})
								}
							/>
						</div>
						<div className="space-y-2">
							<Label>Delivery Distance (km)</Label>
							<Input
								type="number"
								value={simState.distance}
								onChange={(e) =>
									setSimState({ ...simState, distance: Number(e.target.value) })
								}
							/>
						</div>
						<div className="space-y-2">
							<Label>Product Category</Label>
							<Select
								value={simState.category}
								onValueChange={(v) => setSimState({ ...simState, category: v })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PRODUCT_CATEGORIES.map((c) => (
										<SelectItem key={c} value={c}>
											{c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Target City</Label>
							<Input
								value={simState.city}
								onChange={(e) =>
									setSimState({ ...simState, city: e.target.value })
								}
								placeholder="City Name"
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="lg:col-span-2 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-lg text-slate-900">
							Quote Comparison
						</h3>
						<p className="text-sm text-slate-500">
							Real-time calculation based on active rules
						</p>
					</div>
					<Badge variant="outline" className="bg-white">
						{results.length} Eligible Partner{results.length !== 1 && "s"}
					</Badge>
				</div>

				{results.length === 0 ? (
					<div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
						<X className="w-8 h-8 text-red-300 mx-auto mb-3" />
						<h4 className="font-medium text-slate-900">No Routes Found</h4>
						<p className="text-sm text-slate-500 mt-1">
							Adjust your simulation parameters or check partner coverage.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{results.map(({ partner, cost, isFree }, index) => (
							<Card
								key={partner.id}
								className={`overflow-hidden transition-all ${index === 0 ? "ring-2 ring-green-500 shadow-md" : "hover:shadow-sm"}`}
							>
								{index === 0 && (
									<div className="bg-green-500 text-white text-[10px] font-bold px-3 py-1 text-center tracking-wider uppercase">
										Best Value Option
									</div>
								)}
								<div className="p-5 flex justify-between items-center">
									<div className="flex items-center gap-4">
										<div className="bg-slate-100 p-3 rounded-full">
											<Truck className="w-5 h-5 text-slate-700" />
										</div>
										<div>
											<h4 className="font-bold text-slate-900 text-lg">
												{partner.name}
											</h4>
											<div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
												<Badge
													variant="secondary"
													className="text-[10px] px-1.5 h-5"
												>
													{partner.type}
												</Badge>
												<span>
													₹{partner.pricing.baseFee} + ₹{partner.pricing.perKm}
													/km
												</span>
											</div>
										</div>
									</div>

									<div className="text-right">
										<div className="text-3xl font-bold text-slate-900">
											{isFree ? (
												<span className="text-green-600">₹0</span>
											) : (
												<span>₹{cost}</span>
											)}
										</div>
										{isFree ? (
											<div className="text-xs text-green-600 font-medium mt-1 flex items-center justify-end gap-1">
												<Check className="w-3 h-3" /> Free Delivery Applied
											</div>
										) : (
											<div className="text-xs text-slate-400 font-medium mt-1">
												Estimated Cost
											</div>
										)}
									</div>
								</div>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
