import {
	X,
	MapPin,
	Star,
	TrendingUp,
	ShoppingBag,
	Package,
	Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";

interface VendorDetails {
	id: string;
	name: string;
	tier: string;
	tierColor: string;
	rating: number;
	complaints: number;
	location: string;
	experience: string;
	lastActive: string;
	businessHours: string;
	monthlyRevenue: number;
	revenueChange: number;
	totalOrders: number;
	ordersPeriod: string;
	products: number;
	productsType: string;
	complianceScore: number;
	complianceLabel: string;
	address: string;
	primaryContact: string;
	email: string;
	website: string;
	joinDate: string;
	documents: string;
	totalRevenue: number;
	avgOrderValue: number;
	refundRate: number;
	commissionRate: number;
	paymentMethod: string;
	bankAccount: string;
	frequency: string;
	taxId: string;
	recentOrders: Array<{
		service: string;
		customer: string;
		amount: number;
	}>;
}

interface VendorDetailsModalProps {
	isOpen: boolean;
	onClose: () => void;
	vendorId: string;
}

export function VendorDetailsModal({
	isOpen,
	onClose,
	vendorId,
}: VendorDetailsModalProps) {
	const [vendor, setVendor] = useState<VendorDetails | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (isOpen && vendorId) {
			loadVendorDetails();
		}
	}, [isOpen, vendorId]);

	const loadVendorDetails = async () => {
		try {
			setLoading(true);

			const response = await fetch(
				`${getApiBaseUrl()}/admin/vendors/${vendorId}/details`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setVendor(data.vendor);
			}
		} catch (error) {
			console.error("Error loading vendor details:", error);
		} finally {
			setLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
				{loading || !vendor ? (
					<div className="p-12 text-center">
						<div className="text-sm text-gray-500">
							Loading vendor details...
						</div>
					</div>
				) : (
					<>
						{/* Header */}
						<div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<h2 className="text-lg">{vendor.name}</h2>
								<span
									className={`px-3 py-1 text-xs rounded-full ${
										vendor.tierColor === "gold"
											? "bg-yellow-100 text-yellow-700"
											: vendor.tierColor === "silver"
												? "bg-gray-200 text-gray-700"
												: vendor.tierColor === "premium"
													? "bg-purple-100 text-purple-700"
													: "bg-blue-100 text-blue-700"
									}`}
								>
									{vendor.tier}
								</span>
							</div>
							<button
								onClick={onClose}
								className="p-2 hover:bg-gray-100 rounded-lg"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						{/* Quick Info Bar */}
						<div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-6 text-sm">
							<div className="flex items-center gap-2">
								<span className="text-gray-600">Vet</span>
							</div>
							<div className="flex items-center gap-1">
								<Star className="w-4 h-4 text-orange-500 fill-orange-500" />
								<span>{vendor.rating}/5</span>
							</div>
							<div className="text-gray-600">
								{vendor.complaints} complaints
							</div>
							<div className="flex items-center gap-1">
								<MapPin className="w-4 h-4 text-gray-400" />
								<span>
									{vendor.location} | {vendor.experience} | {vendor.lastActive}
								</span>
							</div>
							<div className="text-gray-600 ml-auto">
								{vendor.businessHours}
							</div>
						</div>

						{/* Stats Cards */}
						<div className="px-6 py-6 grid grid-cols-4 gap-4">
							<div className="bg-white border border-gray-200 rounded-xl p-4">
								<div className="flex items-center justify-between mb-3">
									<span className="text-xs text-gray-600">Monthly Revenue</span>
									<div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
										<TrendingUp className="w-4 h-4 text-green-600" />
									</div>
								</div>
								<div className="text-2xl mb-1">
									₹{vendor.monthlyRevenue.toLocaleString("en-IN")}
								</div>
								<div className="text-xs text-green-600">
									↑ {vendor.revenueChange}% from last month
								</div>
							</div>

							<div className="bg-white border border-gray-200 rounded-xl p-4">
								<div className="flex items-center justify-between mb-3">
									<span className="text-xs text-gray-600">Total Orders</span>
									<div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
										<ShoppingBag className="w-4 h-4 text-blue-600" />
									</div>
								</div>
								<div className="text-2xl mb-1">{vendor.totalOrders}</div>
								<div className="text-xs text-gray-500">
									{vendor.ordersPeriod}
								</div>
							</div>

							<div className="bg-white border border-gray-200 rounded-xl p-4">
								<div className="flex items-center justify-between mb-3">
									<span className="text-xs text-gray-600">Products</span>
									<div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
										<Package className="w-4 h-4 text-yellow-600" />
									</div>
								</div>
								<div className="text-2xl mb-1">{vendor.products}</div>
								<div className="text-xs text-gray-500">
									{vendor.productsType}
								</div>
							</div>

							<div className="bg-white border border-gray-200 rounded-xl p-4">
								<div className="flex items-center justify-between mb-3">
									<span className="text-xs text-gray-600">
										Compliance Score
									</span>
									<div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
										<Shield className="w-4 h-4 text-purple-600" />
									</div>
								</div>
								<div className="text-2xl mb-1">{vendor.complianceScore}%</div>
								<div className="text-xs text-green-600">
									{vendor.complianceLabel}
								</div>
							</div>
						</div>

						{/* Information Sections */}
						<div className="px-6 pb-6 grid grid-cols-3 gap-6">
							{/* Basic Information */}
							<div>
								<h3 className="text-sm mb-4">Basic Information</h3>
								<div className="space-y-3">
									<InfoItem icon="📍" label="Address" value={vendor.address} />
									<InfoItem
										icon="📞"
										label="Primary Contact"
										value={vendor.primaryContact}
									/>
									<InfoItem icon="✉️" label="Email" value={vendor.email} />
									<InfoItem icon="🌐" label="Web" value={vendor.website} />
									<InfoItem
										icon="📅"
										label="Join Date"
										value={vendor.joinDate}
									/>
									<InfoItem
										icon="📄"
										label="Documents"
										value={vendor.documents}
									/>
								</div>
							</div>

							{/* Financial Metrics */}
							<div>
								<h3 className="text-sm mb-4">Financial Metrics</h3>
								<div className="space-y-3">
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Total Revenue</span>
										<span>₹{vendor.totalRevenue.toLocaleString("en-IN")}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Avg Order Value</span>
										<span>₹{vendor.avgOrderValue}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Refund Rate</span>
										<span>{vendor.refundRate}%</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Commission Rate</span>
										<span>{vendor.commissionRate}%</span>
									</div>
								</div>
							</div>

							{/* Payment Info */}
							<div>
								<h3 className="text-sm mb-4">Payment Info</h3>
								<div className="space-y-3">
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Payment Method</span>
										<span>{vendor.paymentMethod}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Bank Account</span>
										<span>{vendor.bankAccount}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Frequency</span>
										<span>{vendor.frequency}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-gray-600">Tax ID</span>
										<span>{vendor.taxId}</span>
									</div>
								</div>
							</div>
						</div>

						{/* Recent Orders */}
						<div className="px-6 pb-6">
							<h3 className="text-sm mb-4">Recent Orders</h3>
							<div className="space-y-2">
								{vendor.recentOrders.map((order, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0"
									>
										<div>
											<div className="text-sm">{order.service}</div>
											<div className="text-xs text-gray-500">
												{order.customer}
											</div>
										</div>
										<div className="text-sm">₹{order.amount}</div>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function InfoItem({
	icon,
	label,
	value,
}: {
	icon: string;
	label: string;
	value: string;
}) {
	return (
		<div className="text-sm">
			<div className="flex items-center gap-2 text-gray-600 mb-1">
				<span className="text-blue-600">{icon}</span>
				<span className="text-xs">{label}</span>
			</div>
			<div className="text-gray-900 ml-6">{value}</div>
		</div>
	);
}
