import { useState, useEffect } from "react";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
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
} from "@warmpawz/ui";
import {
	Plus,
	Edit2,
	Trash2,
	Package,
	MapPin,
	Zap,
	IndianRupee,
	AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { PolicyHelpButton } from "@/components/PolicyHelpButton";

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

export function DeliveryRulesManager() {
	const [rules, setRules] = useState<DeliveryRule[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [currentRule, setCurrentRule] = useState<DeliveryRule>(DEFAULT_RULE);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		loadRules();
	}, []);

	const loadRules = async () => {
		try {
			setLoading(true);
			const res = await apiClient.get<any>("/logistics/delivery-rules");
			if (res.success) {
				setRules(res.rules || []);
			}
		} catch (error) {
			console.error("Error loading delivery rules:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSaveRule = async () => {
		if (!currentRule.name || !currentRule.logistics.primaryPartner) {
			toast.error("Please fill in rule name and primary partner");
			return;
		}

		try {
			const newRules = rules.some((r) => r.id === currentRule.id)
				? rules.map((r) => (r.id === currentRule.id ? currentRule : r))
				: [...rules, { ...currentRule, id: currentRule.id || `rule_${Date.now()}` }];

			await apiClient.post<any>("/logistics/delivery-rules", { rules: newRules });
			toast.success("Delivery rule saved successfully");
			setRules(newRules);
			setIsModalOpen(false);
			setCurrentRule(DEFAULT_RULE);
		} catch (error) {
			console.error("Error saving rule:", error);
			toast.error("Failed to save delivery rule");
		}
	};

	const handleDeleteRule = async (ruleId: string) => {
		try {
			const newRules = rules.filter((r) => r.id !== ruleId);
			await apiClient.post<any>("/logistics/delivery-rules", { rules: newRules });
			setRules(newRules);
			toast.success("Rule deleted");
		} catch (error) {
			console.error("Error deleting rule:", error);
			toast.error("Failed to delete rule");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div>
						<h2 className="text-2xl font-bold">Delivery Rules</h2>
						<p className="text-gray-500">
							Configure automatic partner selection based on order conditions
						</p>
					</div>
					<PolicyHelpButton docKey="logistics-delivery-rules" />
				</div>
				<Button
					onClick={() => {
						setCurrentRule({ ...DEFAULT_RULE, id: `rule_${Date.now()}` });
						setIsModalOpen(true);
					}}
					className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
				>
					<Plus className="w-4 h-4 mr-2" />
					Create Rule
				</Button>
			</div>

			<div className="space-y-4">
				{rules.map((rule) => (
					<Card key={rule.id} className="p-4">
						<div className="flex items-center justify-between">
							<div className="flex-1">
								<div className="flex items-center gap-2 mb-2">
									<h3 className="font-semibold">{rule.name}</h3>
									<Badge variant="outline">Priority: {rule.priority}</Badge>
									<Badge variant={rule.enabled ? "default" : "secondary"}>
										{rule.enabled ? "Active" : "Inactive"}
									</Badge>
								</div>
								<p className="text-sm text-gray-500">
									Primary Partner: {rule.logistics.primaryPartner || "Not set"}
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setCurrentRule(rule);
										setIsModalOpen(true);
									}}
								>
									<Edit2 className="w-4 h-4" />
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleDeleteRule(rule.id)}
									className="text-red-600"
								>
									<Trash2 className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</Card>
				))}

				{rules.length === 0 && (
					<div className="text-center py-16 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
						<Package className="w-8 h-8 text-slate-400 mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-slate-900">
							No Delivery Rules
						</h3>
						<p className="text-slate-500 max-w-sm mx-auto mt-2">
							Create rules to automatically select logistics partners based on order
							conditions.
						</p>
					</div>
				)}
			</div>

			{/* Create/Edit Rule Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{rules.some((r) => r.id === currentRule.id)
								? "Edit Delivery Rule"
								: "Create Delivery Rule"}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div>
							<Label>Rule Name</Label>
							<Input
								value={currentRule.name}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setCurrentRule({ ...currentRule, name: e.target.value })
								}
								placeholder="e.g. Hyperlocal Food Delivery"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Priority</Label>
								<Input
									type="number"
									value={currentRule.priority}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setCurrentRule({
											...currentRule,
											priority: parseInt(e.target.value),
										})
									}
								/>
							</div>
							<div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
								<Label>Enabled</Label>
								<Switch
									checked={currentRule.enabled}
									onCheckedChange={(c) =>
										setCurrentRule({ ...currentRule, enabled: c })
									}
								/>
							</div>
						</div>

						<div>
							<Label>Primary Partner</Label>
							<Input
								value={currentRule.logistics.primaryPartner}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setCurrentRule({
										...currentRule,
										logistics: {
											...currentRule.logistics,
											primaryPartner: e.target.value,
										},
									})
								}
								placeholder="Partner ID"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsModalOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveRule}
							className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
						>
							Save Rule
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

