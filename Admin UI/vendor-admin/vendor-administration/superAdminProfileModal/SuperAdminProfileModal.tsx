import { X, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@repo/ui";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";

interface AdminProfile {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	location: string;
	department: string;
	role: string;
	passwordLastChanged: string;
	twoFactorEnabled: boolean;
	apiKey: string | null;
	notifications: {
		emailNotification: boolean;
		pushNotification: boolean;
		weeklyDigest: boolean;
	};
	interface: {
		darkMode: boolean;
		autoRefreshDashboard: boolean;
	};
	recentActivity: Array<{
		id: string;
		action: string;
		category: string;
		timestamp: string;
		icon: string;
		color: string;
	}>;
}

interface SuperAdminProfileModalProps {
	isOpen: boolean;
	onClose: () => void;
	adminId?: string;
}

export function SuperAdminProfileModal({
	isOpen,
	onClose,
	adminId = "admin_1",
}: SuperAdminProfileModalProps) {
	const [profile, setProfile] = useState<AdminProfile | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (isOpen) {
			loadProfile();
		}
	}, [isOpen, adminId]);

	const loadProfile = async () => {
		try {
			setLoading(true);

			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/profile/${adminId}`,
				{
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setProfile(data.profile);
			}
		} catch (error) {
			console.error("Error loading admin profile:", error);
		} finally {
			setLoading(false);
		}
	};

	const updateProfile = async (updates: Partial<AdminProfile>) => {
		try {
			setSaving(true);

			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/profile/${adminId}`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(updates),
				}
			);

			if (response.ok) {
				const data = await response.json();
				setProfile(data.profile);
			}
		} catch (error) {
			console.error("Error updating admin profile:", error);
		} finally {
			setSaving(false);
		}
	};

	const handleToggle = (
		section: "notifications" | "interface",
		key: string
	) => {
		if (!profile) return;

		const newProfile = {
			...profile,
			[section]: {
				...profile[section],
				[key]: !profile[section][key as keyof (typeof profile)[typeof section]],
			},
		};

		setProfile(newProfile);
		updateProfile({ [section]: newProfile[section] });
	};

	const handleChangePassword = () => {
		console.log("Change password clicked");
		// Open change password modal
	};

	const handleManage2FA = () => {
		console.log("Manage 2FA clicked");
		// Open 2FA management modal
	};

	const handleGenerateApiKey = async () => {
		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/profile/${adminId}/api-key`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setProfile((prev) => (prev ? { ...prev, apiKey: data.apiKey } : null));
			}
		} catch (error) {
			console.error("Error generating API key:", error);
		}
	};

	const handleExport = async () => {
		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/profile/${adminId}/export`,
				{
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
					},
				}
			);

			if (response.ok) {
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `admin-profile-${adminId}.json`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
			}
		} catch (error) {
			console.error("Error exporting profile:", error);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
				{loading || !profile ? (
					<div className="p-12 text-center">
						<div className="text-sm text-gray-500">Loading profile...</div>
					</div>
				) : (
					<>
						{/* Header */}
						<div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
							<div>
								<h2 className="text-lg mb-1">SUPER ADMIN USER</h2>
								<p className="text-sm text-gray-500">{profile.role}</p>
							</div>
							<div className="flex items-center gap-3">
								<Button
									variant="outline"
									className="gap-2"
									onClick={handleExport}
								>
									<Download className="w-4 h-4" />
									Export
								</Button>
								<button
									onClick={onClose}
									className="p-2 hover:bg-gray-100 rounded-lg"
								>
									<X className="w-5 h-5" />
								</button>
							</div>
						</div>

						{/* Content */}
						<div className="p-6">
							<div className="grid grid-cols-2 gap-6">
								{/* Left Column */}
								<div className="space-y-6">
									{/* Profile */}
									<div>
										<h3 className="text-sm mb-4">Profile</h3>
										<div className="space-y-4">
											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="text-sm text-gray-600 mb-1 block">
														First Name
													</label>
													<div className="text-sm">{profile.firstName}</div>
												</div>
												<div>
													<label className="text-sm text-gray-600 mb-1 block">
														Last Name
													</label>
													<div className="text-sm">{profile.lastName}</div>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="text-sm text-gray-600 mb-1 block">
														Email Address
													</label>
													<div className="text-sm">{profile.email}</div>
												</div>
												<div>
													<label className="text-sm text-gray-600 mb-1 block">
														Phone Number
													</label>
													<div className="text-sm">{profile.phone}</div>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-4">
												<div>
													<label className="text-sm text-gray-600 mb-1 block">
														Location
													</label>
													<div className="text-sm">{profile.location}</div>
												</div>
												<div>
													<label className="text-sm text-gray-600 mb-1 block">
														Department
													</label>
													<div className="text-sm">{profile.department}</div>
												</div>
											</div>
										</div>
									</div>

									{/* Password & Authentication */}
									<div>
										<h3 className="text-sm mb-4">Password & Authentication</h3>
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="text-sm text-gray-600">
													Last changed {profile.passwordLastChanged}
												</div>
												<Button
													onClick={handleChangePassword}
													className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-sm"
												>
													Change Password
												</Button>
											</div>

											<div className="flex items-center justify-between py-3 border-t border-gray-200">
												<div className="text-sm">Two-factor Authentication</div>
												<div className="flex items-center gap-3">
													<span
														className={`text-sm ${profile.twoFactorEnabled ? "text-green-600" : "text-gray-500"}`}
													>
														{profile.twoFactorEnabled ? "Enabled" : "Disabled"}
													</span>
													<span className="text-gray-400">|</span>
													<button
														onClick={handleManage2FA}
														className="text-sm text-blue-600 hover:underline"
													>
														Manage
													</button>
												</div>
											</div>
										</div>
									</div>

									{/* Recent Activity */}
									<div>
										<h3 className="text-sm mb-4">Recent Activity</h3>
										<div className="space-y-3">
											{profile.recentActivity.map((activity) => (
												<div
													key={activity.id}
													className="flex items-start gap-3"
												>
													<div
														className={`w-8 h-8 rounded-lg flex items-center justify-center ${activity.color}`}
													>
														<span className="text-sm">{activity.icon}</span>
													</div>
													<div className="flex-1">
														<div className="text-sm">{activity.action}</div>
														<div className="text-xs text-gray-500">
															{activity.category}
														</div>
													</div>
													<div className="text-xs text-gray-500">
														{activity.timestamp}
													</div>
												</div>
											))}
										</div>
									</div>
								</div>

								{/* Right Column */}
								<div className="space-y-6">
									{/* Notification Preferences */}
									<div>
										<h3 className="text-sm mb-4">Notification Preferences</h3>
										<div className="space-y-4">
											<div className="flex items-start justify-between">
												<div>
													<div className="text-sm mb-1">Email Notification</div>
													<div className="text-xs text-gray-500">
														Receive important updates via email
													</div>
												</div>
												<button
													onClick={() =>
														handleToggle("notifications", "emailNotification")
													}
													className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
														profile.notifications.emailNotification
															? "bg-blue-600"
															: "bg-gray-300"
													}`}
												>
													<span
														className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
															profile.notifications.emailNotification
																? "translate-x-6"
																: "translate-x-1"
														}`}
													/>
												</button>
											</div>

											<div className="flex items-start justify-between">
												<div>
													<div className="text-sm mb-1">Push Notification</div>
													<div className="text-xs text-gray-500">
														Browser Notification for urgent alerts
													</div>
												</div>
												<button
													onClick={() =>
														handleToggle("notifications", "pushNotification")
													}
													className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
														profile.notifications.pushNotification
															? "bg-blue-600"
															: "bg-gray-300"
													}`}
												>
													<span
														className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
															profile.notifications.pushNotification
																? "translate-x-6"
																: "translate-x-1"
														}`}
													/>
												</button>
											</div>

											<div className="flex items-start justify-between">
												<div>
													<div className="text-sm mb-1">Weekly Digest</div>
													<div className="text-xs text-gray-500">
														Summary of platform activity
													</div>
												</div>
												<button
													onClick={() =>
														handleToggle("notifications", "weeklyDigest")
													}
													className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
														profile.notifications.weeklyDigest
															? "bg-blue-600"
															: "bg-gray-300"
													}`}
												>
													<span
														className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
															profile.notifications.weeklyDigest
																? "translate-x-6"
																: "translate-x-1"
														}`}
													/>
												</button>
											</div>
										</div>
									</div>

									{/* Interface Preferences */}
									<div>
										<h3 className="text-sm mb-4">Interface Preferences</h3>
										<div className="space-y-4">
											<div className="flex items-start justify-between">
												<div className="text-sm">Dark Mode</div>
												<button
													onClick={() => handleToggle("interface", "darkMode")}
													className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
														profile.interface.darkMode
															? "bg-blue-600"
															: "bg-gray-300"
													}`}
												>
													<span
														className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
															profile.interface.darkMode
																? "translate-x-6"
																: "translate-x-1"
														}`}
													/>
												</button>
											</div>

											<div className="flex items-start justify-between">
												<div className="text-sm">Auto-refresh Dashboard</div>
												<button
													onClick={() =>
														handleToggle("interface", "autoRefreshDashboard")
													}
													className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
														profile.interface.autoRefreshDashboard
															? "bg-blue-600"
															: "bg-gray-300"
													}`}
												>
													<span
														className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
															profile.interface.autoRefreshDashboard
																? "translate-x-6"
																: "translate-x-1"
														}`}
													/>
												</button>
											</div>
										</div>
									</div>

									{/* API Access */}
									<div>
										<h3 className="text-sm mb-4">API Access</h3>
										<div>
											<div className="text-sm mb-1">API Key</div>
											<div className="text-xs text-gray-500 mb-3">
												For programmatic access to platform data
											</div>
											{profile.apiKey ? (
												<div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
													<code className="text-xs break-all">
														{profile.apiKey}
													</code>
												</div>
											) : null}
											<Button
												onClick={handleGenerateApiKey}
												variant="outline"
												className="w-full bg-black text-white hover:bg-gray-800"
											>
												{profile.apiKey ? "Regenerate Key" : "Generate Key"}
											</Button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
