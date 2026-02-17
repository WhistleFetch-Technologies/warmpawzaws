"use client";

import { useState, useEffect } from "react";
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
} from "@warmpawz/ui";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface Product {
	id: string;
	name: string;
	sku: string;
	category: string;
	categoryId?: string;
	stock: number;
	minStock: number;
	price: number;
	status: "in_stock" | "low_stock" | "out_of_stock";
	lastUpdated: string;
}

interface CategoryOption {
	id: string;
	name: string;
}

export function InventoryManager() {
	const [products, setProducts] = useState<Product[]>([]);
	const [categories, setCategories] = useState<CategoryOption[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [filterCategory, setFilterCategory] = useState<string>("all");
	const [filterOpen, setFilterOpen] = useState(false);
	const [addProductOpen, setAddProductOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [newProduct, setNewProduct] = useState({
		name: "",
		description: "",
		categoryId: "",
		price: "",
		stock: "0",
		status: "in_stock" as "in_stock" | "low_stock" | "out_of_stock",
	});
	const [savingProduct, setSavingProduct] = useState(false);

	useEffect(() => {
		loadProducts();
		loadCategories();
	}, []);

	const loadCategories = async () => {
		try {
			const res = await apiClient.get<any>("/admin/catalog/categories");
			const list = res?.categories || [];
			setCategories(
				(list || []).map((c: any) => ({
					id: String(c.id ?? ""),
					name: String(c.name ?? ""),
				})).filter((c: CategoryOption) => c.name)
			);
		} catch {
			setCategories([]);
		}
	};

	const categoryNameById = (id: string) => (id ? (categories.find((c) => c.id === id)?.name || id) : "—");

	const loadProducts = async () => {
		setLoading(true);
		try {
			const res = await apiClient.get<any>("/admin/enterprise/inventory");
			const list = res?.products || [];
			const mapped: Product[] = (list || []).map((p: any) => {
				const stock = parseInt(p.stock ?? p.stock_quantity ?? 0, 10);
				const minStock = 5;
				let status: Product["status"] = "in_stock";
				if (stock === 0) status = "out_of_stock";
				else if (stock <= minStock) status = "low_stock";
				const catId = String(p.categoryId ?? p.category_id ?? "");
				return {
					id: String(p.id),
					name: String(p.name || ""),
					sku: String(p.sku || `SKU-${p.id}`),
					category: String(p.category || catId),
					categoryId: catId || undefined,
					stock,
					minStock,
					price: parseFloat(p.price || 0),
					status,
					lastUpdated: String(p.lastUpdated || p.updated_at || ""),
				};
			});
			setProducts(mapped);
		} catch {
			setProducts([]);
		} finally {
			setLoading(false);
		}
	};

	const handleAddProduct = async () => {
		if (!newProduct.name.trim() || !newProduct.price) {
			toast.error("Name and price are required");
			return;
		}
		setSavingProduct(true);
		try {
			await apiClient.post("/admin/catalog/products", {
				name: newProduct.name.trim(),
				description: newProduct.description || "",
				categoryId: newProduct.categoryId || undefined,
				price: parseFloat(newProduct.price) || 0,
				stock: parseInt(newProduct.stock || "0", 10),
				status: newProduct.status === "in_stock" ? "active" : newProduct.status === "low_stock" ? "active" : "inactive",
			});
			toast.success("Product added successfully");
			setAddProductOpen(false);
			setNewProduct({ name: "", description: "", categoryId: "", price: "", stock: "0", status: "in_stock" });
			await loadProducts();
		} catch (err: any) {
			toast.error(err.message || "Failed to add product");
		} finally {
			setSavingProduct(false);
		}
	};

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

	const handleUpdateStock = async (id: string, change: number) => {
		try {
			const updatedProducts = products.map((p) => {
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
			});

			await apiClient.put<any>("/admin/enterprise/inventory", {
				products: updatedProducts,
			});
			setProducts(updatedProducts);
			toast.success(`Stock ${change > 0 ? "added" : "removed"} successfully`);
		} catch (error) {
			console.error("Error updating stock:", error);
			toast.error("Failed to update stock");
		}
	};

	const filteredProducts = products.filter((p) => {
		const matchesSearch =
			p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.sku.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = filterStatus === "all" || p.status === filterStatus;
		const matchesCategory = filterCategory === "all" || (p.categoryId && p.categoryId === filterCategory);
		return matchesSearch && matchesStatus && matchesCategory;
	});

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
						onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
							setSearchQuery(e.target.value)
						}
						className="pl-10 bg-white"
					/>
				</div>
				<div className="flex gap-2 relative">
					<div className="relative">
						<Button
							variant="outline"
							className="gap-2 bg-white"
							onClick={() => setFilterOpen((o) => !o)}
						>
							<Filter className="w-4 h-4" /> Filter
						</Button>
						{filterOpen && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
								<div className="absolute right-0 top-full mt-1 z-20 w-56 p-3 bg-white border border-gray-200 rounded-lg shadow-lg">
									<p className="text-sm font-medium mb-2">Status</p>
									<select
										value={filterStatus}
										onChange={(e) => setFilterStatus(e.target.value)}
										className="w-full border rounded px-2 py-1 text-sm mb-3"
									>
										<option value="all">All</option>
										<option value="in_stock">In stock</option>
										<option value="low_stock">Low stock</option>
										<option value="out_of_stock">Out of stock</option>
									</select>
									<p className="text-sm font-medium mb-2">Category</p>
									<select
										value={filterCategory}
										onChange={(e) => setFilterCategory(e.target.value)}
										className="w-full border rounded px-2 py-1 text-sm"
									>
										<option value="all">All</option>
										{categories.map((c) => (
											<option key={c.id} value={c.id}>{c.name}</option>
										))}
									</select>
								</div>
							</>
						)}
					</div>
					<Button
						className="gap-2 bg-[#FF8C42] hover:bg-[#e67a30]"
						onClick={() => setAddProductOpen(true)}
					>
						<Plus className="w-4 h-4" /> Add Product
					</Button>
				</div>
			</div>

			{addProductOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddProductOpen(false)}>
					<div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<h3 className="text-lg font-semibold">Add Product</h3>
						<div>
							<label className="block text-sm font-medium mb-1">Product name</label>
							<Input
								value={newProduct.name}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, name: e.target.value })}
								placeholder="Product name"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Description (optional)</label>
							<Input
								value={newProduct.description}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, description: e.target.value })}
								placeholder="Short description"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Category</label>
							<select
								value={newProduct.categoryId}
								onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
								className="w-full border rounded-md px-3 py-2 text-sm"
							>
								<option value="">Select category</option>
								{categories.map((c) => (
									<option key={c.id} value={c.id}>{c.name}</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Stock level</label>
							<Input
								type="number"
								min={0}
								value={newProduct.stock}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, stock: e.target.value })}
								placeholder="0"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Price (₹)</label>
							<Input
								type="number"
								min={0}
								step="0.01"
								value={newProduct.price}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProduct({ ...newProduct, price: e.target.value })}
								placeholder="0"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Status</label>
							<select
								value={newProduct.status}
								onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewProduct({ ...newProduct, status: e.target.value as Product["status"] })}
								className="w-full border rounded-md px-3 py-2 text-sm"
							>
								<option value="in_stock">In stock</option>
								<option value="low_stock">Low stock</option>
								<option value="out_of_stock">Out of stock</option>
							</select>
						</div>
						<div className="flex gap-2 justify-end">
							<Button variant="outline" onClick={() => setAddProductOpen(false)}>Cancel</Button>
							<Button className="bg-[#FF8C42] hover:bg-[#e67a30]" onClick={handleAddProduct} disabled={savingProduct}>
								{savingProduct ? "Saving..." : "Add Product"}
							</Button>
						</div>
					</div>
				</div>
			)}

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
						{loading ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center py-8 text-gray-500">
									Loading...
								</TableCell>
							</TableRow>
						) : filteredProducts.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center py-8 text-gray-500">
									No products found
								</TableCell>
							</TableRow>
						) : (
							filteredProducts.map((product) => (
								<TableRow key={product.id}>
									<TableCell>
										<div>
											<p className="font-medium text-gray-900">{product.name}</p>
											<p className="text-xs text-gray-500">SKU: {product.sku}</p>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="secondary" className="font-normal">
											{categoryNameById(product.categoryId || product.category) || "—"}
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
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

