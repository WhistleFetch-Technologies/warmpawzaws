import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Badge,
} from "@repo/ui";
import { Star, TrendingUp, TrendingDown } from "lucide-react";

interface VendorPerformance {
	id: string;
	name: string;
	category: string;
	totalRevenue: number;
	totalBookings: number;
	rating: number;
	status: string;
	growth: number;
}

interface VendorPerformanceTableProps {
	data: VendorPerformance[];
}

export function VendorPerformanceTable({ data }: VendorPerformanceTableProps) {
	return (
		<div className="rounded-md border bg-white">
			<Table>
				<TableHeader>
					<TableRow className="bg-gray-50">
						<TableHead className="w-50">Vendor Name</TableHead>
						<TableHead>Category</TableHead>
						<TableHead className="text-right">Revenue</TableHead>
						<TableHead className="text-right">Bookings</TableHead>
						<TableHead className="text-center">Rating</TableHead>
						<TableHead className="text-center">Status</TableHead>
						<TableHead className="text-right">Growth</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{data.map((vendor) => (
						<TableRow key={vendor.id}>
							<TableCell className="font-medium">{vendor.name}</TableCell>
							<TableCell>{vendor.category}</TableCell>
							<TableCell className="text-right font-semibold text-gray-900">
								₹{(vendor.totalRevenue / 1000).toFixed(1)}K
							</TableCell>
							<TableCell className="text-right">
								{vendor.totalBookings}
							</TableCell>
							<TableCell className="text-center">
								<div className="flex items-center justify-center gap-1">
									<Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
									<span>{vendor.rating}</span>
								</div>
							</TableCell>
							<TableCell className="text-center">
								<Badge
									variant={vendor.status === "Active" ? "default" : "secondary"}
									className={
										vendor.status === "Active"
											? "bg-green-100 text-green-700 hover:bg-green-200 shadow-none"
											: "bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-none"
									}
								>
									{vendor.status}
								</Badge>
							</TableCell>
							<TableCell className="text-right">
								<div
									className={`flex items-center justify-end gap-1 ${vendor.growth >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{vendor.growth >= 0 ? (
										<TrendingUp className="w-4 h-4" />
									) : (
										<TrendingDown className="w-4 h-4" />
									)}
									{Math.abs(vendor.growth)}%
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
