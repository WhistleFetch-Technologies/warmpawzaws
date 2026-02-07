import { useState, useEffect } from "react";

import {
	Input,
	Label,
	Button,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Badge,
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@repo/ui";
import {
	Truck,
	CheckCircle,
	XCircle,
	Package,
	MapPin,
	Shield,
	AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";

export function DelhiveryConfig() {
	const [config, setConfig] = useState({
		enabled: false,
		apiKey: "",
		warehouseId: "",
		pickupLocation: {
			name: "",
			address: "",
			city: "",
			pincode: "",
			state: "",
			phone: "",
		},
	});
	const [testing, setTesting] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState<
		"unknown" | "connected" | "failed"
	>("unknown");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			const partners = await fetch(
				`${getApiBaseUrl()}/admin/integrations/logistics`,
				{
					headers: { ...getAuthHeaders() },
				}
			).then((r) => r.json());

			const delhivery = partners.partners?.find(
				(p: any) => p.id === "delhivery"
			);
			if (delhivery) {
				setConfig({
					enabled: delhivery.enabled || false,
					apiKey: delhivery.apiKey || "",
					warehouseId: delhivery.warehouseId || "",
					pickupLocation: delhivery.pickupLocation || {
						name: "",
						address: "",
						city: "",
						pincode: "",
						state: "",
						phone: "",
					},
				});
			}
		} catch (error) {
			console.error("Error loading Delhivery config:", error);
		}
	};

	const handleSave = async () => {
		try {
			setLoading(true);

			const partner = {
				id: "delhivery",
				name: "Delhivery",
				type: "pan_india",
				enabled: config.enabled,
				apiKey: config.apiKey,
				warehouseId: config.warehouseId,
				pickupLocation: config.pickupLocation,
				apiEndpoint: "https://track.delhivery.com/api",
			};

			const response = await fetch(
				`${getApiBaseUrl()}/admin/integrations/logistics/partner`,
				{
					method: "POST",
					headers: {
						...getAuthHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify(partner),
				}
			);

			const data = await response.json();
			if (data.success) {
				toast.success("Delhivery configuration saved successfully");
			} else {
				toast.error("Failed to save configuration");
			}
		} catch (error) {
			console.error("Error saving config:", error);
			toast.error("Failed to save configuration");
		} finally {
			setLoading(false);
		}
	};

	const testConnection = async () => {
		if (!config.apiKey) {
			toast.error("Please enter API key first");
			return;
		}

		try {
			setTesting(true);
			setConnectionStatus("unknown");

			const response = await fetch(
				`${getApiBaseUrl()}/delhivery/config`,
				{
					headers: { ...getAuthHeaders() },
				}
			);

			const data = await response.json();
			if (data.success && data.enabled) {
				setConnectionStatus("connected");
				toast.success("Successfully connected to Delhivery");
			} else {
				setConnectionStatus("failed");
				toast.error("Failed to connect to Delhivery");
			}
		} catch (error) {
			console.error("Connection test error:", error);
			setConnectionStatus("failed");
			toast.error("Connection test failed");
		} finally {
			setTesting(false);
		}
	};

	const checkPincodeServiceability = async (pincode: string) => {
		if (!pincode || pincode.length !== 6) {
			toast.error("Please enter a valid 6-digit pincode");
			return;
		}

		try {
			const response = await fetch(
				`${getApiBaseUrl()}/delhivery/pincode/check`,
				{
					method: "POST",
					headers: {
						...getAuthHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ pincode }),
				}
			);

			const data = await response.json();
			if (data.success && data.serviceable) {
				toast.success(`Pincode ${pincode} is serviceable`);
			} else {
				toast.error(`Pincode ${pincode} is not serviceable`);
			}
		} catch (error) {
			console.error("Serviceability check error:", error);
			toast.error("Failed to check serviceability");
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-orange-100 rounded-lg">
								<Truck className="w-6 h-6 text-orange-600" />
							</div>
							<div>
								<CardTitle>Delhivery Integration</CardTitle>
								<CardDescription>
									Configure Delhivery for pan-India delivery and COD
								</CardDescription>
							</div>
						</div>
						{connectionStatus !== "unknown" && (
							<Badge
								variant={
									connectionStatus === "connected" ? "default" : "destructive"
								}
								className="gap-1"
							>
								{connectionStatus === "connected" ? (
									<>
										<CheckCircle className="w-3 h-3" /> Connected
									</>
								) : (
									<>
										<XCircle className="w-3 h-3" /> Not Connected
									</>
								)}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="credentials" className="w-full">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="credentials">Credentials</TabsTrigger>
							<TabsTrigger value="pickup">Pickup Location</TabsTrigger>
							<TabsTrigger value="test">Test & Verify</TabsTrigger>
						</TabsList>

						<TabsContent value="credentials" className="space-y-4 mt-4">
							<div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
								<div className="space-y-0.5">
									<Label>Enable Delhivery</Label>
									<p className="text-xs text-muted-foreground">
										Activate Delhivery for order fulfillment
									</p>
								</div>
								<Switch
									checked={config.enabled}
									onCheckedChange={(c) => setConfig({ ...config, enabled: c })}
								/>
							</div>

							<div className="space-y-2">
								<Label>API Token *</Label>
								<Input
									type="password"
									value={config.apiKey}
									onChange={(e) =>
										setConfig({ ...config, apiKey: e.target.value })
									}
									placeholder="Enter your Delhivery API token"
									className="font-mono"
								/>
								<p className="text-xs text-muted-foreground flex items-center gap-1">
									<Shield className="w-3 h-3" />
									Get your API token from Delhivery dashboard
								</p>
							</div>

							<div className="space-y-2">
								<Label>Warehouse ID (Optional)</Label>
								<Input
									value={config.warehouseId}
									onChange={(e) =>
										setConfig({ ...config, warehouseId: e.target.value })
									}
									placeholder="Warehouse identifier"
								/>
							</div>

							<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
								<div className="flex items-start gap-2">
									<AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
									<div className="text-sm text-blue-900">
										<p className="font-medium mb-1">Delhivery Features</p>
										<ul className="list-disc list-inside space-y-1 text-xs">
											<li>
												Pan-India coverage with express & surface delivery
											</li>
											<li>COD (Cash on Delivery) support</li>
											<li>Real-time tracking & webhooks</li>
											<li>Automated NDR (Non-Delivery Report) management</li>
											<li>RTO (Return to Origin) handling</li>
										</ul>
									</div>
								</div>
							</div>
						</TabsContent>

						<TabsContent value="pickup" className="space-y-4 mt-4">
							<div className="space-y-2">
								<Label>Pickup Location Name *</Label>
								<Input
									value={config.pickupLocation.name}
									onChange={(e) =>
										setConfig({
											...config,
											pickupLocation: {
												...config.pickupLocation,
												name: e.target.value,
											},
										})
									}
									placeholder="e.g. Warehouse - Bangalore"
								/>
							</div>

							<div className="space-y-2">
								<Label>Address *</Label>
								<Input
									value={config.pickupLocation.address}
									onChange={(e) =>
										setConfig({
											...config,
											pickupLocation: {
												...config.pickupLocation,
												address: e.target.value,
											},
										})
									}
									placeholder="Street address"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>City *</Label>
									<Input
										value={config.pickupLocation.city}
										onChange={(e) =>
											setConfig({
												...config,
												pickupLocation: {
													...config.pickupLocation,
													city: e.target.value,
												},
											})
										}
										placeholder="City"
									/>
								</div>
								<div className="space-y-2">
									<Label>State *</Label>
									<Input
										value={config.pickupLocation.state}
										onChange={(e) =>
											setConfig({
												...config,
												pickupLocation: {
													...config.pickupLocation,
													state: e.target.value,
												},
											})
										}
										placeholder="State"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Pincode *</Label>
									<Input
										value={config.pickupLocation.pincode}
										onChange={(e) =>
											setConfig({
												...config,
												pickupLocation: {
													...config.pickupLocation,
													pincode: e.target.value,
												},
											})
										}
										placeholder="6-digit pincode"
										maxLength={6}
									/>
								</div>
								<div className="space-y-2">
									<Label>Phone *</Label>
									<Input
										value={config.pickupLocation.phone}
										onChange={(e) =>
											setConfig({
												...config,
												pickupLocation: {
													...config.pickupLocation,
													phone: e.target.value,
												},
											})
										}
										placeholder="Contact number"
									/>
								</div>
							</div>
						</TabsContent>

						<TabsContent value="test" className="space-y-4 mt-4">
							<Card className="border-green-200 bg-green-50/50">
								<CardHeader>
									<CardTitle className="text-base">Connection Test</CardTitle>
									<CardDescription>
										Verify your Delhivery API credentials
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button
										onClick={testConnection}
										disabled={testing || !config.apiKey}
										className="w-full"
									>
										{testing ? "Testing..." : "Test Connection"}
									</Button>
								</CardContent>
							</Card>

							<Card className="border-blue-200 bg-blue-50/50">
								<CardHeader>
									<CardTitle className="text-base">
										Pincode Serviceability Check
									</CardTitle>
									<CardDescription>
										Check if a pincode is serviceable by Delhivery
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex gap-2">
										<Input
											placeholder="Enter 6-digit pincode"
											maxLength={6}
											id="test-pincode"
										/>
										<Button
											onClick={() => {
												const input = document.getElementById(
													"test-pincode"
												) as HTMLInputElement;
												if (input) checkPincodeServiceability(input.value);
											}}
											disabled={!config.apiKey}
										>
											Check
										</Button>
									</div>
								</CardContent>
							</Card>

							<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
								<div className="flex items-start gap-2">
									<Package className="w-4 h-4 text-amber-600 mt-0.5" />
									<div className="text-sm text-amber-900">
										<p className="font-medium mb-1">API Documentation</p>
										<p className="text-xs">
											For detailed API documentation, visit:{" "}
											<a
												href="https://one.delhivery.com/developer-portal/documents/b2c/"
												target="_blank"
												rel="noopener noreferrer"
												className="underline hover:text-amber-700"
											>
												Delhivery B2C API Docs
											</a>
										</p>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>

					<div className="flex justify-end mt-6 pt-4 border-t">
						<Button
							onClick={handleSave}
							disabled={loading}
							className="bg-green-600 hover:bg-green-700"
						>
							Save Configuration
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
