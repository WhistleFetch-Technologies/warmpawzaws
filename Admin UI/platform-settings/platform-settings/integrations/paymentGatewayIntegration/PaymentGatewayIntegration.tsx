/**
 * Payment Gateway Integration Settings (Razorpay, Stripe, Paytm)
 * Admin component for configuring payment gateway credentials
 */

import React, { useState, useEffect } from "react";
import { Save, Check, AlertCircle, Key, CreditCard } from "lucide-react";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";
import { toast } from "sonner";

interface PaymentSettings {
	razorpay: {
		enabled: boolean;
		key_id: string;
		key_secret: string;
		webhook_secret: string;
		auto_capture: boolean;
		test_mode: boolean;
	};
	stripe: {
		enabled: boolean;
		publishable_key: string;
		secret_key: string;
		webhook_secret: string;
		test_mode: boolean;
	};
	paytm: {
		enabled: boolean;
		merchant_id: string;
		merchant_key: string;
		test_mode: boolean;
	};
	default_gateway: string;
	commission_percentage: number;
	settlement_period_days: number;
}

export function PaymentGatewayIntegration() {
	const [settings, setSettings] = useState<PaymentSettings>({
		razorpay: {
			enabled: false,
			key_id: "",
			key_secret: "",
			webhook_secret: "",
			auto_capture: true,
			test_mode: true,
		},
		stripe: {
			enabled: false,
			publishable_key: "",
			secret_key: "",
			webhook_secret: "",
			test_mode: true,
		},
		paytm: {
			enabled: false,
			merchant_id: "",
			merchant_key: "",
			test_mode: true,
		},
		default_gateway: "razorpay",
		commission_percentage: 15,
		settlement_period_days: 3,
	});

	const [loading, setLoading] = useState(false);
	const [saveStatus, setSaveStatus] = useState<
		"idle" | "saving" | "success" | "error"
	>("idle");
	const [activeTab, setActiveTab] = useState<"razorpay" | "stripe" | "paytm">(
		"razorpay"
	);

	useEffect(() => {
		fetchSettings();
	}, []);

	const fetchSettings = async () => {
		try {
			setLoading(true);
			const response = await fetch(
				`${getApiBaseUrl()}/admin/settings/payment-gateway`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				if (data.settings) {
					// Ensure all fields have values (no undefined)
					const loadedSettings = {
						razorpay: {
							enabled: data.settings.razorpay?.enabled || false,
							key_id: data.settings.razorpay?.key_id || "",
							key_secret: data.settings.razorpay?.key_secret || "",
							webhook_secret: data.settings.razorpay?.webhook_secret || "",
							auto_capture: data.settings.razorpay?.auto_capture !== false,
							test_mode: data.settings.razorpay?.test_mode || false,
						},
						stripe: {
							enabled: data.settings.stripe?.enabled || false,
							publishable_key: data.settings.stripe?.publishable_key || "",
							secret_key: data.settings.stripe?.secret_key || "",
							webhook_secret: data.settings.stripe?.webhook_secret || "",
							test_mode: data.settings.stripe?.test_mode || false,
						},
						paytm: {
							enabled: data.settings.paytm?.enabled || false,
							merchant_id: data.settings.paytm?.merchant_id || "",
							merchant_key: data.settings.paytm?.merchant_key || "",
							test_mode: data.settings.paytm?.test_mode || false,
						},
						default_gateway: data.settings.default_gateway || "razorpay",
						commission_percentage: data.settings.commission_percentage || 15,
						settlement_period_days: data.settings.settlement_period_days || 3,
					};
					setSettings(loadedSettings);
				}
			} else {
				const errorData = await response.json();
				console.error("Error fetching settings:", errorData);
				toast.error("Failed to load payment settings", {
					description: errorData.error || "Please try again",
				});
			}
		} catch (error) {
			console.error("Error fetching settings:", error);
			toast.error("Failed to load payment settings", {
				description: "Network error. Please check your connection.",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			setSaveStatus("saving");
			toast.info("Saving payment settings...");

			const response = await fetch(
				`${getApiBaseUrl()}/admin/settings/payment-gateway`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...getAuthHeaders(),
					},
					body: JSON.stringify(settings),
				}
			);

			if (response.ok) {
				const data = await response.json();
				setSaveStatus("success");
				toast.success("Payment settings saved successfully!", {
					description: "Your payment gateway configuration has been updated.",
				});
				setTimeout(() => setSaveStatus("idle"), 3000);
			} else {
				const errorData = await response.json();
				console.error("Error saving settings:", errorData);
				setSaveStatus("error");
				toast.error("Failed to save settings", {
					description: errorData.error || "Please try again",
				});
				setTimeout(() => setSaveStatus("idle"), 3000);
			}
		} catch (error) {
			console.error("Error saving settings:", error);
			setSaveStatus("error");
			toast.error("Failed to save settings", {
				description: "Network error. Please check your connection.",
			});
			setTimeout(() => setSaveStatus("idle"), 3000);
		}
	};

	const updateRazorpay = (key: string, value: any) => {
		setSettings({
			...settings,
			razorpay: {
				...settings.razorpay,
				[key]: value,
			},
		});
	};

	const updateStripe = (key: string, value: any) => {
		setSettings({
			...settings,
			stripe: {
				...settings.stripe,
				[key]: value,
			},
		});
	};

	const updatePaytm = (key: string, value: any) => {
		setSettings({
			...settings,
			paytm: {
				...settings.paytm,
				[key]: value,
			},
		});
	};

	if (loading) {
		return <div className="p-8 text-center">Loading settings...</div>;
	}

	return (
		<div className="max-w-4xl mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="bg-white rounded-lg shadow-sm p-6">
				<div className="flex items-center gap-3 mb-4">
					<CreditCard className="w-6 h-6 text-blue-600" />
					<h2 className="text-2xl font-bold">Payment Gateway Integration</h2>
				</div>
				<p className="text-gray-600">
					Configure your payment gateway credentials and settings. All
					credentials are securely stored.
				</p>
			</div>

			{/* Tabs */}
			<div className="bg-white rounded-lg shadow-sm">
				<div className="border-b border-gray-200">
					<div className="flex gap-4 px-6">
						<button
							onClick={() => setActiveTab("razorpay")}
							className={`py-4 px-4 border-b-2 transition-colors ${
								activeTab === "razorpay"
									? "border-blue-600 text-blue-600 font-medium"
									: "border-transparent text-gray-600 hover:text-gray-900"
							}`}
						>
							Razorpay
							{settings.razorpay.enabled && (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									Active
								</span>
							)}
						</button>
						<button
							onClick={() => setActiveTab("stripe")}
							className={`py-4 px-4 border-b-2 transition-colors ${
								activeTab === "stripe"
									? "border-blue-600 text-blue-600 font-medium"
									: "border-transparent text-gray-600 hover:text-gray-900"
							}`}
						>
							Stripe
							{settings.stripe.enabled && (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									Active
								</span>
							)}
						</button>
						<button
							onClick={() => setActiveTab("paytm")}
							className={`py-4 px-4 border-b-2 transition-colors ${
								activeTab === "paytm"
									? "border-blue-600 text-blue-600 font-medium"
									: "border-transparent text-gray-600 hover:text-gray-900"
							}`}
						>
							Paytm
							{settings.paytm.enabled && (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									Active
								</span>
							)}
						</button>
					</div>
				</div>

				<div className="p-6 space-y-6">
					{/* Razorpay Settings */}
					{activeTab === "razorpay" && (
						<div className="space-y-4">
							<div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
								<div>
									<h3 className="font-medium text-blue-900">
										Razorpay Integration
									</h3>
									<p className="text-sm text-blue-700">
										Get your credentials from{" "}
										<a
											href="https://dashboard.razorpay.com/app/keys"
											target="_blank"
											rel="noopener noreferrer"
											className="underline"
										>
											Razorpay Dashboard
										</a>
									</p>
								</div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.razorpay.enabled}
										onChange={(e) =>
											updateRazorpay("enabled", e.target.checked)
										}
										className="w-5 h-5 rounded"
									/>
									<span className="font-medium">Enable</span>
								</label>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Key ID
								</label>
								<input
									type="text"
									value={settings.razorpay.key_id}
									onChange={(e) => updateRazorpay("key_id", e.target.value)}
									placeholder="rzp_test_xxxxx or rzp_live_xxxxx"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Key Secret
								</label>
								<input
									type="password"
									value={settings.razorpay.key_secret}
									onChange={(e) => updateRazorpay("key_secret", e.target.value)}
									placeholder="Your Razorpay key secret"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Webhook Secret
								</label>
								<input
									type="password"
									value={settings.razorpay.webhook_secret}
									onChange={(e) =>
										updateRazorpay("webhook_secret", e.target.value)
									}
									placeholder="whsec_xxxxx"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
								/>
								<p className="mt-1 text-xs text-gray-500">
									Webhook URL: {getApiBaseUrl()}/payments/razorpay/webhook
								</p>
							</div>

							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.razorpay.auto_capture}
										onChange={(e) =>
											updateRazorpay("auto_capture", e.target.checked)
										}
										className="w-4 h-4 rounded"
									/>
									<span className="text-sm">Auto-capture payments</span>
								</label>

								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.razorpay.test_mode}
										onChange={(e) =>
											updateRazorpay("test_mode", e.target.checked)
										}
										className="w-4 h-4 rounded"
									/>
									<span className="text-sm">Test mode</span>
								</label>
							</div>
						</div>
					)}

					{/* Stripe Settings */}
					{activeTab === "stripe" && (
						<div className="space-y-4">
							<div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
								<div>
									<h3 className="font-medium text-purple-900">
										Stripe Integration
									</h3>
									<p className="text-sm text-purple-700">
										Get your credentials from{" "}
										<a
											href="https://dashboard.stripe.com/apikeys"
											target="_blank"
											rel="noopener noreferrer"
											className="underline"
										>
											Stripe Dashboard
										</a>
									</p>
								</div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.stripe.enabled}
										onChange={(e) => updateStripe("enabled", e.target.checked)}
										className="w-5 h-5 rounded"
									/>
									<span className="font-medium">Enable</span>
								</label>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Publishable Key
								</label>
								<input
									type="text"
									value={settings.stripe.publishable_key}
									onChange={(e) =>
										updateStripe("publishable_key", e.target.value)
									}
									placeholder="pk_test_xxxxx or pk_live_xxxxx"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Secret Key
								</label>
								<input
									type="password"
									value={settings.stripe.secret_key}
									onChange={(e) => updateStripe("secret_key", e.target.value)}
									placeholder="sk_test_xxxxx or sk_live_xxxxx"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Webhook Secret
								</label>
								<input
									type="password"
									value={settings.stripe.webhook_secret}
									onChange={(e) =>
										updateStripe("webhook_secret", e.target.value)
									}
									placeholder="whsec_xxxxx"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
								/>
							</div>

							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.stripe.test_mode}
									onChange={(e) => updateStripe("test_mode", e.target.checked)}
									className="w-4 h-4 rounded"
								/>
								<span className="text-sm">Test mode</span>
							</label>
						</div>
					)}

					{/* Paytm Settings */}
					{activeTab === "paytm" && (
						<div className="space-y-4">
							<div className="flex items-center justify-between p-4 bg-cyan-50 rounded-lg">
								<div>
									<h3 className="font-medium text-cyan-900">
										Paytm Integration
									</h3>
									<p className="text-sm text-cyan-700">
										Get your credentials from Paytm Business Dashboard
									</p>
								</div>
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.paytm.enabled}
										onChange={(e) => updatePaytm("enabled", e.target.checked)}
										className="w-5 h-5 rounded"
									/>
									<span className="font-medium">Enable</span>
								</label>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Merchant ID
								</label>
								<input
									type="text"
									value={settings.paytm.merchant_id}
									onChange={(e) => updatePaytm("merchant_id", e.target.value)}
									placeholder="Your Paytm merchant ID"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Merchant Key
								</label>
								<input
									type="password"
									value={settings.paytm.merchant_key}
									onChange={(e) => updatePaytm("merchant_key", e.target.value)}
									placeholder="Your Paytm merchant key"
									className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
								/>
							</div>

							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.paytm.test_mode}
									onChange={(e) => updatePaytm("test_mode", e.target.checked)}
									className="w-4 h-4 rounded"
								/>
								<span className="text-sm">Test mode</span>
							</label>
						</div>
					)}
				</div>
			</div>

			{/* General Settings */}
			<div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
				<h3 className="text-lg font-bold mb-4">General Settings</h3>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-2">
						Default Payment Gateway
					</label>
					<select
						value={settings.default_gateway}
						onChange={(e) =>
							setSettings({ ...settings, default_gateway: e.target.value })
						}
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
					>
						<option value="razorpay">Razorpay</option>
						<option value="stripe">Stripe</option>
						<option value="paytm">Paytm</option>
					</select>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Platform Commission (%)
						</label>
						<input
							type="number"
							value={settings.commission_percentage}
							onChange={(e) =>
								setSettings({
									...settings,
									commission_percentage: parseFloat(e.target.value),
								})
							}
							min="0"
							max="100"
							step="0.5"
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Settlement Period (Days)
						</label>
						<input
							type="number"
							value={settings.settlement_period_days}
							onChange={(e) =>
								setSettings({
									...settings,
									settlement_period_days: parseInt(e.target.value),
								})
							}
							min="0"
							max="30"
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
			</div>

			{/* Save Button */}
			<div className="flex items-center justify-end gap-4">
				{saveStatus === "success" && (
					<div className="flex items-center gap-2 text-green-600">
						<Check className="w-5 h-5" />
						<span>Settings saved successfully!</span>
					</div>
				)}
				{saveStatus === "error" && (
					<div className="flex items-center gap-2 text-red-600">
						<AlertCircle className="w-5 h-5" />
						<span>Failed to save settings</span>
					</div>
				)}
				<button
					onClick={handleSave}
					disabled={saveStatus === "saving"}
					className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
				>
					<Save className="w-5 h-5" />
					{saveStatus === "saving" ? "Saving..." : "Save Settings"}
				</button>
			</div>
		</div>
	);
}
