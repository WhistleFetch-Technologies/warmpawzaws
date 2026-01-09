"use client";

import { useState } from "react";
import {
	Search,
	Filter,
	AlertTriangle,
	Package,
	Plus,
	Edit2,
	Trash2,
	ArrowUpRight,
	ArrowDownRight,
	RefreshCw,
} from "lucide-react";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Badge,
	Input,
	Button,
} from "@repo/ui";
import { toast } from "sonner";

interface Product {
	id: string;
	name: string;
	sku: string;
	category: string;
	stock: number;
	minStock: number;
	price: number;
	status: "in_stock" | "low_stock" | "out_of_stock";
	lastUpdated: string;
}

export function InventoryManager() {
	const [products, setProducts] = useState<Product[]>([
		{
			id: "1",
			name: "NexGard Spectra (Small Dog)",
			sku: "MED-001",
			category: "Pharmacy",
			stock: 45,
			minStock: 10,
			price: 1250,
			status: "in_stock",
			lastUpdated: new Date().toISOString(),
		},
		{
			id: "2",
			name: "Royal Canin Puppy (3kg)",
			sku: "FOOD-023",
			category: "Food",
			stock: 5,
			minStock: 8,
			price: 2400,
			status: "low_stock",
			lastUpdated: new Date(Date.now() - 86400000).toISOString(),
		},
		{
			id: "3",
			name: "Rabies Vaccine (Vial)",
			sku: "VAC-005",
			category: "Medical Supplies",
			stock: 0,
			minStock: 20,
			price: 450,
			status: "out_of_stock",
			lastUpdated: new Date(Date.now() - 172800000).toISOString(),
		},
	]);

	const [searchQuery, setSearchQuery] = useState("");

	const getStatusColor = (status: string) => {
		switch (status) {
			case "in_stock":
				return "bg-green-100 text-green-700 border-green-200";
			case "low_stock":
				return "bg-yellow-100 text-yellow-700 border-yellow-200";
			case "out_of_stock":
				return "bg-red-100 text-red-700 border-red-200";
			default:
				return "bg-gray-100 text-gray-700";
		}
	};

	const handleUpdateStock = (id: string, change: number) => {
		setProducts(
			products.map((p) => {
				if (p.id === id) {
					const newStock = Math.max(0, p.stock + change);
					let newStatus: Product["status"] = "in_stock";
					if (newStock === 0) newStatus = "out_of_stock";
					else if (newStock <= p.minStock) newStatus = "low_stock";

					return {
						...p,
						stock: newStock,
						status: newStatus,
						lastUpdated: new Date().toISOString(),
					};
				}
				return p;
			})
		);
		toast.success(`Stock ${change > 0 ? "added" : "removed"} successfully`);
	};

	const filteredProducts = products.filter(
		(p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.sku.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-3 gap-4 mb-6">
				<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex items-center justify-between mb-2">
						<span className="text-gray-500 text-sm">Total Products</span>
						<Package className="w-4 h-4 text-blue-600" />
					</div>
					<p className="text-2xl font-bold text-gray-900">{products.length}</p>
				</div>
				<div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
					<div className="flex items-center justify-between mb-2">
						<span className="text-red-600 text-sm font-medium">
							Low Stock Alerts
						</span>
						<AlertTriangle className="w-4 h-4 text-red-600" />
					</div>
					<p className="text-2xl font-bold text-red-700">
						{products.filter((p) => p.status !== "in_stock").length}
					</p>
				</div>
				<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
					<div className="flex items-center justify-between mb-2">
						<span className="text-gray-500 text-sm">Total Value</span>
						<span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
							+12%
						</span>
					</div>
					<p className="text-2xl font-bold text-gray-900">
						₹
						{products
							.reduce((acc, p) => acc + p.price * p.stock, 0)
							.toLocaleString()}
					</p>
				</div>
			</div>

			<div className="flex items-center justify-between gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
					<Input
						placeholder="Search products by name or SKU..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10 bg-white"
					/>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" className="gap-2 bg-white">
						<Filter className="w-4 h-4" /> Filter
					</Button>
					<Button className="gap-2 bg-[#FF8C42] hover:bg-[#e67a30]">
						<Plus className="w-4 h-4" /> Add Product
					</Button>
				</div>
			</div>

			<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
				<Table>
					<TableHeader className="bg-gray-50">
						<TableRow>
							<TableHead>Product Details</TableHead>
							<TableHead>Category</TableHead>
							<TableHead>Stock Level</TableHead>
							<TableHead>Price</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredProducts.map((product) => (
							<TableRow key={product.id}>
								<TableCell>
									<div>
										<p className="font-medium text-gray-900">{product.name}</p>
										<p className="text-xs text-gray-500">SKU: {product.sku}</p>
									</div>
								</TableCell>
								<TableCell>
									<Badge variant="secondary" className="font-normal">
										{product.category}
									</Badge>
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-3">
										<span
											className={`font-medium ${product.stock <= product.minStock ? "text-red-600" : "text-gray-900"}`}
										>
											{product.stock} units
										</span>
										<div className="flex flex-col gap-1">
											<button
												onClick={() => handleUpdateStock(product.id, 1)}
												className="p-0.5 hover:bg-gray-100 rounded"
											>
												<ArrowUpRight className="w-3 h-3 text-green-600" />
											</button>
											<button
												onClick={() => handleUpdateStock(product.id, -1)}
												className="p-0.5 hover:bg-gray-100 rounded"
											>
												<ArrowDownRight className="w-3 h-3 text-red-600" />
											</button>
										</div>
									</div>
								</TableCell>
								<TableCell>₹{product.price}</TableCell>
								<TableCell>
									<span
										className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(product.status)}`}
									>
										{product.status.replace("_", " ").toUpperCase()}
									</span>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-gray-500 hover:text-blue-600"
										>
											<Edit2 className="w-4 h-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-gray-500 hover:text-red-600"
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
