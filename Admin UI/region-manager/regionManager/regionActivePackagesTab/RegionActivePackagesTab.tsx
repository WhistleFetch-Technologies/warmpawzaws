import { useState, useEffect } from "react";
import { Card } from "@repo/ui";
import {
	Package,
	Loader2,
	ChevronDown,
	ChevronRight,
	Info,
} from "lucide-react";

import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";

interface RegionActivePackagesTabProps {
	regionId: string;
	regionName: string;
	currency: {
		code: string;
		symbol: string;
	};
}

interface PackagesByCategory {
	[category: string]: Array<{
		id: string;
		packageName: string;
		basePrice: number;
		symbol: string;
		finalPrice: number;
		taxRate: number;
	}>;
}

const CATEGORY_NAMES: Record<string, string> = {
	veterinary: "Veterinary Services",
	grooming: "Grooming & Spa",
	training: "Training & Behavior",
	walking: "Walking & Exercise",
	boarding: "Boarding & Daycare",
	petCafe: "Pet Cafe",
	insurance: "Insurance",
	pharmacy: "Pharmacy & Medicine",
	adoption: "Adoption Services",
	sunset: "Sunset Services",
	behavioral: "Behavioral Services",
};

const CATEGORY_COLORS: Record<
	string,
	{ bg: string; text: string; icon: string }
> = {
	veterinary: { bg: "bg-blue-100", text: "text-blue-700", icon: "🏥" },
	grooming: { bg: "bg-pink-100", text: "text-pink-700", icon: "✂️" },
	training: { bg: "bg-green-100", text: "text-green-700", icon: "🎓" },
	walking: { bg: "bg-yellow-100", text: "text-yellow-700", icon: "🐕" },
	boarding: { bg: "bg-purple-100", text: "text-purple-700", icon: "🏠" },
	petCafe: { bg: "bg-orange-100", text: "text-orange-700", icon: "☕" },
	insurance: { bg: "bg-indigo-100", text: "text-indigo-700", icon: "🛡️" },
	pharmacy: { bg: "bg-red-100", text: "text-red-700", icon: "💊" },
	adoption: { bg: "bg-teal-100", text: "text-teal-700", icon: "❤️" },
	sunset: { bg: "bg-gray-100", text: "text-gray-700", icon: "🌅" },
	behavioral: { bg: "bg-cyan-100", text: "text-cyan-700", icon: "🧠" },
};

