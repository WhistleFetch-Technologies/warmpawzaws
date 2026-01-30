import { useState, useEffect } from "react";
// import { ScrollArea } from "../../ui/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Separator,
	Switch,
	Checkbox,
	Badge,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Label,
	Input,
	Button,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
} from "@repo/ui";
import {
	Plus,
	Edit2,
	Trash2,
	ArrowRight,
	Package,
	MapPin,
	Zap,
	DollarSign,
	AlertCircle,
	Play,
} from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";

interface DeliveryRule {
	id: string;
	name: string;
	priority: number;
	enabled: boolean;
	conditions: {
		orderType?: string[];
		productCategories?: string[];
		deliveryType?: string[];
		regions?: string[];
		weightRange?: { min: number; max: number };
		valueRange?: { min: number; max: number };
		paymentMethod?: string[];
		urgency?: string[];
		distanceRange?: { min: number; max: number };
	};
	logistics: {
		primaryPartner: string;
		fallbackPartners: string[];
		courierPreference?: string[];
	};
}

const DEFAULT_RULE: DeliveryRule = {
	id: "",
	name: "",
	priority: 100,
	enabled: true,
	conditions: {},
	logistics: {
		primaryPartner: "",
		fallbackPartners: [],
	},
};

const ORDER_TYPES = ["food", "subscription", "ecommerce", "pharmacy", "fresh"];
const PRODUCT_CATEGORIES = [
	"Pet Food",
	"Medicines",
	"Restaurant Food",
	"Pet Clothes",
	"Accessories",
	"Grooming Supplies",
	"Toys",
];
const DELIVERY_TYPES = ["hyperlocal", "intracity", "intercity", "pan_india"];
const PAYMENT_METHODS = ["cod", "prepaid"];
const URGENCY_LEVELS = ["instant", "same_day", "standard", "economy"];
const LOGISTICS_PARTNERS = [
	{ id: "shiprocket", name: "Shiprocket", types: ["pan_india", "intercity"] },
	{
		id: "delhivery",
		name: "Delhivery",
		types: ["pan_india", "intercity", "cod"],
	},
	{
		id: "hyperlocal_partner",
		name: "Hyperlocal Partner (Future)",
		types: ["hyperlocal", "intracity"],
	},
];

