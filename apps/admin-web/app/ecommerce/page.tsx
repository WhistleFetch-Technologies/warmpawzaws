"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ECommercePageHeader, ECommerceSubNav } from "@/components/admin/ecommerce/ECommerceSubNav";

import {
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
	| "orders"
	| "commission"
	| "categories"
	| "analytics"
	| "policies";

const UAT_MODE = typeof window !== 'undefined' && (
	(window as any).__WARMPAWZ_RUNTIME_CONFIG__?.uatMode === true ||
	process.env.NEXT_PUBLIC_UAT_MODE === 'true'
);

function ECommerceManagementInner() {
	const searchParams = useSearchParams();
	const initialTab = ((): TabType => {
		const raw = searchParams.get("tab") ?? "dashboard";
		const allowed: TabType[] = ["dashboard", "sellers", "products", "orders", "commission", "categories", "analytics", "policies"];
		return allowed.includes(raw as TabType) ? (raw as TabType) : "dashboard";
	})();

	const [activeTab, setActiveTab] = useState<TabType>(initialTab);

	useEffect(() => {
		setActiveTab(initialTab);
	}, [initialTab]);

	useEffect(() => {
		if (UAT_MODE && typeof window !== 'undefined') {
			const token = localStorage.getItem('adminAuthToken');
			if (!token) {
				localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
				localStorage.setItem('adminEmail', 'admin@warmpawz.com');
			}
		}
	}, []);

	return (
		<div className="flex-1 flex flex-col min-h-screen bg-gray-50">
			<ECommercePageHeader />
			<ECommerceSubNav />

			<div className="flex-1 overflow-y-auto">
				<div className="max-w-7xl mx-auto">
					{activeTab === "dashboard" && (
						<ECommerceDashboard
							onNavigateToOrders={() => setActiveTab("orders")}
							onNavigateToProducts={() => setActiveTab("products")}
							onNavigateToSellers={() => setActiveTab("sellers")}
						/>
					)}
					{activeTab === "sellers" && <SellerManagement />}
					{activeTab === "products" && <ProductApproval />}
					{activeTab === "orders" && <OrderManagementAdmin />}
					{activeTab === "commission" && <CommissionSettings />}
					{activeTab === "categories" && <CategoryManagement />}
					{activeTab === "analytics" && <ECommerceAnalytics />}
					{activeTab === "policies" && <PolicyManagement />}
				</div>
			</div>
		</div>
	);
}

export default function ECommerceManagement() {
	return (
		<AdminLayout>
			<Suspense fallback={<div className="p-8 text-slate-500">Loading e-commerce…</div>}>
				<ECommerceManagementInner />
			</Suspense>
		</AdminLayout>
	);
}
