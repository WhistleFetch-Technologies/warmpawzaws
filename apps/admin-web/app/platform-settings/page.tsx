"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@warmpawz/ui";
import {
	AWSIntegrationsSettings,
	PaymentGatewayIntegration,
	LogisticsIntegration,
	RewardsLoyaltyManagement,
} from "@/components/admin/platform-settings/integrations";
import {
	CreditCard,
	Truck,
	Cloud,
	Settings,
	Gift,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

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
					<Tabs value={activeTab} onValueChange={(value) => {
						console.log('🔧 Platform Settings tab clicked:', value);
						setActiveTab(value);
					}} className="space-y-8">
						<TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-white border rounded-xl shadow-sm">
							<TabsTrigger
								value="cloud"
								className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
							>
								<div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
									<Cloud className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
								</div>
								<div className="text-center md:text-left">
									<div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">
										Cloud & Maps
									</div>
									<div className="text-xs text-slate-500 hidden md:block mt-0.5">
										AWS S3, SQS, Google Maps
									</div>
								</div>
							</TabsTrigger>

							<TabsTrigger
								value="payments"
								className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
							>
								<div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
									<CreditCard className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
								</div>
								<div className="text-center md:text-left">
									<div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">
										Payment Gateway
									</div>
									<div className="text-xs text-slate-500 hidden md:block mt-0.5">
										Razorpay, Stripe, Paytm
									</div>
								</div>
							</TabsTrigger>

							<TabsTrigger
								value="logistics"
								className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
							>
								<div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
									<Truck className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
								</div>
								<div className="text-center md:text-left">
									<div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">
										Logistics Integration
									</div>
									<div className="text-xs text-slate-500 hidden md:block mt-0.5">
										Shiprocket, Delhivery, BlueDart
									</div>
								</div>
							</TabsTrigger>

							<TabsTrigger
								value="loyalty"
								className="flex flex-col md:flex-row items-center gap-3 py-3 md:py-4 px-4 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 border border-transparent rounded-lg transition-all"
							>
								<div className="p-2 bg-slate-100 rounded-md group-data-[state=active]:bg-white">
									<Gift className="w-5 h-5 text-slate-600 group-data-[state=active]:text-orange-600" />
								</div>
								<div className="text-center md:text-left">
									<div className="font-semibold text-slate-900 group-data-[state=active]:text-orange-900">
										Loyalty & Rewards
									</div>
									<div className="text-xs text-slate-500 hidden md:block mt-0.5">
										Points, Rewards, Redemption
									</div>
								</div>
							</TabsTrigger>
						</TabsList>

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
						</div>
					</Tabs>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
}
