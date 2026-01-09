import { useState, useEffect } from "react";
import { Button, Input, Label, Switch, LoadingState } from "@repo/ui";

import { projectId, publicAnonKey } from "@repo/utils/supabase/info";

import { CheckCircle, AlertCircle, Save, Globe, Mail, Key } from "lucide-react";
import { toast } from "sonner";

interface ShiprocketConfig {
	enabled: boolean;
	baseUrl: string;
	email: string;
	apiKey: string;
}

export function ShiprocketConfig() {
	const [config, setConfig] = useState<ShiprocketConfig>({
		enabled: false,
		baseUrl: "https://apiv2.shiprocket.in",
		email: "",
		apiKey: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);

	const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

	useEffect(() => {
		fetchConfig();
	}, []);

	const getAuthHeaders = () => ({
		apikey: publicAnonKey,
		Authorization: `Bearer ${publicAnonKey}`,
		"Content-Type": "application/json",
	});

	const fetchConfig = async () => {
		try {
			setLoading(true);
			const response = await fetch(`${API_BASE}/admin/platform/settings`, {
				headers: getAuthHeaders(),
			});

			if (!response.ok) {
				throw new Error("Failed to fetch settings");
			}

			const data = await response.json();
			const shiprocket = data.settings?.integrations?.logistics?.shiprocket || {
				enabled: false,
				baseUrl: "https://apiv2.shiprocket.in",
				email: "",
				apiKey: "",
			};

			setConfig(shiprocket);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load configuration"
			);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			setError(null);

			// Get current settings first to preserve other settings
			const settingsResponse = await fetch(
				`${API_BASE}/admin/platform/settings`,
				{ headers: getAuthHeaders() }
			);
			const settingsData = await settingsResponse.json();
			const currentSettings = settingsData.settings || {};

			// Update Shiprocket config
			const updatedSettings = {
				...currentSettings,
				integrations: {
					...(currentSettings.integrations || {}),
					logistics: {
						...(currentSettings.integrations?.logistics || {}),
						shiprocket: {
							...config,
							updatedAt: new Date().toISOString(),
						},
					},
				},
			};

			const response = await fetch(`${API_BASE}/admin/platform/settings`, {
				method: "PUT",
				headers: getAuthHeaders(),
				body: JSON.stringify(updatedSettings),
			});

			if (!response.ok) {
				throw new Error("Failed to save configuration");
			}

			toast.success("Configuration saved successfully!");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save configuration"
			);
			toast.error("Failed to save configuration");
		} finally {
			setSaving(false);
		}
	};

	const handleTestConnection = async () => {
		try {
			setTesting(true);
			setTestResult(null);
			setError(null);

			const response = await fetch(
				`${API_BASE}/logistics/shiprocket/test-connection`,
				{ headers: getAuthHeaders() }
			);

			const data = await response.json();

			if (data.success) {
				setTestResult({
					success: true,
					message: data.message || "Connection successful!",
				});
				toast.success("Connection successful!");
			} else {
				setTestResult({
					success: false,
					message: data.message || data.error || "Connection failed",
				});
				toast.error(data.message || "Connection failed");
			}
		} catch (err) {
			setTestResult({
				success: false,
				message: err instanceof Error ? err.message : "Connection test failed",
			});
			toast.error("Connection test failed");
		} finally {
			setTesting(false);
		}
	};

	if (loading) {
		return <LoadingState message="Loading configuration..." />;
	}

	return (
		<div className="bg-white rounded-lg border shadow-sm">
			<div className="p-6 border-b">
				<h2 className="text-lg font-semibold flex items-center gap-2">
					<Globe className="w-5 h-5 text-indigo-600" />
					Shiprocket Configuration
				</h2>
				<p className="text-sm text-gray-500 mt-1">
					Configure Shiprocket logistics integration for automated shipping and
					order fulfillment
				</p>
			</div>

			<div className="p-6 space-y-6">
				{/* Enable/Disable Toggle */}
				<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
					<div>
						<label className="text-sm font-medium text-gray-900">
							Enable Shiprocket Integration
						</label>
						<p className="text-xs text-gray-500 mt-1">
							Toggle this to enable/disable automated shipping workflows
						</p>
					</div>
					<Switch
						checked={config.enabled}
						onCheckedChange={(checked) =>
							setConfig({ ...config, enabled: checked })
						}
					/>
				</div>

				{config.enabled && (
					<div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
						{/* Base URL */}
						<div className="space-y-2">
							<Label>Base URL</Label>
							<div className="relative">
								<Globe className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
								<Input
									type="text"
									value={config.baseUrl}
									onChange={(e) =>
										setConfig({ ...config, baseUrl: e.target.value })
									}
									className="pl-9"
									placeholder="https://apiv2.shiprocket.in"
								/>
							</div>
							<p className="text-xs text-gray-500">
								Shiprocket API base URL (Default: https://apiv2.shiprocket.in)
							</p>
						</div>

						{/* Email */}
						<div className="space-y-2">
							<Label>
								Account Email <span className="text-red-500">*</span>
							</Label>
							<div className="relative">
								<Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
								<Input
									type="email"
									value={config.email}
									onChange={(e) =>
										setConfig({ ...config, email: e.target.value })
									}
									className="pl-9"
									placeholder="your-email@example.com"
									required
								/>
							</div>
							<p className="text-xs text-gray-500">
								Your registered Shiprocket account email address
							</p>
						</div>

						{/* API Key */}
						<div className="space-y-2">
							<Label>
								API Key / Password <span className="text-red-500">*</span>
							</Label>
							<div className="relative">
								<Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
								<Input
									type="password"
									value={config.apiKey}
									onChange={(e) =>
										setConfig({ ...config, apiKey: e.target.value })
									}
									className="pl-9"
									placeholder="Enter your Shiprocket API key or password"
									required
								/>
							</div>
							<p className="text-xs text-gray-500">
								This is usually your Shiprocket account password or a generated
								API key
							</p>
						</div>

						{/* Test Connection */}
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="font-medium text-sm">Connection Status</h3>
									<p className="text-xs text-gray-500">
										Verify your credentials before saving
									</p>
								</div>
								<Button
									onClick={handleTestConnection}
									disabled={testing || !config.email || !config.apiKey}
									variant="outline"
									size="sm"
									className="gap-2"
								>
									{testing ? "Testing..." : "Test Connection"}
								</Button>
							</div>

							{testResult && (
								<div
									className={`p-3 rounded-md flex items-start gap-2 text-sm ${
										testResult.success
											? "bg-green-50 border border-green-200 text-green-700"
											: "bg-red-50 border border-red-200 text-red-700"
									}`}
								>
									{testResult.success ? (
										<CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600" />
									) : (
										<AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
									)}
									<div>
										<p className="font-medium">
											{testResult.success ? "Success" : "Error"}
										</p>
										<p>{testResult.message}</p>
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{error && (
					<div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-2">
						<AlertCircle className="w-5 h-5" />
						<p className="text-sm">{error}</p>
					</div>
				)}
			</div>

			<div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-lg">
				<Button
					onClick={handleSave}
					disabled={
						saving || (config.enabled && (!config.email || !config.apiKey))
					}
					className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
				>
					{saving ? "Saving..." : "Save Configuration"}
					<Save className="w-4 h-4" />
				</Button>
			</div>
		</div>
	);
}
