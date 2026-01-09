"use client";

import { useState } from "react";
import {
	LayoutDashboard,
	Store,
	Package,
	ShoppingCart,
	Percent,
	BarChart3,
	Settings,
	FileText,
	CheckCircle2,
} from "lucide-react";

import {
	CustomServiceApproval,
	ECommerceAnalytics,
	PolicyManagement,
	CategoryManagement,
	ECommerceDashboard,
	CommissionSettings,
	ProductApproval,
	OrderManagementAdmin,
	SellerManagement,
} from "@/components/admin/ecommerce";

type TabType =
	| "dashboard"
	| "sellers"
	| "products"
	| "service-approval"
	| "orders"
	| "commission"
	| "categories"
	| "analytics"
	| "policies";

export default function ECommerceManagement() {
	const [activeTab, setActiveTab] = useState<TabType>("dashboard");

	const tabs = [
		{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
		{ id: "sellers", label: "Sellers", icon: Store },
		{ id: "products", label: "Product Approval", icon: Package },
		{ id: "service-approval", label: "Service Approval", icon: CheckCircle2 },
		{ id: "orders", label: "Orders", icon: ShoppingCart },
		{ id: "commission", label: "Commission", icon: Percent },
		{ id: "categories", label: "Categories", icon: FileText },
		{ id: "analytics", label: "Analytics", icon: BarChart3 },
		{ id: "policies", label: "Policies", icon: Settings },
	];

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<div className="bg-white border-b px-20 border-gray-200">
				<div className="max-w-7xl mx-auto px-6 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-black">E-Commerce Management</h1>
							<p className="text-gray-500 text-sm mt-1">
								Manage your multi-vendor marketplace
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

			{/* Tabs */}
			<div className="bg-white border-b border-gray-200">
				<div className="max-w-7xl mx-auto px-6">
					<div className="flex gap-1 overflow-x-auto">
						{tabs.map((tab) => {
							const Icon = tab.icon;
							const isActive = activeTab === tab.id;

							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id as TabType)}
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

			{/* Content */}
			<div className="max-w-7xl mx-auto">
				{activeTab === "dashboard" && <ECommerceDashboard />}
				{activeTab === "sellers" && <SellerManagement />}
				{activeTab === "products" && <ProductApproval />}
				{activeTab === "service-approval" && <CustomServiceApproval />}
				{activeTab === "orders" && <OrderManagementAdmin />}
				{activeTab === "commission" && <CommissionSettings />}
				{activeTab === "categories" && <CategoryManagement />}
				{activeTab === "analytics" && <ECommerceAnalytics />}
				{activeTab === "policies" && <PolicyManagement />}
			</div>
		</div>
	);
}
