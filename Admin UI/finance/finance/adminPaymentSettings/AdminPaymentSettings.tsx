import { useState, useEffect } from "react";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
	Separator,
	Switch,
	Label,
	Input,
	Button,
} from "@repo/ui";
import {
	CreditCard,
	RefreshCcw,
	Settings,
	Receipt,
	Calendar,
	Percent,
} from "lucide-react";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
import { PaymentRulesSection } from "../PaymentRulesSection/PaymentRulesSection";
import { RefundPoliciesSection } from "../RefundPoliciesSection/RefundPoliciesSection";
import { SettlementScheduleSettings } from "../SettlementScheduleSettings/SettlementScheduleSettings";
import { GSTRuleManagement } from "../GSTRuleManagement/GSTRuleManagement";

interface RefundRule {
	hours: number;
	refundPercent: number;
	description: string;
}

interface RefundConfig {
	enabled: boolean;
	schedule: RefundRule[];
	autoReconcile: boolean;
	reconcilePeriod: number;
}

export function AdminPaymentSettings() {
	const [activeTab, setActiveTab] = useState("general");
	const [refundConfig, setRefundConfig] = useState<RefundConfig>({
		enabled: true,
		schedule: [],
		autoReconcile: true,
		reconcilePeriod: 7,
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [razorpayConfig, setRazorpayConfig] = useState({
		keyId: "rzp_test_123456789",
		keySecret: "****************",
		webhookSecret: "****************",
		enabled: true,
	});

	const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

	useEffect(() => {
		loadRefundRules();
	}, []);

	const loadRefundRules = async () => {
		setLoading(true);
		try {
			const response = await fetch(`${API_BASE}/admin/payments/refund-rules`, {
				headers: { Authorization: `Bearer ${publicAnonKey}` },
			});

			if (response.ok) {
				const data = await response.json();
				setRefundConfig(
					data.rules || {
						enabled: true,
						schedule: [
							{
								hours: 48,
								refundPercent: 90,
								description: "Full refund > 48h",
							},
							{
								hours: 24,
								refundPercent: 50,
								description: "Partial refund 24-48h",
							},
							{ hours: 12, refundPercent: 0, description: "No refund < 12h" },
						],
						autoReconcile: true,
						reconcilePeriod: 7,
					}
				);
			}
		} catch (error) {
			console.error("Error loading rules:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSaveRules = async () => {
		setSaving(true);
		try {
			const response = await fetch(`${API_BASE}/admin/payments/refund-rules`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${publicAnonKey}`,
				},
				body: JSON.stringify(refundConfig),
			});

			if (response.ok) {
				toast.success("Refund rules updated successfully");
			} else {
				toast.error("Failed to update refund rules");
			}
		} catch (error) {
			toast.error("Error saving rules");
		} finally {
			setSaving(false);
		}
	};

	const updateRule = (index: number, field: keyof RefundRule, value: any) => {
		const newSchedule = [...refundConfig.schedule];
		newSchedule[index] = { ...newSchedule[index], [field]: value };
		setRefundConfig({ ...refundConfig, schedule: newSchedule });
	};

	return (
		<div className="space-y-6 w-full max-w-full">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-xl font-semibold text-slate-900">
						Payment & Refund Settings
					</h2>
					<p className="text-sm text-slate-500">
						Configure gateways, payment rules, and refund policies
					</p>
				</div>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-4"
			>
				<TabsList className="bg-white border border-gray-200 p-1">
					<TabsTrigger
						value="general"
						className="data-[state=active]:bg-[#FF8C42] data-[state=active]:text-white"
					>
						<Settings className="w-4 h-4 mr-2" />
						General & Gateway
					</TabsTrigger>
					<TabsTrigger
						value="settlement"
						className="data-[state=active]:bg-[#FF8C42] data-[state=active]:text-white"
					>
						<Calendar className="w-4 h-4 mr-2" />
						Settlement Schedule
					</TabsTrigger>
					<TabsTrigger
						value="gst-rules"
						className="data-[state=active]:bg-[#FF8C42] data-[state=active]:text-white"
					>
						<Percent className="w-4 h-4 mr-2" />
						GST Rules
					</TabsTrigger>
					<TabsTrigger
						value="payment-rules"
						className="data-[state=active]:bg-[#FF8C42] data-[state=active]:text-white"
					>
						<Receipt className="w-4 h-4 mr-2" />
						Payment Rules
					</TabsTrigger>
					<TabsTrigger
						value="refund-policies"
						className="data-[state=active]:bg-[#FF8C42] data-[state=active]:text-white"
					>
						<RefreshCcw className="w-4 h-4 mr-2" />
						Refund Policies
					</TabsTrigger>
				</TabsList>

				<TabsContent value="general">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full">
						{/* Gateway Configuration */}
						<Card className="w-full max-w-full">
							<CardHeader>
								<div className="flex items-center gap-2">
									<div className="p-2 bg-blue-100 rounded-lg">
										<CreditCard className="w-5 h-5 text-blue-600" />
									</div>
									<div>
										<CardTitle className="text-lg">
											Gateway Configuration
										</CardTitle>
										<CardDescription>
											Razorpay Marketplace Integration
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
									<div className="flex items-center gap-2">
										<div
											className={`w-2 h-2 rounded-full ${razorpayConfig.enabled ? "bg-green-500" : "bg-slate-300"}`}
										></div>
										<span className="font-medium">Status</span>
									</div>
									<div
										className={`px-2 py-1 rounded-full text-xs font-medium ${razorpayConfig.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
									>
										{razorpayConfig.enabled ? "Active" : "Disabled"}
									</div>
								</div>

								<div className="space-y-2">
									<Label>API Key ID</Label>
									<Input
										value={razorpayConfig.keyId}
										readOnly
										className="bg-slate-50 font-mono"
									/>
								</div>

								<div className="space-y-2">
									<Label>Key Secret</Label>
									<Input
										type="password"
										value={razorpayConfig.keySecret}
										readOnly
										className="bg-slate-50 font-mono"
									/>
								</div>

								<div className="space-y-2">
									<Label>Webhook Secret</Label>
									<Input
										type="password"
										value={razorpayConfig.webhookSecret}
										readOnly
										className="bg-slate-50 font-mono"
									/>
								</div>

								<div className="pt-2">
									<Button
										variant="outline"
										className="w-full"
										onClick={() =>
											toast.info(
												"Gateway configuration is managed via Environment Variables"
											)
										}
									>
										Edit Configuration
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Global Refund Settings */}
						<Card className="w-full max-w-full">
							<CardHeader>
								<div className="flex items-center gap-2">
									<div className="p-2 bg-orange-100 rounded-lg">
										<RefreshCcw className="w-5 h-5 text-orange-600" />
									</div>
									<div>
										<CardTitle className="text-lg">
											Global Refund Settings
										</CardTitle>
										<CardDescription>
											Automated processing & reconciliation
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label>Enable Automated Refunds</Label>
										<p className="text-xs text-slate-500">
											Process refunds based on cancellation time
										</p>
									</div>
									<Switch
										checked={refundConfig.enabled}
										onCheckedChange={(c) =>
											setRefundConfig({ ...refundConfig, enabled: c })
										}
									/>
								</div>

								<Separator />

								<div className="flex items-center justify-between pt-2">
									<div className="space-y-0.5">
										<Label>Auto Reconciliation</Label>
										<p className="text-xs text-slate-500">
											Reconcile payments every {refundConfig.reconcilePeriod}{" "}
											days
										</p>
									</div>
									<Switch
										checked={refundConfig.autoReconcile}
										onCheckedChange={(c) =>
											setRefundConfig({ ...refundConfig, autoReconcile: c })
										}
									/>
								</div>

								<div className="pt-4">
									<Button
										onClick={handleSaveRules}
										disabled={saving || loading}
										className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
									>
										{saving ? "Saving..." : "Save Global Settings"}
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="settlement">
					<SettlementScheduleSettings />
				</TabsContent>

				<TabsContent value="gst-rules">
					<GSTRuleManagement />
				</TabsContent>

				<TabsContent value="payment-rules">
					<PaymentRulesSection />
				</TabsContent>

				<TabsContent value="refund-policies">
					<RefundPoliciesSection />
				</TabsContent>
			</Tabs>
		</div>
	);
}
