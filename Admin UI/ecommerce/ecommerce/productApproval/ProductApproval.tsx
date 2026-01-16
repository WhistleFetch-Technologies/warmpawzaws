"use client";

import { useState, useEffect } from "react";
import { Package, CheckCircle, XCircle } from "lucide-react";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
import { toast, Toaster } from "sonner";

export function ProductApproval() {
	const [products, setProducts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadPendingProducts();
	}, []);

	const loadPendingProducts = async () => {
		try {
			setLoading(true);
			const res = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/products?status=pending_approval`,
				{ headers: { Authorization: `Bearer ${publicAnonKey}` } }
			);

			if (res.ok) {
				const data = await res.json();
				setProducts(data.products);
			}
		} catch (error) {
			console.error("Error loading products:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleApprove = async (productId: string) => {
		try {
			const res = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/product/${productId}`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "active" }),
				}
			);

			if (res.ok) {
				toast.success("Product approved");
				loadPendingProducts();
			} else {
				toast.error("Failed to approve product");
			}
		} catch (error) {
			toast.error("Error approving product");
		}
	};

	const handleReject = async (productId: string) => {
		const reason = prompt("Enter rejection reason:");
		if (!reason) return;

		try {
			const res = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/product/${productId}`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "rejected", rejectionReason: reason }),
				}
			);

			if (res.ok) {
				toast.success("Product rejected");
				loadPendingProducts();
			} else {
				toast.error("Failed to reject product");
			}
		} catch (error) {
			toast.error("Error rejecting product");
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Toaster position="top-right" richColors />

				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			<Toaster position="top-right" richColors />

			<div>
				<h2 className="text-black text-xl font-semibold">Product Approval</h2>
				<p className="text-gray-500 text-sm mt-1">
					Review and approve seller products
				</p>
			</div>

			{products.length === 0 ? (
				<div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
					<Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
					<p className="text-gray-500">No products pending approval</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{products.map((product) => (
						<div
							key={product.id}
							className="bg-white rounded-xl border border-gray-200 overflow-hidden"
						>
							<div className="aspect-square bg-gray-100 flex items-center justify-center text-6xl">
								{product.emoji || "📦"}
							</div>
							<div className="p-4">
								<h3 className="font-semibold text-black">{product.name}</h3>
								<p className="text-sm text-gray-500 mt-1 line-clamp-2">
									{product.description}
								</p>
								<p className="text-black font-bold mt-2">₹{product.price}</p>
								<div className="flex gap-2 mt-4">
									<button
										onClick={() => handleApprove(product.id)}
										className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
									>
										<CheckCircle className="w-4 h-4" />
										Approve
									</button>
									<button
										onClick={() => handleReject(product.id)}
										className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
									>
										<XCircle className="w-4 h-4" />
										Reject
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
