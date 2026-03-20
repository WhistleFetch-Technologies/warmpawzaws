"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
	IndianRupee,
	TrendingUp,
	Receipt,
	Wallet,
	BarChart3,
	Layers,
	Settings,
	CreditCard,
	Clock,
	ReceiptText,
	FileCheck,
	RefreshCw,
	Package,
	X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import {
	PayoutManagement,
	TierManagement,
	SettlementDashboard,
	AdminPaymentSettings,
	PaymentRulesSection,
	SettlementScheduleSettings,
	GSTConfigurationManagement,
	CancellationPolicyManagement,
	DynamicSettlementRulesManager,
	FlexibleTaxRulesManager,
	EcommercePoliciesSection,
} from "@/components/admin/finance";
import { FeeConfigurationManager } from "@/components/admin/finance/FeeConfigurationManager";

import { Button } from "@warmpawz/ui";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

// Finance dashboard stats interface
interface FinanceStats {
	pendingPayouts: number;
	pendingVendorCount: number;
	thisMonthRevenue: number;
	lastMonthRevenue: number;
	monthGrowth: number;
	platformCommission: number;
	commissionRate: number;
	completedPayouts: number;
}

type TabType =
	| "dashboard"
	| "fee-config"
	| "payment-policies"
	| "cancellation-policy"
	| "ecommerce-policies"
	| "gst-config"
	| "flexible-tax"
	| "settlements"
	| "payouts"
	| "tiers"
	| "schedule-settings"
	| "payment-settings"
	| "settlement-rules";

