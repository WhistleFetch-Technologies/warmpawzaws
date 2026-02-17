import { useState, useEffect } from "react";
import {
	Ticket,
	Plus,
	Search,
	Copy,
	Calendar,
	IndianRupee,
	Percent,
	Loader2,
	Trash2,
	Layers,
	Edit2,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
	DialogDescription,
	Badge,
	Input,
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@warmpawz/ui";
import { apiClient } from "@/lib/api-client";
import { toast, Toaster } from "sonner";

export function CouponManagement() {
	const [coupons, setCoupons] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	// Modal States
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showBulkModal, setShowBulkModal] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	// Form States
	const [formData, setFormData] = useState({
		code: "",
		type: "percentage",
		value: 0,
		minOrderAmount: 0,
		maxDiscountAmount: 0,
		validFrom: new Date().toISOString().split("T")[0],
		validUntil: new Date(Date.now() + 30 * 86400000)
			.toISOString()
			.split("T")[0],
		usageLimit: 0,
		isActive: true,
	});
	const [editingCoupon, setEditingCoupon] = useState<any>(null);
	const [showEditModal, setShowEditModal] = useState(false);
	const [editFormData, setEditFormData] = useState({
		code: "",
		type: "percentage",
		value: 0,
		validUntil: "",
		usageLimit: 0,
		isActive: true,
	});

	const [bulkData, setBulkData] = useState({
		prefix: "SAVE",
		quantity: 10,
		format: "alphanumeric",
		length: 8,
		type: "percentage",
		value: 10,
		minOrderAmount: 0,
		maxDiscountAmount: 0,
		validFrom: new Date().toISOString().split("T")[0],
		validUntil: new Date(Date.now() + 30 * 86400000)
			.toISOString()
			.split("T")[0],
		usageLimit: 1,
		isActive: true,
	});

	useEffect(() => {
		fetchCoupons();
	}, [search, statusFilter]);

	const fetchCoupons = async () => {
		try {
			setLoading(true);
			const query = new URLSearchParams({
				page: "1",
				limit: "50",
			});
			if (search) query.append("search", search);
			if (statusFilter !== "all") query.append("status", statusFilter);

			const res = await apiClient.get<any>(
				`/admin/coupons?${query.toString()}`
			);

			if (res.success) {
				setCoupons(res.coupons || []);
			}
		} catch (error) {
			console.error("Error fetching coupons:", error);
			toast.error("Failed to load coupons");
		} finally {
			setLoading(false);
		}
	};

	const handleCreate = async () => {
		try {
			setSubmitting(true);
			const res = await apiClient.post<any>("/admin/coupons/create", formData);

			if (res.success) {
				toast.success("Coupon created successfully");
				setShowCreateModal(false);
				fetchCoupons();
				setFormData({ ...formData, code: "" });
			} else {
				toast.error(res.error || "Failed to create coupon");
			}
		} catch (error) {
			toast.error("Error creating coupon");
		} finally {
			setSubmitting(false);
		}
	};

	const handleBulkGenerate = async () => {
		try {
			setSubmitting(true);
			const res = await apiClient.post<any>(
				"/admin/coupons/bulk-generate",
				bulkData
			);

			if (res.success) {
				toast.success(res.message);
				setShowBulkModal(false);
				fetchCoupons();
			} else {
				toast.error(res.error || "Failed to generate coupons");
			}
		} catch (error) {
			toast.error("Error generating coupons");
		} finally {
			setSubmitting(false);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
	};

	const handleEditCoupon = (coupon: any) => {
		setEditingCoupon(coupon);
		setEditFormData({
			code: coupon.code ?? "",
			type: coupon.type ?? "percentage",
			value: Number(coupon.value ?? 0),
			validUntil: coupon.validUntil || coupon.valid_until
				? new Date(coupon.validUntil || coupon.valid_until).toISOString().split("T")[0]
				: "",
			usageLimit: Number(coupon.usageLimit ?? coupon.usage_limit ?? 0),
			isActive: coupon.isActive ?? coupon.is_active ?? true,
		});
		setShowEditModal(true);
	};

	const handleUpdateCoupon = async () => {
		if (!editingCoupon?.id) return;
		try {
			setSubmitting(true);
			const payload = {
				code: editFormData.code,
				type: editFormData.type,
				value: editFormData.value,
				valid_until: editFormData.validUntil || null,
				usage_limit: editFormData.usageLimit || null,
				is_active: editFormData.isActive,
			};
			const res = await apiClient.put<any>(`/admin/coupons/${editingCoupon.id}`, payload);
			if (res?.success !== false) {
				toast.success("Coupon updated");
				setShowEditModal(false);
				setEditingCoupon(null);
				fetchCoupons();
			} else {
				toast.error(res?.error || "Update failed");
			}
		} catch {
			toast.error("Error updating coupon");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDeleteCoupon = async (coupon: any) => {
		if (!confirm(`Delete coupon ${coupon.code}?`)) return;
		try {
			setSubmitting(true);
			await apiClient.delete(`/admin/coupons/${coupon.id}`);
			toast.success("Coupon deleted");
			fetchCoupons();
		} catch {
			toast.error("Error deleting coupon");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-6 p-6">
			<Toaster position="top-right" richColors />
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">
						Coupon Management
					</h2>
					<p className="text-gray-500">
						Manage discount codes and bulk generation
					</p>
				</div>
				<div className="flex gap-2">
					<Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
						<DialogTrigger asChild>
							<Button variant="outline" className="gap-2">
								<Layers className="w-4 h-4" />
								Bulk Generate
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Bulk Generate Coupons</DialogTitle>
								<DialogDescription>
									Generate multiple unique coupon codes at once.
								</DialogDescription>
							</DialogHeader>

							<div className="grid grid-cols-2 gap-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">Prefix</label>
									<Input
										value={bulkData.prefix}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											setBulkData({
												...bulkData,
												prefix: e.target.value.toUpperCase(),
											})
										}
										placeholder="e.g. SAVE"
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium">Quantity</label>
									<Input
										type="number"
										value={bulkData.quantity}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											setBulkData({
												...bulkData,
												quantity: parseInt(e.target.value),
											})
										}
										min={1}
										max={1000}
									/>
								</div>

								<div className="col-span-2 border-t border-gray-100 my-2"></div>

								<div className="space-y-2">
									<label className="text-sm font-medium">Discount Type</label>
									<Select
										value={bulkData.type}
										onValueChange={(v: string) => setBulkData({ ...bulkData, type: v })}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="percentage">Percentage (%)</SelectItem>
											<SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium">Value</label>
									<Input
										type="number"
										value={bulkData.value}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											setBulkData({
												...bulkData,
												value: parseFloat(e.target.value),
											})
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium">
										Min Order Amount
									</label>
									<Input
										type="number"
										value={bulkData.minOrderAmount}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											setBulkData({
												...bulkData,
												minOrderAmount: parseFloat(e.target.value),
											})
										}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium">
										Usage Limit (Per Coupon)
									</label>
									<Input
										type="number"
										value={bulkData.usageLimit}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											setBulkData({
												...bulkData,
												usageLimit: parseInt(e.target.value),
											})
										}
									/>
								</div>
							</div>

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setShowBulkModal(false)}
								>
									Cancel
								</Button>
								<Button onClick={handleBulkGenerate} disabled={submitting}>
									{submitting ? (
										<Loader2 className="w-4 h-4 animate-spin mr-2" />
									) : null}
									Generate
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					<Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
						<DialogTrigger asChild>
							<Button className="bg-[#FF8C42] hover:bg-[#E67A32] gap-2">
								<Plus className="w-4 h-4" />
								Create Coupon
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create Single Coupon</DialogTitle>
								<DialogDescription>
									Fill in the details below to create a new discount coupon.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">Coupon Code</label>
									<Input
										value={formData.code}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											setFormData({
												...formData,
												code: e.target.value.toUpperCase(),
											})
										}
										placeholder="e.g. WELCOME20"
									/>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<label className="text-sm font-medium">Type</label>
										<Select
											value={formData.type}
											onValueChange={(v: string) =>
												setFormData({ ...formData, type: v })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="percentage">
													Percentage (%)
												</SelectItem>
												<SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<label className="text-sm font-medium">Value</label>
										<Input
											type="number"
											value={formData.value}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setFormData({
													...formData,
													value: parseFloat(e.target.value),
												})
											}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<label className="text-sm font-medium">Min Order</label>
										<Input
											type="number"
											value={formData.minOrderAmount}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setFormData({
													...formData,
													minOrderAmount: parseFloat(e.target.value),
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<label className="text-sm font-medium">Usage Limit</label>
										<Input
											type="number"
											value={formData.usageLimit}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setFormData({
													...formData,
													usageLimit: parseInt(e.target.value) || 0,
												})
											}
											placeholder="0 for unlimited"
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<label className="text-sm font-medium">Valid From</label>
										<Input
											type="date"
											value={formData.validFrom}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setFormData({ ...formData, validFrom: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<label className="text-sm font-medium">Expiry Date</label>
										<Input
											type="date"
											value={formData.validUntil}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setFormData({ ...formData, validUntil: e.target.value })
											}
											placeholder="Optional"
										/>
									</div>
								</div>
							</div>

							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setShowCreateModal(false)}
								>
									Cancel
								</Button>
								<Button onClick={handleCreate} disabled={submitting}>
									{submitting ? (
										<Loader2 className="w-4 h-4 animate-spin mr-2" />
									) : null}
									Create
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{/* Filters */}
			<div className="flex gap-4 bg-white p-4 rounded-xl border border-gray-200">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<Input
						className="pl-9"
						placeholder="Search coupons..."
						value={search}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
					/>
				</div>
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Filter by status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="inactive">Inactive</SelectItem>
						<SelectItem value="expired">Expired</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* List */}
			<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
				{loading ? (
					<div className="p-8 flex justify-center">
						<Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
					</div>
				) : coupons.length === 0 ? (
					<div className="p-12 text-center text-gray-500">
						<Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
						<p>No coupons found</p>
					</div>
				) : (
					<div className="divide-y divide-gray-100">
						<div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 font-medium text-sm text-gray-500">
							<div className="col-span-2">Code</div>
							<div>Discount</div>
							<div>Usage</div>
							<div>Expires</div>
							<div className="text-right">Actions</div>
						</div>
						{coupons.map((coupon) => (
							<div
								key={coupon.id}
								className="grid grid-cols-6 gap-4 p-4 items-center hover:bg-gray-50 transition-colors"
							>
								<div className="col-span-2">
									<div className="font-bold text-gray-900 flex items-center gap-2">
										{coupon.code}
										<button
											onClick={() => copyToClipboard(coupon.code)}
											className="text-gray-400 hover:text-gray-600"
										>
											<Copy className="w-3 h-3" />
										</button>
									</div>
									<div className="text-xs text-gray-500">
										Created{" "}
										{new Date(coupon.createdAt).toLocaleDateString()}
									</div>
								</div>

								<div>
									<Badge
										variant="secondary"
										className={
											coupon.type === "percentage"
												? "bg-green-100 text-green-800"
												: "bg-blue-100 text-blue-800"
										}
									>
										{coupon.type === "percentage"
											? `${coupon.value}%`
											: `₹${coupon.value}`}
									</Badge>
								</div>

								<div className="text-sm">
									<span className="font-medium">{coupon.usageCount ?? coupon.used_count ?? 0}</span>
									<span className="text-gray-400">
										{" / "}
										{(coupon.usageLimit ?? coupon.usage_limit) ? (coupon.usageLimit ?? coupon.usage_limit) : "∞"}
									</span>
								</div>

								<div className="text-sm text-gray-600">
									{coupon.validUntil || coupon.valid_until
										? new Date(coupon.validUntil || coupon.valid_until).toLocaleDateString()
										: "No expiry"}
								</div>

								<div className="flex justify-end gap-2 items-center">
									<Button
										variant="ghost"
										size="sm"
										title="Edit"
										onClick={() => handleEditCoupon(coupon)}
									>
										<Edit2 className="w-4 h-4" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										title="Delete"
										onClick={() => handleDeleteCoupon(coupon)}
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

		{/* Edit Coupon Modal */}
		<Dialog open={showEditModal} onOpenChange={(open) => { if (!open) { setShowEditModal(false); setEditingCoupon(null); } }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Coupon</DialogTitle>
						<DialogDescription>Update coupon details.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Code</label>
							<Input
								value={editFormData.code}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setEditFormData({ ...editFormData, code: e.target.value })
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">Type</label>
								<Select
									value={editFormData.type}
									onValueChange={(v: string) => setEditFormData({ ...editFormData, type: v })}
								>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										<SelectItem value="percentage">Percentage (%)</SelectItem>
										<SelectItem value="fixed">Fixed (₹)</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium">Value</label>
								<Input
									type="number"
									value={editFormData.value}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setEditFormData({ ...editFormData, value: parseFloat(e.target.value) || 0 })
									}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Expiry Date</label>
							<Input
								type="date"
								value={editFormData.validUntil}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setEditFormData({ ...editFormData, validUntil: e.target.value })
								}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Usage Limit (0 = unlimited)</label>
							<Input
								type="number"
								min={0}
								value={editFormData.usageLimit}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setEditFormData({ ...editFormData, usageLimit: parseInt(e.target.value, 10) || 0 })
								}
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="edit-active"
								checked={editFormData.isActive}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setEditFormData({ ...editFormData, isActive: e.target.checked })
								}
								className="rounded"
							/>
							<label htmlFor="edit-active" className="text-sm font-medium">Active</label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => { setShowEditModal(false); setEditingCoupon(null); }}>Cancel</Button>
						<Button onClick={handleUpdateCoupon} disabled={submitting}>
							{submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

