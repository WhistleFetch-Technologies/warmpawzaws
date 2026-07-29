"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@warmpawz/ui";
import {
	AWSIntegrationsSettings,
	PaymentGatewayIntegration,
	LogisticsIntegration,
	RewardsLoyaltyManagement,
	DiscoveryRulesManager,
	LegalPoliciesManager,
	CommerceSwitchPanel,
} from "@/components/admin/platform-settings/integrations";
import {
	CreditCard,
	Truck,
	Cloud,
	Settings,
	Gift,
	BookOpen,
	FileText,
	Store,
	type LucideIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

const PLATFORM_SETTINGS_TABS: {
	value: string;
	icon: LucideIcon;
	title: string;
	description: string;
}[] = [
	{
		value: "cloud",
		icon: Cloud,
		title: "Cloud & Maps",
		description: "AWS S3, SQS, Google Maps",
	},
	{
		value: "payments",
		icon: CreditCard,
		title: "Payment Gateway",
		description: "Razorpay, Stripe, Paytm",
	},
	{
		value: "logistics",
		icon: Truck,
		title: "Logistics Integration",
		description: "Shiprocket, Delhivery, BlueDart",
	},
	{
		value: "loyalty",
		icon: Gift,
		title: "Loyalty & Rewards",
		description: "Points, Rewards, Redemption",
	},
	{
		value: "rules",
		icon: BookOpen,
		title: "Rule Book",
		description: "Discovery & Service Rules",
	},
	{
		value: "commerce",
		icon: Store,
		title: "Commerce",
		description: "Active commerce model",
	},
	{
		value: "legal",
		icon: FileText,
		title: "Legal & Policies",
		description: "T&C, Vendor Agreements",
	},
];

const platformSettingsTabTriggerClass =
	"group !flex !h-auto min-h-[4.5rem] w-full !flex-none flex-row !items-center !justify-start gap-3.5 whitespace-normal rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all " +
	"hover:border-slate-300 hover:bg-slate-50 " +
	"data-[state=active]:border-orange-300 data-[state=active]:bg-orange-50 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-orange-200 " +
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40";

export default function PlatformSettings() {
	const [activeTab, setActiveTab] = useState("cloud");

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
				{/* Header Section - Match wireframe: sticky top-0 z-10, border-b, max-w-6xl */}
				<div className="bg-white border-b sticky top-0 z-10">
					<div className="max-w-6xl mx-auto px-6 py-4">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-orange-100 rounded-lg">
									<Settings className="w-6 h-6 text-orange-600" />
								</div>
								<div>
									{/* ✅ FIX: Match wireframe - text-2xl font-bold text-slate-900 */}
									<h1 className="text-2xl font-bold text-slate-900">
										Platform Settings
									</h1>
									<p className="text-sm text-slate-500">
										Manage global configurations, integrations, and service
										partners.
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Main Content - Match wireframe: max-w-6xl mx-auto px-6 py-8 */}
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-6xl mx-auto px-6 py-8">
					<Tabs
						value={activeTab}
						onValueChange={(value: string) => setActiveTab(value)}
						className="space-y-8"
					>
						<div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
							<TabsList className="grid h-auto w-full grid-cols-1 gap-2.5 bg-transparent p-0 shadow-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{PLATFORM_SETTINGS_TABS.map(({ value, icon: Icon, title, description }) => (
									<TabsTrigger
										key={value}
										value={value}
										className={platformSettingsTabTriggerClass}
									>
										<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition-colors group-data-[state=active]:bg-white group-data-[state=active]:shadow-sm">
											<Icon className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-data-[state=active]:text-orange-600" />
										</div>
										<div className="min-w-0 flex-1 space-y-0.5">
											<div className="text-sm font-semibold leading-snug text-slate-900 group-data-[state=active]:text-orange-900">
												{title}
											</div>
											<div className="text-xs leading-relaxed text-slate-500 group-data-[state=active]:text-orange-800/80">
												{description}
											</div>
										</div>
									</TabsTrigger>
								))}
							</TabsList>
						</div>

						<div className="min-h-[500px]">
							<TabsContent
								value="cloud"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<AWSIntegrationsSettings />
							</TabsContent>

							<TabsContent
								value="payments"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<PaymentGatewayIntegration />
							</TabsContent>

							<TabsContent
								value="logistics"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<LogisticsIntegration />
							</TabsContent>

							<TabsContent
								value="loyalty"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<RewardsLoyaltyManagement />
							</TabsContent>

							<TabsContent
								value="rules"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<DiscoveryRulesManager />
							</TabsContent>

							<TabsContent
								value="commerce"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<CommerceSwitchPanel />
							</TabsContent>

							<TabsContent
								value="legal"
								className="m-0 focus-visible:ring-0 outline-none"
							>
								<LegalPoliciesManager />
							</TabsContent>
						</div>
					</Tabs>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
}
