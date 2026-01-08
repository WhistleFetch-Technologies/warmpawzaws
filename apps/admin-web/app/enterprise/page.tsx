"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@warmpawz/ui";
import {
	Briefcase,
	TrendingUp,
	DollarSign,
	Users,
	Building2,
	ArrowUp,
	ArrowDown,
	Download,
	RefreshCw,
	BarChart3,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { UnifiedAdminSidebar } from "@/components/admin/layout/UnifiedAdminSidebar";

interface RevenueStats {
	totalRevenue: number;
	commissionEarned: number;
	vendorPayouts: number;
	growthRate: number;
	enterpriseCustomers: number;
	avgOrderValue: number;
	monthlyRecurring: number;
}

interface EnterpriseCustomer {
	id: string;
	name: string;
	email: string;
	totalSpent: number;
	bookings: number;
	status: "active" | "inactive";
	joinedAt: string;
}

export default function EnterpriseRevenue() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<
		"overview" | "revenue" | "customers"
	>("overview");
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<RevenueStats | null>(null);
	const [enterpriseCustomers, setEnterpriseCustomers] = useState<
		EnterpriseCustomer[]
	>([]);
	const [dateRange, setDateRange] = useState("30d");

	useEffect(() => {
		loadData();
	}, [dateRange]);

	const loadData = async () => {
		try {
			setLoading(true);

			// Load revenue stats
			const statsRes = await apiClient.get<any>(
				`/admin/enterprise/revenue/stats?range=${dateRange}`
			);

			if (statsRes.success) {
				setStats(statsRes.data);
			}

			// Load enterprise customers
			const customersRes = await apiClient.get<any>(
				"/admin/enterprise/customers"
			);

			if (customersRes.success) {
				setEnterpriseCustomers(customersRes.data.customers || []);
			}
		} catch (error: any) {
			console.error("Error loading enterprise data:", error);
			toast.error("Failed to load enterprise data");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 flex">
			<UnifiedAdminSidebar
				activeView="enterprise"
				onNavigate={(view) => router.push(`/${view}`)}
			/>

			<div className="flex-1">
				{/* Header */}
				<div className="bg-white border-b border-gray-200 px-20 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 bg-linear-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
									<Briefcase className="w-5 h-5 text-white" />
								</div>
								<div>
									<h1 className="text-2xl font-bold text-gray-900">
										Enterprise & Revenue
									</h1>
									<p className="text-sm text-gray-500">
										Manage enterprise customers and revenue analytics
									</p>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<select
								value={dateRange}
								onChange={(e) => setDateRange(e.target.value)}
								className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
							>
								<option value="7d">Last 7 days</option>
								<option value="30d">Last 30 days</option>
								<option value="90d">Last 90 days</option>
								<option value="1y">Last year</option>
							</select>
							<Button variant="outline" onClick={loadData} disabled={loading}>
								<RefreshCw
									className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
								/>
								Refresh
							</Button>
							<Button variant="outline">
								<Download className="w-4 h-4 mr-2" />
								Export
							</Button>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className="bg-white border-b border-gray-200 px-6">
					<div className="flex gap-1">
						{[
							{ id: "overview", label: "Overview", icon: BarChart3 },
							{ id: "revenue", label: "Revenue Analytics", icon: TrendingUp },
							{ id: "customers", label: "Enterprise Customers", icon: Building2 },
							{ id: "logic", label: "Enterprise Logic", icon: Briefcase },
						].map((tab) => {
							const Icon = tab.icon;
							if (tab.id === "logic") {
								return (
									<button
										key={tab.id}
										onClick={() => router.push("/enterprise/logic-tab")}
										className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-600 hover:text-gray-900`}
									>
										<Icon className="w-4 h-4 inline mr-2" />
										{tab.label}
									</button>
								);
							}
							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id as any)}
									className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
										activeTab === tab.id
											? "border-orange-500 text-orange-600"
											: "border-transparent text-gray-600 hover:text-gray-900"
									}`}
								>
									<Icon className="w-4 h-4 inline mr-2" />
									{tab.label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Content */}
				<div className="p-6">
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
						</div>
					) : activeTab === "overview" ? (
						<div className="space-y-6">
							{/* Stats Cards */}
							<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
								<Card className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="p-2 bg-green-100 rounded-lg">
											<DollarSign className="w-5 h-5 text-green-600" />
										</div>
										{stats && stats.growthRate > 0 ? (
											<div className="flex items-center text-green-600 text-sm">
												<ArrowUp className="w-4 h-4 mr-1" />
												{stats.growthRate.toFixed(1)}%
											</div>
										) : (
											<div className="flex items-center text-red-600 text-sm">
												<ArrowDown className="w-4 h-4 mr-1" />
												{stats ? Math.abs(stats.growthRate).toFixed(1) : 0}%
											</div>
										)}
									</div>
									<p className="text-sm text-gray-600 mb-1">Total Revenue</p>
									<p className="text-2xl font-bold text-gray-900">
										₹{stats ? (stats.totalRevenue / 1000).toFixed(1) : 0}K
									</p>
								</Card>

								<Card className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="p-2 bg-purple-100 rounded-lg">
											<TrendingUp className="w-5 h-5 text-purple-600" />
										</div>
									</div>
									<p className="text-sm text-gray-600 mb-1">Commission Earned</p>
									<p className="text-2xl font-bold text-gray-900">
										₹{stats ? (stats.commissionEarned / 1000).toFixed(1) : 0}K
									</p>
								</Card>

								<Card className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="p-2 bg-blue-100 rounded-lg">
											<Building2 className="w-5 h-5 text-blue-600" />
										</div>
									</div>
									<p className="text-sm text-gray-600 mb-1">
										Enterprise Customers
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{stats ? stats.enterpriseCustomers : 0}
									</p>
								</Card>

								<Card className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="p-2 bg-orange-100 rounded-lg">
											<Users className="w-5 h-5 text-orange-600" />
										</div>
									</div>
									<p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
									<p className="text-2xl font-bold text-gray-900">
										₹{stats ? stats.avgOrderValue.toFixed(0) : 0}
									</p>
								</Card>
							</div>

							{/* Revenue Chart Placeholder */}
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
								<div className="h-64 flex items-center justify-center text-gray-400">
									Revenue chart will be displayed here
								</div>
							</Card>
						</div>
					) : activeTab === "revenue" ? (
						<div className="space-y-6">
							<Card className="p-6">
								<h3 className="text-lg font-semibold mb-4">Revenue Analytics</h3>
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-sm text-gray-600">Total Revenue</p>
											<p className="text-2xl font-bold">
												₹{stats ? (stats.totalRevenue / 1000).toFixed(1) : 0}K
											</p>
										</div>
										<div>
											<p className="text-sm text-gray-600">Commission</p>
											<p className="text-2xl font-bold">
												₹{stats ? (stats.commissionEarned / 1000).toFixed(1) : 0}K
											</p>
										</div>
										<div>
											<p className="text-sm text-gray-600">Vendor Payouts</p>
											<p className="text-2xl font-bold">
												₹{stats ? (stats.vendorPayouts / 1000).toFixed(1) : 0}K
											</p>
										</div>
										<div>
											<p className="text-sm text-gray-600">Monthly Recurring</p>
											<p className="text-2xl font-bold">
												₹{stats ? (stats.monthlyRecurring / 1000).toFixed(1) : 0}K
											</p>
										</div>
									</div>
								</div>
							</Card>
						</div>
					) : activeTab === "customers" ? (
						<div className="space-y-6">
							<Card className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-lg font-semibold">Enterprise Customers</h3>
									<Button>Add Customer</Button>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b">
												<th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
													Name
												</th>
												<th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
													Email
												</th>
												<th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
													Total Spent
												</th>
												<th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
													Bookings
												</th>
												<th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
													Status
												</th>
												<th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
													Joined
												</th>
											</tr>
										</thead>
										<tbody>
											{enterpriseCustomers.length === 0 ? (
												<tr>
													<td
														colSpan={6}
														className="text-center py-8 text-gray-500"
													>
														No enterprise customers found
													</td>
												</tr>
											) : (
												enterpriseCustomers.map((customer) => (
													<tr
														key={customer.id}
														className="border-b hover:bg-gray-50"
													>
														<td className="py-3 px-4">{customer.name}</td>
														<td className="py-3 px-4">{customer.email}</td>
														<td className="py-3 px-4">
															₹{customer.totalSpent.toFixed(2)}
														</td>
														<td className="py-3 px-4">{customer.bookings}</td>
														<td className="py-3 px-4">
															<span
																className={`px-2 py-1 rounded text-xs ${
																	customer.status === "active"
																		? "bg-green-100 text-green-700"
																		: "bg-gray-100 text-gray-700"
																}`}
															>
																{customer.status}
															</span>
														</td>
														<td className="py-3 px-4 text-sm text-gray-500">
															{new Date(customer.joinedAt).toLocaleDateString()}
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</Card>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