export function RegionActivePackagesTab({
	regionId,
	regionName,
	currency,
}: RegionActivePackagesTabProps) {
	const [loading, setLoading] = useState(true);
	const [packages, setPackages] = useState<any[]>([]);
	const [packagesByCategory, setPackagesByCategory] =
		useState<PackagesByCategory>({});
	const [expandedCategories, setExpandedCategories] = useState<
		Record<string, boolean>
	>({});
	const [totalCount, setTotalCount] = useState(0);

	useEffect(() => {
		loadPackages();
	}, [regionId]);

	const loadPackages = async () => {
		try {
			setLoading(true);
			const response = await fetch(
				`${getApiBaseUrl()}/packages/by-region/${regionId}`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setPackages(data.packages || []);
				setTotalCount(data.count || 0);

				// Group by category
				const grouped: PackagesByCategory = {};
				(data.packages || []).forEach((pkg: any) => {
					const category = pkg.category || "uncategorized";
					if (!grouped[category]) {
						grouped[category] = [];
					}
					grouped[category].push({
						id: pkg.id,
						packageName: pkg.packageName,
						basePrice: pkg.currentRegionPricing?.basePrice || 0,
						symbol: pkg.currentRegionPricing?.symbol || currency.symbol,
						finalPrice: pkg.currentRegionPricing?.finalPrice || 0,
						taxRate: pkg.currentRegionPricing?.taxRate || 0,
					});
				});

				setPackagesByCategory(grouped);

				// Auto-expand all categories by default
				const expanded: Record<string, boolean> = {};
				Object.keys(grouped).forEach((cat) => {
					expanded[cat] = true;
				});
				setExpandedCategories(expanded);
			}
		} catch (error) {
			console.error("Error loading packages:", error);
		} finally {
			setLoading(false);
		}
	};

	const toggleCategory = (category: string) => {
		setExpandedCategories((prev) => ({
			...prev,
			[category]: !prev[category],
		}));
	};

	const formatPrice = (amount: number): string => {
		return `${currency.symbol}${amount.toFixed(2)}`;
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
			</div>
		);
	}

	if (totalCount === 0) {
		return (
			<Card className="p-12 text-center border-2 border-dashed border-gray-300">
				<Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
				<h3 className="text-lg mb-2">No active packages</h3>
				<p className="text-gray-600 mb-4">
					No packages are currently available in {regionName}
				</p>
				<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 max-w-md mx-auto">
					<Info className="w-4 h-4 inline mr-2" />
					Packages can be created from the Regional Packages section
				</div>
			</Card>
		);
	}

	const categories = Object.keys(packagesByCategory).sort();

	return (
		<div className="space-y-6">
			{/* Summary Card */}
			<Card className="p-6 border-2 border-gray-200 bg-gradient-to-br from-orange-50 to-white">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-2xl">
							{totalCount} Active {totalCount === 1 ? "Package" : "Packages"}
						</h3>
						<p className="text-gray-600 mt-1">Available in {regionName}</p>
					</div>
					<div className="text-right">
						<p className="text-sm text-gray-600">Categories</p>
						<p className="text-2xl">{categories.length}</p>
					</div>
				</div>
			</Card>

			{/* Packages by Category */}
			<div className="space-y-4">
				{categories.map((category) => {
					const categoryPackages = packagesByCategory[category];
					const isExpanded = expandedCategories[category];
					const categoryInfo = CATEGORY_COLORS[category] || {
						bg: "bg-gray-100",
						text: "text-gray-700",
						icon: "📦",
					};
					const categoryName = CATEGORY_NAMES[category] || category;

					// Calculate stats
					const avgPrice =
						categoryPackages.reduce((sum, pkg) => sum + pkg.finalPrice, 0) /
						categoryPackages.length;
					const minPrice = Math.min(
						...categoryPackages.map((p) => p.finalPrice)
					);
					const maxPrice = Math.max(
						...categoryPackages.map((p) => p.finalPrice)
					);

					return (
						<Card
							key={category || index}
							className="border-2 border-gray-200 overflow-hidden"
						>
							{/* Category Header */}
							<button
								onClick={() => toggleCategory(category)}
								className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
							>
								<div className="flex items-center gap-3">
									<span className="text-2xl">{categoryInfo.icon}</span>
									<div className="text-left">
										<h4 className="font-medium text-lg">{categoryName}</h4>
										<p className="text-sm text-gray-600">
											{categoryPackages.length}{" "}
											{categoryPackages.length === 1 ? "package" : "packages"}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-4">
									<div className="text-right hidden md:block">
										<p className="text-xs text-gray-500">Price Range</p>
										<p className="text-sm font-medium">
											{formatPrice(minPrice)} - {formatPrice(maxPrice)}
										</p>
									</div>

									{isExpanded ? (
										<ChevronDown className="w-5 h-5 text-gray-400" />
									) : (
										<ChevronRight className="w-5 h-5 text-gray-400" />
									)}
								</div>
							</button>

							{/* Package List */}
							{isExpanded && (
								<div className="border-t border-gray-200">
									{categoryPackages.map((pkg, index) => (
										<div
											key={pkg.id || `pkg-${index}`}
											className={`p-4 flex items-center justify-between ${
												index !== categoryPackages.length - 1
													? "border-b border-gray-100"
													: ""
											} hover:bg-gray-50 transition-colors`}
										>
											<div className="flex items-center gap-3 flex-1">
												<div className={`p-2 ${categoryInfo.bg} rounded-lg`}>
													<Package className={`w-4 h-4 ${categoryInfo.text}`} />
												</div>
												<div className="flex-1 min-w-0">
													<h5 className="font-medium truncate">
														{pkg.packageName}
													</h5>
													<p className="text-sm text-gray-600">
														Base: {formatPrice(pkg.basePrice)} + Tax (
														{pkg.taxRate}%)
													</p>
												</div>
											</div>

											<div className="text-right ml-4">
												<p className="text-xs text-gray-500">Final Price</p>
												<p className="text-lg font-bold text-green-600">
													{formatPrice(pkg.finalPrice)}
												</p>
											</div>
										</div>
									))}
								</div>
							)}
						</Card>
					);
				})}
			</div>

			{/* Overall Stats */}
			<Card className="p-6 border-2 border-gray-200">
				<h4 className="font-medium mb-4">Pricing Overview</h4>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="p-4 bg-blue-50 rounded-lg">
						<p className="text-sm text-blue-700 mb-1">Lowest Price</p>
						<p className="text-xl font-bold text-blue-900">
							{formatPrice(
								Math.min(
									...packages.map(
										(p) => p.currentRegionPricing?.finalPrice || 0
									)
								)
							)}
						</p>
					</div>

					<div className="p-4 bg-green-50 rounded-lg">
						<p className="text-sm text-green-700 mb-1">Average Price</p>
						<p className="text-xl font-bold text-green-900">
							{formatPrice(
								packages.reduce(
									(sum, p) => sum + (p.currentRegionPricing?.finalPrice || 0),
									0
								) / packages.length
							)}
						</p>
					</div>

					<div className="p-4 bg-purple-50 rounded-lg">
						<p className="text-sm text-purple-700 mb-1">Highest Price</p>
						<p className="text-xl font-bold text-purple-900">
							{formatPrice(
								Math.max(
									...packages.map(
										(p) => p.currentRegionPricing?.finalPrice || 0
									)
								)
							)}
						</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