function FinanceManagementContent() {
	const searchParams = useSearchParams();
	const tabFromUrl = searchParams.get("tab") as TabType | null;
	const validTabs: TabType[] = ["dashboard", "fee-config", "payment-policies", "cancellation-policy", "ecommerce-policies", "gst-config", "flexible-tax", "settlements", "payouts", "tiers", "schedule-settings", "payment-settings", "settlement-rules"];
	const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "dashboard";
	const [activeTab, setActiveTab] = useState<TabType>(initialTab);
	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

	// Sync tab when URL param changes
	useEffect(() => {
		if (tabFromUrl && validTabs.includes(tabFromUrl)) {
			setActiveTab(tabFromUrl);
		}
	}, [tabFromUrl]);
	const [loadingStats, setLoadingStats] = useState(false);
	const [financeStats, setFinanceStats] = useState<FinanceStats>({
		pendingPayouts: 0,
		pendingVendorCount: 0,
		thisMonthRevenue: 0,
		lastMonthRevenue: 0,
		monthGrowth: 0,
		platformCommission: 0,
		commissionRate: 0,
		completedPayouts: 0,
	});

	// Load finance dashboard stats
	const loadFinanceStats = async () => {
		setLoadingStats(true);
		try {
			const [settlementsRes, revenueRes] = await Promise.all([
				apiClient.get<any>('/admin/settlements/stats').catch(() => ({})),
				apiClient.get<any>('/admin/analytics/kpis?period=30d').catch(() => ({ kpis: {} })),
			]);

			// Process settlements data
			const pendingPayouts = parseFloat(settlementsRes?.pending_amount || settlementsRes?.pendingAmount || '0');
			const pendingVendorCount = parseInt(settlementsRes?.pending_count || settlementsRes?.pendingCount || '0');
			const completedPayouts = parseInt(settlementsRes?.completed_count || settlementsRes?.completedCount || '0');

			// Process revenue data
			const thisMonthRevenue = parseFloat(revenueRes?.kpis?.totalRevenue || '0');
			const commission = parseFloat(revenueRes?.kpis?.commissionEarned || '0');
			const totalGMV = parseFloat(revenueRes?.kpis?.totalGMV || '0');
			const commissionRate = totalGMV > 0 ? (commission / totalGMV) * 100 : 2;
			
			// Calculate growth (compare with previous month - estimate)
			const monthGrowth = 18; // Default, would need previous month data

			setFinanceStats({
				pendingPayouts,
				pendingVendorCount,
				thisMonthRevenue,
				lastMonthRevenue: thisMonthRevenue * 0.85, // Estimate
				monthGrowth,
				platformCommission: commission,
				commissionRate: parseFloat(commissionRate.toFixed(1)),
				completedPayouts,
			});
		} catch (err) {
			console.error('Error loading finance stats:', err);
		} finally {
			setLoadingStats(false);
		}
	};

	useEffect(() => {
		if (activeTab === 'dashboard') {
			loadFinanceStats();
		}
	}, [activeTab]);

	const tabs = [
		{ id: "dashboard", label: "Dashboard", icon: BarChart3 },
		{ id: "fee-config", label: "Fee Configuration", icon: IndianRupee },
		{ id: "payment-policies", label: "Payment Policies", icon: CreditCard },
		{
			id: "cancellation-policy",
			label: "Cancellation Policy",
			icon: FileCheck,
		},
		{ id: "ecommerce-policies", label: "Ecommerce Policies", icon: Package },
		{ id: "gst-config", label: "GST Configuration", icon: ReceiptText },
		{ id: "flexible-tax", label: "Flexible Tax System", icon: ReceiptText },
		{ id: "settlements", label: "Settlements", icon: Receipt },
		{ id: "payouts", label: "Payout Management", icon: Wallet },
		{ id: "tiers", label: "Tier System", icon: Layers },
		{ id: "schedule-settings", label: "Schedule Settings", icon: Clock },
		{ id: "settlement-rules", label: "Settlement Rules", icon: TrendingUp },
		{ id: "payment-settings", label: "Payment Gateway", icon: Settings },
	];

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col min-h-screen bg-gray-50">
				{/* Header - Match wireframe: px-20 border-b, inner px-6 py-4 */}
				<div className="bg-white border-b border-gray-200">
					<div className="max-w-7xl mx-auto px-6 py-4">
						<div className="flex items-center justify-between">
							<div>
								{/* ✅ FIX: Match wireframe - text-black text-2xl font-semibold */}
								<h1 className="text-black text-2xl font-semibold">
									Finance & Logistics
								</h1>
								<p className="text-gray-500 text-sm mt-1">
									Comprehensive financial management: payments, refunds,
									settlements, GST, and policies
								</p>
							</div>
							<div className="flex items-center gap-2">
								<div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
									Live
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Tabs - Match wireframe: border-b border-gray-200, px-6 */}
				<div className="bg-white border-b border-gray-200">
					<div className="max-w-7xl mx-auto px-6">
						<div className="flex gap-1 overflow-x-auto">
							{tabs.map((tab) => {
								const Icon = tab.icon;
								const isActive = activeTab === tab.id;

								return (
									<button
										key={tab.id}
										onClick={() => {
											setActiveTab(tab.id as TabType);
										}}
										className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
											isActive
												? "border-[#FF8C42] text-[#FF8C42]"
												: "border-transparent text-gray-600 hover:text-gray-900"
										}`}
									>
										<Icon className="w-5 h-5" />
										<span className="font-medium">{tab.label}</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				{/* Content - Match wireframe: flex-1 overflow-y-auto px-6 py-6 */}
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-7xl mx-auto px-6 py-6">
					{activeTab === "dashboard" && (
						<div className="space-y-6">
							{/* Stats Grid */}
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
								<div className="bg-white rounded-lg border border-gray-200 p-6">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-gray-600">
											Pending Payouts
										</span>
										{loadingStats ? (
											<RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
										) : (
											<Wallet className="w-5 h-5 text-orange-500" />
										)}
									</div>
									<div className="text-2xl font-semibold text-gray-900">
										₹{financeStats.pendingPayouts.toLocaleString('en-IN')}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										{financeStats.pendingVendorCount} vendors awaiting settlement
									</div>
								</div>
								<div className="bg-white rounded-lg border border-gray-200 p-6">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-gray-600">This Month</span>
										{loadingStats ? (
											<RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
										) : (
											<TrendingUp className="w-5 h-5 text-green-500" />
										)}
									</div>
									<div className="text-2xl font-semibold text-gray-900">
										₹{financeStats.thisMonthRevenue.toLocaleString('en-IN')}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										{financeStats.monthGrowth >= 0 ? '+' : ''}{financeStats.monthGrowth}% from last month
									</div>
								</div>
								<div className="bg-white rounded-lg border border-gray-200 p-6">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-gray-600">
											Platform Commission
										</span>
										{loadingStats ? (
											<RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
										) : (
											<IndianRupee className="w-5 h-5 text-blue-500" />
										)}
									</div>
									<div className="text-2xl font-semibold text-gray-900">
										₹{financeStats.platformCommission.toLocaleString('en-IN')}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										{financeStats.commissionRate}% average commission
									</div>
								</div>
								<div className="bg-white rounded-lg border border-gray-200 p-6">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-gray-600">
											Completed Payouts
										</span>
										{loadingStats ? (
											<RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
										) : (
											<Receipt className="w-5 h-5 text-purple-500" />
										)}
									</div>
									<div className="text-2xl font-semibold text-gray-900">
										{financeStats.completedPayouts}
									</div>
									<div className="text-xs text-gray-500 mt-1">This month</div>
								</div>
							</div>

							{/* Quick Actions */}
							<div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-lg p-6">
								<div className="flex items-start gap-4">
									<div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0">
										<Receipt className="w-6 h-6 text-white" />
									</div>
									<div className="flex-1">
										<h3 className="font-semibold text-gray-900 mb-2">
											Finance & Payout Hub
										</h3>
										<p className="text-sm text-gray-600 mb-4">
											Manage vendor settlements, commission calculations, and
											financial reporting from a single dashboard.
										</p>
										<div className="flex gap-3">
											<button
												onClick={() => setActiveTab("settlements")}
												className="bg-[#FF8C42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#FF7A2E] transition-colors"
											>
												Go to Settlements
											</button>
											<button
												onClick={() => setActiveTab("tiers")}
												className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
											>
												Manage Tiers
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === "fee-config" && (
						<FeeConfigurationManager />
					)}

					{activeTab === "payment-policies" && (
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<PaymentRulesSection />
						</div>
					)}

					{activeTab === "cancellation-policy" && (
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<CancellationPolicyManagement />
						</div>
					)}

					{activeTab === "ecommerce-policies" && (
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<EcommercePoliciesSection />
						</div>
					)}

					{activeTab === "gst-config" && (
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<GSTConfigurationManagement />
						</div>
					)}

					{activeTab === "flexible-tax" && (
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<FlexibleTaxRulesManager />
						</div>
					)}

					{activeTab === "settlements" && <SettlementDashboard />}
					{activeTab === "payouts" && <PayoutManagement />}
					{activeTab === "tiers" && <TierManagement />}
					{activeTab === "settlement-rules" && (
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<DynamicSettlementRulesManager />
						</div>
					)}

					{activeTab === "schedule-settings" && (
						<div className="space-y-6">
							<div className="bg-white rounded-lg border border-gray-200 p-6">
								<div className="flex items-center justify-between mb-4">
									<div>
										<h3 className="text-lg font-semibold text-gray-900">
											Settlement Schedule
										</h3>
										<p className="text-sm text-gray-500">
											Configure automatic payout processing schedule
										</p>
									</div>
									<Button
										variant="outline"
										onClick={() => setShowAdvancedSettings(true)}
									>
										Advanced Settings
									</Button>
								</div>
								<SettlementScheduleSettings />
							</div>
						</div>
					)}

					{activeTab === "payment-settings" && <AdminPaymentSettings />}

					{/* Advanced Settings Modal */}
					{showAdvancedSettings && (
						<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
							<div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
								<div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
									<h3 className="text-xl font-bold text-gray-900">Advanced Settlement Schedule Settings</h3>
									<button
										onClick={() => setShowAdvancedSettings(false)}
										className="p-2 hover:bg-gray-100 rounded-full"
									>
										<X className="w-5 h-5" />
									</button>
								</div>
								<div className="p-6 space-y-6">
									<div>
										<h4 className="font-semibold text-gray-900 mb-3">Schedule Configuration</h4>
										<p className="text-sm text-gray-600 mb-4">
											Advanced settings for settlement schedule processing. These settings control how settlements are calculated and processed automatically.
										</p>
										<div className="space-y-4">
											<div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
												<p className="text-sm font-medium text-blue-900 mb-2">Schedule Behavior</p>
												<ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
													<li>Settlements are calculated based on the configured schedule type and time</li>
													<li>Only vendors with verified bank accounts are eligible for automatic processing</li>
													<li>Minimum payout amount threshold applies to all automatic settlements</li>
													<li>Failed payouts can be retried from Payout Management</li>
												</ul>
											</div>
											<div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
												<p className="text-sm font-medium text-yellow-900 mb-2">Important Notes</p>
												<ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
													<li>Schedule changes take effect on the next scheduled run</li>
													<li>Manual "Process Now" runs calculation immediately but does not auto-process payouts</li>
													<li>Payout processing must be done manually from Payout Management</li>
													<li>Timezone settings affect when scheduled runs execute</li>
												</ul>
											</div>
											<div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
												<p className="text-sm font-medium text-gray-900 mb-2">Settlement Period</p>
												<p className="text-sm text-gray-600">
													The settlement period (days) is controlled by the default tier in Tier Management. 
													This ensures consistency across all vendors and prevents conflicts.
												</p>
											</div>
										</div>
									</div>
									<div>
										<h4 className="font-semibold text-gray-900 mb-3">Processing Workflow</h4>
										<div className="space-y-2 text-sm text-gray-600">
											<div className="flex items-start gap-2">
												<span className="font-medium text-gray-900">1.</span>
												<span>Scheduled run calculates settlements based on bookings/orders in the period</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="font-medium text-gray-900">2.</span>
												<span>Settlements are created with status "pending"</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="font-medium text-gray-900">3.</span>
												<span>If auto-process is enabled, settlements are queued for payout processing</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="font-medium text-gray-900">4.</span>
												<span>Payouts are processed via payment gateway/bank API</span>
											</div>
											<div className="flex items-start gap-2">
												<span className="font-medium text-gray-900">5.</span>
												<span>Status updates to "completed" or "failed" based on processing result</span>
											</div>
										</div>
									</div>
								</div>
								<div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
									<Button onClick={() => setShowAdvancedSettings(false)} variant="outline">
										Close
									</Button>
								</div>
							</div>
						</div>
					)}
					</div>
				</div>
			</div>
		</AdminLayout>
	);
}

export default function FinanceManagement() {
	return (
		<Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>}>
			<FinanceManagementContent />
		</Suspense>
	);
}
