/**
 * Payment Gateway Integration Settings (Razorpay, Stripe, Paytm)
 * Admin component for configuring payment gateway credentials
 */

import React, { useState, useEffect } from "react";
import { Save, Check, AlertCircle, Key, CreditCard } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Label,
	Button,
	Switch,
	IconEyeOff,
	IconEye,
} from "@warmpawz/ui";

interface PaymentSettings {
	razorpay: {
		enabled: boolean;
		key_id: string;
		key_secret: string;
		webhook_secret: string;
		/** RazorpayX current account / customer identifier (x.razorpay.com → Banking) — needed for UPI VPA fallback validation */
		razorpay_x_account_number: string;
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
			razorpay_x_account_number: "",
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
	const [showRazorpayKeySecret, setShowRazorpayKeySecret] = useState(false);

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
			const res = await apiClient.get<any>("/admin/settings/payment-gateway");

			if (res.success && res.settings && Array.isArray(res.settings)) {
				// Transform array response to object structure
				const settingsMap: any = {};

				res.settings.forEach((setting: any) => {
					const name = setting.integration_name;
					const config = setting.integration_config || {};

					if (name === 'razorpay') {
						settingsMap.razorpay = {
							enabled: setting.is_active || false,
							key_id: config.keyId || "",
							key_secret: config.keySecret || "",
							webhook_secret: config.webhookSecret || "",
							razorpay_x_account_number:
								config.razorpayXAccountNumber || config.xAccountNumber || "",
							auto_capture: config.auto_capture !== false,
							test_mode: config.test_mode || false,
						};
					} else if (name === 'stripe') {
						settingsMap.stripe = {
							enabled: setting.is_active || false,
							publishable_key: config.publishableKey || config.publishable_key || "",
							secret_key: config.secretKey || config.secret_key || "",
							webhook_secret: config.webhookSecret || config.webhook_secret || "",
							test_mode: config.test_mode || false,
						};
					} else if (name === 'paytm') {
						settingsMap.paytm = {
							enabled: setting.is_active || false,
							merchant_id: config.merchantId || config.merchant_id || "",
							merchant_key: config.merchantKey || config.merchant_key || "",
							test_mode: config.test_mode || false,
						};
					}
				});

				const loadedSettings = {
					razorpay: settingsMap.razorpay || {
						enabled: false,
						key_id: "",
						key_secret: "",
						webhook_secret: "",
						razorpay_x_account_number: "",
						auto_capture: true,
						test_mode: true,
					},
					stripe: settingsMap.stripe || {
						enabled: false,
						publishable_key: "",
						secret_key: "",
						webhook_secret: "",
						test_mode: true,
					},
					paytm: settingsMap.paytm || {
						enabled: false,
						merchant_id: "",
						merchant_key: "",
						test_mode: true,
					},
					default_gateway: settingsMap.default_gateway || "razorpay",
					commission_percentage: settingsMap.commission_percentage || 15,
					settlement_period_days: settingsMap.settlement_period_days || 3,
				};
				setSettings(loadedSettings);
			}
		} catch (error) {
			console.error("Error fetching settings:", error);
			toast.error("Failed to load payment settings", {
				description: "Please try again",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			setSaveStatus("saving");
			toast.info("Saving payment settings...");

			const res = await apiClient.post<any>(
				"/admin/settings/payment-gateway",
				settings
			);

			if (res.success) {
				setSaveStatus("success");
				toast.success("Payment settings saved successfully!", {
					description: "Your payment gateway configuration has been updated.",
				});
				setTimeout(() => setSaveStatus("idle"), 3000);
			} else {
				setSaveStatus("error");
				toast.error("Failed to save settings", {
					description: res.error || "Please try again",
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
							className={`py-4 px-4 border-b-2 transition-colors ${activeTab === "razorpay"
								? "border-blue-600 text-blue-600 font-medium"
								: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
						>
							Razorpay
							{settings.razorpay.enabled ? (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									Active
								</span>
							) : (<span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
								Not implemented
							</span>)}
						</button>
						<button
							onClick={() => setActiveTab("stripe")}
							className={`py-4 px-4 border-b-2 transition-colors ${activeTab === "stripe"
								? "border-blue-600 text-blue-600 font-medium"
								: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
						>
							Stripe
							{settings.stripe.enabled ? (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									Active
								</span>
							) : (<span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
								Not implemented
							</span>)}
						</button>
						<button
							onClick={() => setActiveTab("paytm")}
							className={`py-4 px-4 border-b-2 transition-colors ${activeTab === "paytm"
								? "border-blue-600 text-blue-600 font-medium"
								: "border-transparent text-gray-600 hover:text-gray-900"
								}`}
						>
							Paytm
							{settings.paytm.enabled ? (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
									Active
								</span>
							) : (<span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
								Not implemented
							</span>)}
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
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											updateRazorpay("enabled", e.target.checked)
										}
										className="w-5 h-5 rounded"
									/>
									<span className="font-medium">Enable</span>
								</label>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Key ID
								</Label>
								<Input
									type="text"
									value={settings.razorpay.key_id}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRazorpay("key_id", e.target.value)}
									placeholder="rzp_test_xxxxx or rzp_live_xxxxx"
									className="w-full"
								/>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Key Secret
								</Label>
								<div className="relative">
									<Input
										type={showRazorpayKeySecret ? "text" : "password"}
										value={settings.razorpay.key_secret}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
											updateRazorpay("key_secret", e.target.value)
										}
										placeholder="Your Razorpay key secret"
										className="w-full pr-10"
									/>
									<button
										type="button"
										onClick={() => setShowRazorpayKeySecret(!showRazorpayKeySecret)}
										className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
									>
										{showRazorpayKeySecret ? (
											<IconEyeOff className="w-4 h-4" />
										) : (
											<IconEye className="w-4 h-4" />
										)}
									</button>
								</div>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Webhook Secret
								</Label>
								<Input
									type="password"
									value={settings.razorpay.webhook_secret}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										updateRazorpay("webhook_secret", e.target.value)
									}
									placeholder="whsec_xxxxx"
									className="w-full"
								/>
								<p className="mt-1 text-xs text-gray-500">
									Webhook URL: Configure in your API Gateway settings
								</p>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									RazorpayX account number (customer identifier)
								</Label>
								<Input
									type="text"
									value={settings.razorpay.razorpay_x_account_number}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										updateRazorpay("razorpay_x_account_number", e.target.value)
									}
									placeholder="From RazorpayX → Banking → Customer Identifier"
									className="w-full"
								/>
								<p className="mt-1 text-xs text-gray-500">
									If Razorpay&apos;s standard UPI VPA validate API is not enabled on your account, vendor UPI
									verification uses RazorpayX fund-account validation instead — this value is required for that
									fallback. Alternatively set the Lambda env var{" "}
									<code className="rounded bg-gray-100 px-1">RAZORPAY_X_ACCOUNT_NUMBER</code> or add{" "}
									<code className="rounded bg-gray-100 px-1">razorpayXAccountNumber</code> to the Razorpay JSON
									secret in AWS Secrets Manager.
								</p>
							</div>

							<div className="flex items-center gap-4">
								<label className="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.razorpay.auto_capture}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
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
										onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
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
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStripe("enabled", e.target.checked)}
										className="w-5 h-5 rounded"
									/>
									<span className="font-medium">Enable</span>
								</label>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Publishable Key
								</Label>
								<Input
									type="text"
									value={settings.stripe.publishable_key}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										updateStripe("publishable_key", e.target.value)
									}
									placeholder="pk_test_xxxxx or pk_live_xxxxx"
									className="w-full"
								/>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Secret Key
								</Label>
								<Input
									type="password"
									value={settings.stripe.secret_key}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStripe("secret_key", e.target.value)}
									placeholder="sk_test_xxxxx or sk_live_xxxxx"
									className="w-full"
								/>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Webhook Secret
								</Label>
								<Input
									type="password"
									value={settings.stripe.webhook_secret}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										updateStripe("webhook_secret", e.target.value)
									}
									placeholder="whsec_xxxxx"
									className="w-full"
								/>
							</div>

							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.stripe.test_mode}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStripe("test_mode", e.target.checked)}
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
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePaytm("enabled", e.target.checked)}
										className="w-5 h-5 rounded"
									/>
									<span className="font-medium">Enable</span>
								</label>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Merchant ID
								</Label>
								<Input
									type="text"
									value={settings.paytm.merchant_id}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePaytm("merchant_id", e.target.value)}
									placeholder="Your Paytm merchant ID"
									className="w-full"
								/>
							</div>

							<div>
								<Label className="block text-sm font-medium text-gray-700 mb-2">
									Merchant Key
								</Label>
								<Input
									type="password"
									value={settings.paytm.merchant_key}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePaytm("merchant_key", e.target.value)}
									placeholder="Your Paytm merchant key"
									className="w-full"
								/>
							</div>

							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={settings.paytm.test_mode}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePaytm("test_mode", e.target.checked)}
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
					<Label className="block text-sm font-medium text-gray-700 mb-2">
						Default Payment Gateway
					</Label>
					<select
						value={settings.default_gateway}
						onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
							setSettings({ ...settings, default_gateway: e.target.value })
						}
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
					>
						<option value="razorpay">Razorpay</option>
						<option value="stripe">Stripe</option>
						<option value="paytm">Paytm</option>
					</select>
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
				<Button
					onClick={handleSave}
					disabled={saveStatus === "saving"}
					className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
				>
					<Save className="w-5 h-5" />
					{saveStatus === "saving" ? "Saving..." : "Save Settings"}
				</Button>
			</div>
		</div>
	);
}

