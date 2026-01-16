"use client";

import { useState, useEffect } from "react";
import { Store, Search, Eye, CheckCircle, XCircle } from "lucide-react";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";

export function SellerManagement() {
	const [sellers, setSellers] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadSellers();
	}, []);

	const loadSellers = async () => {
		try {
			setLoading(true);
			// Load all vendors with pet_product role
			const res = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/list`,
				{ headers: { Authorization: `Bearer ${publicAnonKey}` } }
			);

			if (res.ok) {
				const data = await res.json();
				const petProductSellers =
					data.vendors?.filter((v: any) => v.roleId === "pet_product") || [];
				setSellers(petProductSellers);
			}
		} catch (error) {
			console.error("Error loading sellers:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-black text-xl font-semibold">
						Seller Management
					</h2>
					<p className="text-gray-500 text-sm mt-1">
						Manage pet product sellers on the platform
					</p>
				</div>
			</div>

			<div className="bg-white rounded-xl border border-gray-200 shadow-sm">
				<div className="p-4 border-b border-gray-200">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<input
							type="text"
							placeholder="Search sellers..."
							className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
						/>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Seller
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
									Phone
								</th>
								<th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
									Status
								</th>
								<th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
									Products
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
									Revenue
								</th>
								<th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{sellers.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className="px-6 py-12 text-center text-gray-500"
									>
										<Store className="w-12 h-12 mx-auto mb-3 text-gray-300" />
										<p>No sellers found</p>
									</td>
								</tr>
							) : (
								sellers.map((seller) => (
									<tr key={seller.id} className="hover:bg-gray-50">
										<td className="px-6 py-4">
											<div>
												<p className="font-medium text-black">
													{seller.businessName || seller.fullName}
												</p>
												<p className="text-xs text-gray-500">
													ID: {seller.id.slice(0, 8)}
												</p>
											</div>
										</td>
										<td className="px-6 py-4 text-gray-600">{seller.phone}</td>
										<td className="px-6 py-4 text-center">
											<span
												className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
													seller.isActive
														? "bg-green-100 text-green-700"
														: "bg-gray-100 text-gray-700"
												}`}
											>
												{seller.isActive ? (
													<CheckCircle className="w-3 h-3" />
												) : (
													<XCircle className="w-3 h-3" />
												)}
												{seller.isActive ? "Active" : "Inactive"}
											</span>
										</td>
										<td className="px-6 py-4 text-center text-gray-600">-</td>
										<td className="px-6 py-4 text-right text-gray-600">₹0</td>
										<td className="px-6 py-4 text-center">
											<button className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
												<Eye className="w-4 h-4" />
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
