import { useState, useEffect } from "react";
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
	Button,
	Input,
	Label,
	Switch,
} from "@warmpawz/ui";
import {
	Plus,
	Truck,
	Key,
	Globe,
	MapPin,
	Package,
	AlertCircle,
	Check,
	X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { PolicyHelpButton } from "@/components/PolicyHelpButton";

type DeliveryType = "last_mile" | "intercity" | "pan_india" | "hyperlocal";

interface PricingRule {
	baseFee: number;
	perKm: number;
	minCartValue: number;
	surgeMultiplier: number;
}

interface LogisticsPartner {
	id: string;
	name: string;
	type: DeliveryType;
	enabled: boolean;
	apiEndpoint: string;
	apiKey: string;
	regions: string[];
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
	const [partners, setPartners] = useState<LogisticsPartner[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [currentPartner, setCurrentPartner] =
		useState<LogisticsPartner>(DEFAULT_PARTNER);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			const res = await apiClient.get<any>("/admin/integrations/logistics");
			if (res.success) {
				const migratedPartners = (res.partners || []).map((p: any) => ({
					...DEFAULT_PARTNER,
					...p,
					pricing: { ...DEFAULT_PARTNER.pricing, ...(p.pricing || {}) },
				}));
				setPartners(migratedPartners);
			}
		} catch (error) {
			console.error("Error loading logistics partners:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		if (!currentPartner.name || !currentPartner.id) {
			toast.error("Please fill in partner name and ID");
			return;
		}

		try {
			await apiClient.post<any>(
				"/admin/integrations/logistics",
				currentPartner
			);
			toast.success("Partner saved successfully");
			setIsModalOpen(false);
			loadData();
		} catch (error) {
			console.error("Error saving partner:", error);
			toast.error("Failed to save partner");
		}
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
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div>
						<h2 className="text-2xl font-bold">Logistics Partners</h2>
						<p className="text-gray-500">Manage delivery partners and configurations</p>
					</div>
					<PolicyHelpButton docKey="logistics-partners" />
				</div>
				<Button
					onClick={() => {
						setCurrentPartner({
							...DEFAULT_PARTNER,
							id: `partner_${Date.now()}`,
						});
						setIsModalOpen(true);
					}}
					className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
				>
					<Plus className="w-4 h-4 mr-2" />
					Add Partner
				</Button>
			</div>

			<div className="grid grid-cols-1 gap-4">
				{partners.map((p) => (
					<Card key={p.id} className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-semibold">{p.name}</h3>
								<p className="text-sm text-gray-500">{p.type}</p>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant={p.enabled ? "default" : "secondary"}>
									{p.enabled ? "Active" : "Inactive"}
								</Badge>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setCurrentPartner(p);
										setIsModalOpen(true);
									}}
								>
									Edit
								</Button>
							</div>
						</div>
					</Card>
				))}

				{partners.length === 0 && (
					<div className="text-center py-16 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
						<Truck className="w-8 h-8 text-slate-400 mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-slate-900">
							No Logistics Partners
						</h3>
						<p className="text-slate-500 max-w-sm mx-auto mt-2">
							Add your first delivery partner to start managing shipments.
						</p>
					</div>
				)}
			</div>

			{/* Add/Edit Modal */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{partners.some((p) => p.id === currentPartner.id)
								? "Edit Partner"
								: "New Logistics Partner"}
						</DialogTitle>
						<DialogDescription>
							Configure connectivity, service regions, and pricing models.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>Partner Name</Label>
								<Input
									value={currentPartner.name}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setCurrentPartner({
											...currentPartner,
											name: e.target.value,
										})
									}
									placeholder="e.g. Dunzo"
								/>
							</div>
							<div>
								<Label>Internal ID</Label>
								<Input
									value={currentPartner.id}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setCurrentPartner({
											...currentPartner,
											id: e.target.value,
										})
									}
									placeholder="dunzo_last_mile"
									disabled={partners.some(
										(p) => p.id === currentPartner.id && p !== DEFAULT_PARTNER
									)}
									className="font-mono text-sm"
								/>
							</div>
						</div>

						<div>
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

						<div className="space-y-2">
							<Label>API Endpoint</Label>
							<Input
								value={currentPartner.apiEndpoint}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setCurrentPartner({
										...currentPartner,
										apiEndpoint: e.target.value,
									})
								}
								placeholder="https://api.partner.com/v1"
								className="font-mono text-sm"
							/>
						</div>

						<div className="space-y-2">
							<Label>API Key</Label>
							<Input
								type="password"
								value={currentPartner.apiKey}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setCurrentPartner({
										...currentPartner,
										apiKey: e.target.value,
									})
								}
								className="font-mono text-sm"
								placeholder="••••••••••••••••"
							/>
						</div>

						<div className="space-y-2">
							<Label>Supported Categories</Label>
							<div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
								{PRODUCT_CATEGORIES.map((cat) => (
									<div
										key={cat}
										className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50"
									>
										<Checkbox
											id={cat}
											checked={currentPartner.categories?.includes(cat)}
											onCheckedChange={() => toggleCategory(cat)}
										/>
										<Label htmlFor={cat} className="text-sm cursor-pointer">
											{cat}
										</Label>
									</div>
								))}
							</div>
						</div>

						<div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
							<div>
								<Label>Partner Status</Label>
								<p className="text-xs text-gray-500">
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
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
							Save Partner
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