export function DeliveryRulesManager() {
	const [rules, setRules] = useState<DeliveryRule[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [currentRule, setCurrentRule] = useState<DeliveryRule>(DEFAULT_RULE);
	const [loading, setLoading] = useState(false);
	const [testMode, setTestMode] = useState(false);
	const [testOrder, setTestOrder] = useState<any>({
		orderType: "ecommerce",
		productCategories: ["Pet Food"],
		totalAmount: 500,
		totalWeight: 1,
		paymentMethod: "prepaid",
		urgency: "standard",
	});
	const [testResult, setTestResult] = useState<any>(null);

	useEffect(() => {
		loadRules();
	}, []);

	const loadRules = async () => {
		try {
			const response = await fetch(
				`${getApiBaseUrl()}/logistics/delivery-rules`,
				{
					headers: { ...getAuthHeaders() },
				}
			);
			const data = await response.json();
			if (data.success) {
				setRules(data.rules || []);
			}
		} catch (error) {
			console.error("Error loading delivery rules:", error);
		}
	};

	const saveRules = async () => {
		try {
			setLoading(true);
			const response = await fetch(
				`${getApiBaseUrl()}/logistics/delivery-rules`,
				{
					method: "POST",
					headers: {
						...getAuthHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify(rules),
				}
			);
			const data = await response.json();
			if (data.success) {
				toast.success("Delivery rules saved successfully");
			}
		} catch (error) {
			console.error("Error saving delivery rules:", error);
			toast.error("Failed to save delivery rules");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveRule = () => {
		if (!currentRule.name || !currentRule.logistics.primaryPartner) {
			toast.error("Please fill in rule name and primary partner");
			return;
		}

		const newRules = rules.some((r) => r.id === currentRule.id)
			? rules.map((r) => (r.id === currentRule.id ? currentRule : r))
			: [...rules, currentRule];

		setRules(newRules);
		setIsModalOpen(false);
		setCurrentRule(DEFAULT_RULE);
	};

	const handleDeleteRule = (ruleId: string) => {
		setRules(rules.filter((r) => r.id !== ruleId));
	};

	const testRouting = async () => {
		try {
			setLoading(true);
			const response = await fetch(
				`${getApiBaseUrl()}/logistics/test-routing`,
				{
					method: "POST",
					headers: {
						...getAuthHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						orderId: "TEST_" + Date.now(),
						...testOrder,
						pickupAddress: {
							city: "Bangalore",
							state: "Karnataka",
							pincode: "560001",
						},
						deliveryAddress: {
							city: "Mumbai",
							state: "Maharashtra",
							pincode: "400001",
						},
					}),
				}
			);
			const data = await response.json();
			if (data.success) {
				setTestResult(data);
				toast.success("Routing test completed");
			}
		} catch (error) {
			console.error("Error testing routing:", error);
			toast.error("Routing test failed");
		} finally {
			setLoading(false);
		}
	};

	const toggleCondition = (field: string, value: string) => {
		const current =
			(currentRule.conditions[
				field as keyof typeof currentRule.conditions
			] as string[]) || [];
		if (current.includes(value)) {
			setCurrentRule({
				...currentRule,
				conditions: {
					...currentRule.conditions,
					[field]: current.filter((v) => v !== value),
				},
			});
		} else {
			setCurrentRule({
				...currentRule,
				conditions: {
					...currentRule.conditions,
					[field]: [...current, value],
				},
			});
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-semibold">Delivery Routing Rules</h2>
					<p className="text-sm text-muted-foreground">
						Configure automatic partner selection based on order criteria
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => setTestMode(!testMode)}
						className={testMode ? "bg-blue-50 border-blue-200" : ""}
					>
						<Play className="w-4 h-4 mr-2" />
						Test Routing
					</Button>
					<Button
						onClick={() => {
							setCurrentRule({ ...DEFAULT_RULE, id: `rule_${Date.now()}` });
							setIsModalOpen(true);
						}}
					>
						<Plus className="w-4 h-4 mr-2" />
						Add Rule
					</Button>
					<Button
						onClick={saveRules}
						disabled={loading}
						className="bg-green-600 hover:bg-green-700"
					>
						Save All Rules
					</Button>
				</div>
			</div>

			{testMode && (
				<Card className="border-blue-200 bg-blue-50/50">
					<CardHeader>
						<CardTitle className="text-lg flex items-center gap-2">
							<Play className="w-5 h-5 text-blue-600" />
							Test Order Routing
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-3 gap-4">
							<div className="space-y-2">
								<Label>Order Type</Label>
								<Select
									value={testOrder.orderType}
									onValueChange={(v) =>
										setTestOrder({ ...testOrder, orderType: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ORDER_TYPES.map((t) => (
											<SelectItem key={t} value={t}>
												{t}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Payment Method</Label>
								<Select
									value={testOrder.paymentMethod}
									onValueChange={(v) =>
										setTestOrder({ ...testOrder, paymentMethod: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{PAYMENT_METHODS.map((m) => (
											<SelectItem key={m} value={m}>
												{m.toUpperCase()}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Total Amount (₹)</Label>
								<Input
									type="number"
									value={testOrder.totalAmount}
									onChange={(e) =>
										setTestOrder({
											...testOrder,
											totalAmount: Number(e.target.value),
										})
									}
								/>
							</div>
						</div>
						<Button onClick={testRouting} disabled={loading} className="w-full">
							Run Test
						</Button>
						{testResult && (
							<div className="bg-white rounded-lg p-4 border">
								<h3 className="font-semibold mb-2">Test Result</h3>
								<div className="space-y-2 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">
											Selected Partner:
										</span>
										<Badge>{testResult.selectedPartner?.partner}</Badge>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">
											Delivery Type:
										</span>
										<Badge variant="outline">
											{testResult.selectedPartner?.deliveryType}
										</Badge>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<div className="space-y-3">
				{rules
					.sort((a, b) => a.priority - b.priority)
					.map((rule) => (
						<Card
							key={rule.id}
							className={`${!rule.enabled ? "opacity-60" : ""}`}
						>
							<CardContent className="p-5">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-3">
											<div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg">
												<span className="text-orange-600 font-bold">
													{rule.priority}
												</span>
											</div>
											<div>
												<h3 className="font-semibold text-lg">{rule.name}</h3>
												<p className="text-sm text-muted-foreground">
													Routes to{" "}
													{
														LOGISTICS_PARTNERS.find(
															(p) => p.id === rule.logistics.primaryPartner
														)?.name
													}
												</p>
											</div>
											{!rule.enabled && (
												<Badge variant="outline">Disabled</Badge>
											)}
										</div>

										<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
											{rule.conditions.orderType &&
												rule.conditions.orderType.length > 0 && (
													<div>
														<div className="text-xs text-muted-foreground mb-1">
															Order Types
														</div>
														<div className="flex flex-wrap gap-1">
															{rule.conditions.orderType.map((t) => (
																<Badge
																	key={t}
																	variant="secondary"
																	className="text-xs"
																>
																	{t}
																</Badge>
															))}
														</div>
													</div>
												)}
											{rule.conditions.deliveryType &&
												rule.conditions.deliveryType.length > 0 && (
													<div>
														<div className="text-xs text-muted-foreground mb-1">
															Delivery Types
														</div>
														<div className="flex flex-wrap gap-1">
															{rule.conditions.deliveryType.map((t) => (
																<Badge
																	key={t}
																	variant="secondary"
																	className="text-xs"
																>
																	{t}
																</Badge>
															))}
														</div>
													</div>
												)}
											{rule.conditions.paymentMethod &&
												rule.conditions.paymentMethod.length > 0 && (
													<div>
														<div className="text-xs text-muted-foreground mb-1">
															Payment
														</div>
														<div className="flex flex-wrap gap-1">
															{rule.conditions.paymentMethod.map((m) => (
																<Badge
																	key={m}
																	variant="secondary"
																	className="text-xs"
																>
																	{m.toUpperCase()}
																</Badge>
															))}
														</div>
													</div>
												)}
											{rule.conditions.regions &&
												rule.conditions.regions.length > 0 && (
													<div>
														<div className="text-xs text-muted-foreground mb-1">
															Regions
														</div>
														<div className="flex flex-wrap gap-1">
															{rule.conditions.regions.slice(0, 2).map((r) => (
																<Badge
																	key={r}
																	variant="secondary"
																	className="text-xs"
																>
																	{r}
																</Badge>
															))}
															{rule.conditions.regions.length > 2 && (
																<Badge variant="secondary" className="text-xs">
																	+{rule.conditions.regions.length - 2}
																</Badge>
															)}
														</div>
													</div>
												)}
										</div>
									</div>

									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setCurrentRule(rule);
												setIsModalOpen(true);
											}}
										>
											<Edit2 className="w-4 h-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleDeleteRule(rule.id)}
											className="text-red-600 hover:bg-red-50"
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}

				{rules.length === 0 && (
					<Card className="border-dashed">
						<CardContent className="p-12 text-center">
							<Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
							<h3 className="font-semibold mb-2">No Delivery Rules</h3>
							<p className="text-sm text-muted-foreground mb-4">
								Create rules to automatically route orders to the right
								logistics partner
							</p>
							<Button
								onClick={() => {
									setCurrentRule({ ...DEFAULT_RULE, id: `rule_${Date.now()}` });
									setIsModalOpen(true);
								}}
							>
								<Plus className="w-4 h-4 mr-2" />
								Create First Rule
							</Button>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Rule Editor Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{rules.some((r) => r.id === currentRule.id)
								? "Edit Delivery Rule"
								: "Create Delivery Rule"}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-6">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Rule Name *</Label>
								<Input
									value={currentRule.name}
									onChange={(e) =>
										setCurrentRule({ ...currentRule, name: e.target.value })
									}
									placeholder="e.g. COD Orders via Delhivery"
								/>
							</div>
							<div className="space-y-2">
								<Label>Priority (Lower = Higher Priority)</Label>
								<Input
									type="number"
									value={currentRule.priority}
									onChange={(e) =>
										setCurrentRule({
											...currentRule,
											priority: Number(e.target.value),
										})
									}
								/>
							</div>
						</div>

						<Separator />

						<div>
							<h3 className="font-semibold mb-4 flex items-center gap-2">
								<Zap className="w-4 h-4" />
								Rule Conditions
							</h3>

							<Tabs defaultValue="orderType" className="w-full">
								<TabsList className="grid w-full grid-cols-4">
									<TabsTrigger value="orderType">Order Types</TabsTrigger>
									<TabsTrigger value="delivery">Delivery</TabsTrigger>
									<TabsTrigger value="payment">Payment</TabsTrigger>
									<TabsTrigger value="ranges">Ranges</TabsTrigger>
								</TabsList>

								<TabsContent value="orderType" className="space-y-3 mt-4">
									{ORDER_TYPES.map((type) => (
										<div key={type} className="flex items-center space-x-2">
											<Checkbox
												id={`order-${type}`}
												checked={currentRule.conditions.orderType?.includes(
													type
												)}
												onCheckedChange={() =>
													toggleCondition("orderType", type)
												}
											/>
											<label
												htmlFor={`order-${type}`}
												className="text-sm font-medium capitalize cursor-pointer"
											>
												{type}
											</label>
										</div>
									))}
								</TabsContent>

								<TabsContent value="delivery" className="space-y-3 mt-4">
									{DELIVERY_TYPES.map((type) => (
										<div key={type} className="flex items-center space-x-2">
											<Checkbox
												id={`delivery-${type}`}
												checked={currentRule.conditions.deliveryType?.includes(
													type
												)}
												onCheckedChange={() =>
													toggleCondition("deliveryType", type)
												}
											/>
											<label
												htmlFor={`delivery-${type}`}
												className="text-sm font-medium capitalize cursor-pointer"
											>
												{type.replace("_", " ")}
											</label>
										</div>
									))}
								</TabsContent>

								<TabsContent value="payment" className="space-y-3 mt-4">
									{PAYMENT_METHODS.map((method) => (
										<div key={method} className="flex items-center space-x-2">
											<Checkbox
												id={`payment-${method}`}
												checked={currentRule.conditions.paymentMethod?.includes(
													method
												)}
												onCheckedChange={() =>
													toggleCondition("paymentMethod", method)
												}
											/>
											<label
												htmlFor={`payment-${method}`}
												className="text-sm font-medium uppercase cursor-pointer"
											>
												{method}
											</label>
										</div>
									))}
								</TabsContent>

								<TabsContent value="ranges" className="space-y-4 mt-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Min Weight (kg)</Label>
											<Input
												type="number"
												step="0.1"
												value={currentRule.conditions.weightRange?.min || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														conditions: {
															...currentRule.conditions,
															weightRange: {
																min: Number(e.target.value),
																max:
																	currentRule.conditions.weightRange?.max ||
																	1000,
															},
														},
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Max Weight (kg)</Label>
											<Input
												type="number"
												step="0.1"
												value={currentRule.conditions.weightRange?.max || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														conditions: {
															...currentRule.conditions,
															weightRange: {
																min:
																	currentRule.conditions.weightRange?.min || 0,
																max: Number(e.target.value),
															},
														},
													})
												}
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Min Order Value (₹)</Label>
											<Input
												type="number"
												value={currentRule.conditions.valueRange?.min || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														conditions: {
															...currentRule.conditions,
															valueRange: {
																min: Number(e.target.value),
																max:
																	currentRule.conditions.valueRange?.max ||
																	100000,
															},
														},
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Max Order Value (₹)</Label>
											<Input
												type="number"
												value={currentRule.conditions.valueRange?.max || ""}
												onChange={(e) =>
													setCurrentRule({
														...currentRule,
														conditions: {
															...currentRule.conditions,
															valueRange: {
																min:
																	currentRule.conditions.valueRange?.min || 0,
																max: Number(e.target.value),
															},
														},
													})
												}
											/>
										</div>
									</div>
								</TabsContent>
							</Tabs>
						</div>

						<Separator />

						<div>
							<h3 className="font-semibold mb-4 flex items-center gap-2">
								<MapPin className="w-4 h-4" />
								Logistics Partner
							</h3>

							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Primary Partner *</Label>
									<Select
										value={currentRule.logistics.primaryPartner}
										onValueChange={(v) =>
											setCurrentRule({
												...currentRule,
												logistics: {
													...currentRule.logistics,
													primaryPartner: v,
												},
											})
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select partner" />
										</SelectTrigger>
										<SelectContent>
											{LOGISTICS_PARTNERS.map((p) => (
												<SelectItem key={p.id} value={p.id}>
													{p.name}
													<span className="text-xs text-muted-foreground ml-2">
														({p.types.join(", ")})
													</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center space-x-2">
									<Switch
										checked={currentRule.enabled}
										onCheckedChange={(c) =>
											setCurrentRule({ ...currentRule, enabled: c })
										}
									/>
									<Label>Rule Enabled</Label>
								</div>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveRule}>
							{rules.some((r) => r.id === currentRule.id)
								? "Update Rule"
								: "Create Rule"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
