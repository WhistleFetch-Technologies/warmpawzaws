import { useState, useEffect } from "react";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	Button,
	Card,
	Input,
	Label,
} from "@repo/ui";
import { getApiBaseUrl, getAuthHeaders, getAuthToken } from "@repo/utils/api-config";
import {
	Package,
	Truck,
	FileText,
	CheckCircle,
	Clock,
	AlertTriangle,
	MapPin,
} from "lucide-react";
import { toast } from "sonner";

interface ShiprocketOrderIntegrationProps {
	orderId: string;
	order: any;
	onUpdate?: () => void;
}

export function ShiprocketOrderIntegration({
	orderId,
	order,
	onUpdate,
}: ShiprocketOrderIntegrationProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [shiprocketOrder, setShiprocketOrder] = useState<any>(null);
	const [tracking, setTracking] = useState<any>(null);
	const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
	const [courierId, setCourierId] = useState("");

	const API_BASE = `${getApiBaseUrl()}`;

	const getAuthHeaders = () => ({
		apikey: getAuthToken(),
		...getAuthHeaders(),
		"Content-Type": "application/json",
	});

	// Check if Shiprocket order exists
	useEffect(() => {
		if (order.shiprocketOrderId) {
			setShiprocketOrder({
				orderId: order.shiprocketOrderId,
				shipmentId: order.shiprocketShipmentId,
				awbCode: order.shiprocketAwbCode,
				courierName: order.shiprocketCourierName,
			});
		}
	}, [order]);

	const handleCreateShiprocketOrder = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch(
				`${API_BASE}/ecommerce/orders/${orderId}/shiprocket/create`,
				{
					method: "POST",
					headers: getAuthHeaders(),
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to create Shiprocket order");
			}

			setShiprocketOrder(data.shiprocketOrder);
			toast.success("Shiprocket order created successfully!");
			if (onUpdate) onUpdate();
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Failed to create Shiprocket order";
			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleAssignAWB = async () => {
		if (!courierId) {
			toast.error("Please enter a Courier ID");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			const response = await fetch(
				`${API_BASE}/ecommerce/orders/${orderId}/shiprocket/assign-awb`,
				{
					method: "POST",
					headers: getAuthHeaders(),
					body: JSON.stringify({ courierId }),
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to assign AWB");
			}

			setShiprocketOrder((prev: any) => ({
				...prev,
				awbCode: data.awb.awb_code,
				courierName: data.awb.courier_name,
			}));

			toast.success("AWB assigned successfully!");
			setIsCourierModalOpen(false);
			if (onUpdate) onUpdate();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to assign AWB";
			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleGeneratePickup = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch(
				`${API_BASE}/ecommerce/orders/${orderId}/shiprocket/generate-pickup`,
				{
					method: "POST",
					headers: getAuthHeaders(),
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to generate pickup");
			}

			toast.success("Pickup generated successfully!");
			if (onUpdate) onUpdate();
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to generate pickup";
			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	const handleGetTracking = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch(
				`${API_BASE}/ecommerce/orders/${orderId}/shiprocket/tracking`,
				{ headers: getAuthHeaders() }
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to get tracking");
			}

			setTracking(data.tracking);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to get tracking";
			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="p-6 mt-6 bg-white border-blue-100 shadow-sm">
			<div className="flex items-center gap-2 mb-4">
				<Truck className="w-5 h-5 text-blue-600" />
				<h2 className="text-lg font-semibold text-gray-900">
					Shiprocket Logistics
				</h2>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
					<AlertTriangle className="w-4 h-4" />
					<p className="text-sm">{error}</p>
				</div>
			)}

			{!shiprocketOrder ? (
				<div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
					<Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
					<p className="text-gray-600 mb-4 text-sm">
						Create a Shiprocket order for this e-commerce order to enable
						shipping.
					</p>
					<Button
						onClick={handleCreateShiprocketOrder}
						disabled={loading}
						className="bg-blue-600 hover:bg-blue-700 text-white"
					>
						{loading ? "Creating..." : "Create Shiprocket Order"}
					</Button>
				</div>
			) : (
				<div className="space-y-6">
					{/* Shiprocket Order Info */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
						<div>
							<label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
								Shiprocket Order ID
							</label>
							<p className="text-sm font-semibold mt-1">
								{shiprocketOrder.orderId}
							</p>
						</div>
						<div>
							<label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
								Shipment ID
							</label>
							<p className="text-sm font-semibold mt-1">
								{shiprocketOrder.shipmentId}
							</p>
						</div>
						<div>
							<label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
								AWB Code
							</label>
							<p className="text-sm font-mono mt-1 text-blue-600">
								{shiprocketOrder.awbCode || "Pending Assignment"}
							</p>
						</div>
						<div>
							<label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
								Courier
							</label>
							<p className="text-sm font-semibold mt-1">
								{shiprocketOrder.courierName || "-"}
							</p>
						</div>
					</div>

					{/* Actions */}
					<div className="flex flex-wrap gap-3 pt-2">
						{!shiprocketOrder.awbCode && (
							<Button
								onClick={() => setIsCourierModalOpen(true)}
								disabled={loading}
								className="bg-green-600 hover:bg-green-700 text-white"
							>
								<FileText className="w-4 h-4 mr-2" />
								Assign AWB
							</Button>
						)}

						{shiprocketOrder.awbCode && (
							<>
								<Button
									onClick={handleGeneratePickup}
									disabled={loading}
									className="bg-purple-600 hover:bg-purple-700 text-white"
								>
									<Truck className="w-4 h-4 mr-2" />
									Generate Pickup
								</Button>

								<Button
									onClick={handleGetTracking}
									disabled={loading}
									variant="outline"
									className="border-blue-200 text-blue-700 hover:bg-blue-50"
								>
									<MapPin className="w-4 h-4 mr-2" />
									Get Tracking Status
								</Button>
							</>
						)}
					</div>

					{/* Tracking Display */}
					{tracking && (
						<div className="mt-4 border-t pt-4">
							<h3 className="font-semibold mb-4 flex items-center gap-2">
								<MapPin className="w-4 h-4 text-gray-500" />
								Tracking Timeline
							</h3>
							<div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
								{tracking.tracking_data?.shipment_track?.map(
									(event: any, index: number) => (
										<div key={index} className="relative">
											<div
												className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 border-white ring-1 ring-gray-200 bg-blue-500`}
											></div>
											<div className="flex flex-col">
												<p className="font-medium text-sm text-gray-900">
													{event.status}
												</p>
												<p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
													<MapPin className="w-3 h-3" /> {event.location}
												</p>
												<p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
													<Clock className="w-3 h-3" /> {event.date}
												</p>
											</div>
										</div>
									)
								)}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Courier Selection Modal */}
			<Dialog open={isCourierModalOpen} onOpenChange={setIsCourierModalOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Assign Courier AWB</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="courier" className="text-right">
								Courier ID
							</Label>
							<Input
								id="courier"
								value={courierId}
								onChange={(e) => setCourierId(e.target.value)}
								className="col-span-3"
								placeholder="e.g. 12"
							/>
						</div>
						<p className="text-xs text-gray-500 ml-auto pl-10">
							Enter the Courier ID from your Shiprocket dashboard serviceability
							check.
						</p>
					</div>
					<DialogFooter>
						<Button onClick={handleAssignAWB} disabled={loading}>
							{loading ? "Assigning..." : "Assign AWB"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
