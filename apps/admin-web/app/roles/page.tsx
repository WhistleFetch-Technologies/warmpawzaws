"use client";

import { useState, useEffect } from "react";
import {
	Input,
	Button,
	Card,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Badge,
} from "@warmpawz/ui";

import {
	Shield,
	Users,
	Key,
	Plus,
	Edit,
	Trash2,
	CheckCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function RBACDashboard() {
	const router = useRouter();
	const [roles, setRoles] = useState<any[]>([]);
	const [permissions, setPermissions] = useState<any[]>([]);
	const [policies, setPolicies] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("roles");
	const [showRoleDialog, setShowRoleDialog] = useState(false);
	const [newRole, setNewRole] = useState({
		name: "",
		description: "",
		level: "1",
	});

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setLoading(true);
		try {
			// Load roles
			const rolesRes = await apiClient.get<any>("/admin/rbac/roles");
			if (rolesRes.success) {
				const allRoles = rolesRes.roles || [];
				
				// Deduplicate roles: keep only unique roles based on name (case-insensitive)
				const uniqueRolesMap = new Map<string, any>();
				allRoles.forEach((role: any) => {
					const normalizedName = (role.name || '').toLowerCase().trim();
					if (normalizedName) {
						// If we haven't seen this name before, or if current role is more recent/active
						if (!uniqueRolesMap.has(normalizedName)) {
							uniqueRolesMap.set(normalizedName, role);
						} else {
							// If duplicate found, keep the one that is:
							// 1. Active (if one is active and other isn't)
							// 2. More recent (based on created_at or updated_at)
							// 3. Has more complete data
							const existing = uniqueRolesMap.get(normalizedName);
							const existingIsActive = existing?.isActive !== false && existing?.is_active !== false;
							const currentIsActive = role?.isActive !== false && role?.is_active !== false;
							
							if (currentIsActive && !existingIsActive) {
								// Current is active, existing is not - keep current
								uniqueRolesMap.set(normalizedName, role);
							} else if (!currentIsActive && existingIsActive) {
								// Existing is active, current is not - keep existing
								// Do nothing
							} else {
								// Both same active status - keep the one with more recent date
								const existingDate = existing?.updated_at || existing?.created_at || '';
								const currentDate = role?.updated_at || role?.created_at || '';
								if (currentDate > existingDate) {
									uniqueRolesMap.set(normalizedName, role);
								}
							}
						}
					}
				});
				
				// Convert map back to array and sort
				const uniqueRoles = Array.from(uniqueRolesMap.values()).sort((a, b) => {
					const nameA = (a.name || '').toLowerCase();
					const nameB = (b.name || '').toLowerCase();
					return nameA.localeCompare(nameB);
				});
				
				setRoles(uniqueRoles);
				
				// Log if duplicates were found
				if (allRoles.length > uniqueRoles.length) {
					const duplicateCount = allRoles.length - uniqueRoles.length;
					console.log(`Removed ${duplicateCount} duplicate role(s). Kept ${uniqueRoles.length} unique roles.`);
					toast.info(`Removed ${duplicateCount} duplicate role(s)`);
				}
			}

			// Load permissions
			const permissionsRes = await apiClient.get<any>("/admin/rbac/permissions");
			if (permissionsRes.success) {
				setPermissions(permissionsRes.permissions || []);
			}

			// Load policies
			const policiesRes = await apiClient.get<any>("/admin/rbac/policies");
			if (policiesRes.success) {
				setPolicies(policiesRes.policies || []);
			}
		} catch (error) {
			console.error("Error loading RBAC data:", error);
			toast.error("Failed to load RBAC data");
		} finally {
			setLoading(false);
		}
	};

	const createRole = async () => {
		if (!newRole.name || !newRole.description) {
			toast.error("Please fill in all required fields");
			return;
		}

		try {
			const res = await apiClient.post<any>("/admin/rbac/roles", {
				name: newRole.name,
				description: newRole.description,
				level: parseInt(newRole.level),
			});

			if (res.success) {
				toast.success("Role created successfully");
				setShowRoleDialog(false);
				setNewRole({ name: "", description: "", level: "1" });
				loadData();
			}
		} catch (error) {
			console.error("Error creating role:", error);
			toast.error("Failed to create role");
		}
	};

	const handleDeleteRole = async (roleId: string) => {
		if (!roleId) {
			toast.error("Role ID is required");
			return;
		}

		// Confirm deletion
		if (!confirm("Are you sure you want to delete this role? This action cannot be undone.")) {
			return;
		}

		try {
			const res = await apiClient.delete<any>(`/admin/rbac/roles/${roleId}`);
			
			if (res.success || res.message) {
				toast.success(res.message || "Role deleted successfully");
				loadData(); // Reload roles list
			} else {
				throw new Error(res.error || "Failed to delete role");
			}
		} catch (error: any) {
			console.error("Error deleting role:", error);
			const errorMessage = error?.message || error?.error || "Failed to delete role";
			toast.error(errorMessage);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading RBAC data...</p>
				</div>
			</div>
		);
	}

	// Group permissions by category
	const permissionsByCategory = permissions.reduce((acc: any, perm: any) => {
		const category = perm.category || "other";
		if (!acc[category]) acc[category] = [];
		acc[category].push(perm);
		return acc;
	}, {});

	return (
		<AdminLayout>
			<div className="flex-1 flex flex-col min-h-screen bg-gray-50">
				{/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 */}
				<div className="bg-white border-b sticky top-0 z-10">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between h-16">
							<div className="flex items-center gap-4">
								<div>
									{/* ✅ FIX: Match wireframe - text-xl font-semibold */}
									<h1 className="text-xl font-semibold">
										Role & User Management
									</h1>
									<p className="text-sm text-gray-500">
										Manage roles, permissions, and access policies
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<Button
									onClick={() => setShowRoleDialog(true)}
									className="bg-[#FF8C42] hover:bg-[#ff7a28]"
								>
									<Plus className="w-4 h-4 mr-2" />
									Create Role
								</Button>
							</div>
						</div>
					</div>
				</div>

				{/* Content - Match wireframe: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 */}
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					{/* Summary Cards */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
						<Card className="p-6">
							<div className="flex items-center justify-between mb-4">
								<div className="bg-blue-500 text-white p-3 rounded-lg">
									<Shield className="w-5 h-5" />
								</div>
							</div>
							<h3 className="text-2xl font-bold mb-1">{roles.length}</h3>
							<p className="text-sm text-gray-500">Total Roles</p>
						</Card>

						<Card className="p-6">
							<div className="flex items-center justify-between mb-4">
								<div className="bg-green-500 text-white p-3 rounded-lg">
									<Key className="w-5 h-5" />
								</div>
							</div>
							<h3 className="text-2xl font-bold mb-1">{permissions.length}</h3>
							<p className="text-sm text-gray-500">Permissions</p>
						</Card>

						<Card className="p-6">
							<div className="flex items-center justify-between mb-4">
								<div className="bg-purple-500 text-white p-3 rounded-lg">
									<Users className="w-5 h-5" />
								</div>
							</div>
							<h3 className="text-2xl font-bold mb-1">{policies.length}</h3>
							<p className="text-sm text-gray-500">Access Policies</p>
						</Card>
					</div>

					{/* Tabs */}
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="mb-6">
							<TabsTrigger value="roles">Roles</TabsTrigger>
							<TabsTrigger value="permissions">Permissions</TabsTrigger>
							<TabsTrigger value="policies">Policies</TabsTrigger>
						</TabsList>

						{/* Roles Tab */}
						<TabsContent value="roles">
							<Card className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-semibold">System Roles</h2>
								</div>

								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Role Name</TableHead>
												<TableHead>Description</TableHead>
												<TableHead>Permissions</TableHead>
												<TableHead>Level</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{roles.length === 0 ? (
												<TableRow>
													<TableCell colSpan={6} className="text-center py-12">
														<Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
														<p className="text-gray-500">No roles found</p>
													</TableCell>
												</TableRow>
											) : (
												roles.map((role) => (
													<TableRow key={role.id}>
														<TableCell className="font-medium">
															{role.name}
														</TableCell>
														<TableCell className="text-sm text-gray-500">
															{role.description}
														</TableCell>
														<TableCell>
															<Badge variant="outline">
																{role.permissions?.length || 0} permissions
															</Badge>
														</TableCell>
														<TableCell>
															<Badge>{role.level || 1}</Badge>
														</TableCell>
														<TableCell>
															<Badge
																className={
																	role.isActive
																		? "bg-green-100 text-green-800"
																		: "bg-gray-100 text-gray-800"
																}
															>
																{role.isActive ? "Active" : "Inactive"}
															</Badge>
														</TableCell>
														<TableCell>
															<div className="flex gap-2">
																<Button 
																	variant="ghost" 
																	size="sm"
																	onClick={() => {
																		// TODO: Implement edit functionality
																		toast.info("Edit functionality coming soon");
																	}}
																>
																	<Edit className="w-4 h-4" />
																</Button>
																{/* Show delete button for all roles except system roles - check all possible property names */}
																{!(role.isSystem || role.is_system_role || role.isSystemRole || role.is_system || role.system) && (
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-red-600 hover:text-red-700 hover:bg-red-50"
																		onClick={() => handleDeleteRole(role.id)}
																		title="Delete role"
																	>
																		<Trash2 className="w-4 h-4" />
																	</Button>
																)}
															</div>
														</TableCell>
													</TableRow>
												))
											)}
										</TableBody>
									</Table>
								</div>
							</Card>
						</TabsContent>

						{/* Permissions Tab */}
						<TabsContent value="permissions">
							<div className="space-y-6">
								{Object.keys(permissionsByCategory).length === 0 ? (
									<Card className="p-6">
										<div className="text-center py-12">
											<Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
											<p className="text-gray-500">No permissions found</p>
										</div>
									</Card>
								) : (
									Object.entries(permissionsByCategory).map(
										([category, perms]: [string, any]) => (
											<Card key={category} className="p-6">
												<h3 className="text-lg font-semibold mb-4 capitalize">
													{category} Permissions
												</h3>
												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
													{perms.map((perm: any) => (
														<div
															key={perm.key}
															className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
														>
															<CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
															<div>
																<p className="font-medium text-sm">{perm.name}</p>
																<p className="text-xs text-gray-500 mt-1">
																	{perm.description}
																</p>
																<Badge variant="outline" className="mt-2 text-xs">
																	{perm.key}
																</Badge>
															</div>
														</div>
													))}
												</div>
											</Card>
										)
									)
								)}
							</div>
						</TabsContent>

						{/* Policies Tab */}
						<TabsContent value="policies">
							<Card className="p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-semibold">Access Policies</h2>
									<Button className="bg-[#FF8C42] hover:bg-[#ff7a28]">
										<Plus className="w-4 h-4 mr-2" />
										Create Policy
									</Button>
								</div>

								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Policy Name</TableHead>
												<TableHead>Description</TableHead>
												<TableHead>Effect</TableHead>
												<TableHead>Priority</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{policies.length === 0 ? (
												<TableRow>
													<TableCell colSpan={6} className="text-center py-12">
														<Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
														<p className="text-gray-500">No policies configured</p>
													</TableCell>
												</TableRow>
											) : (
												policies.map((policy) => (
													<TableRow key={policy.id}>
														<TableCell className="font-medium">
															{policy.name}
														</TableCell>
														<TableCell className="text-sm text-gray-500">
															{policy.description}
														</TableCell>
														<TableCell>
															<Badge
																className={
																	policy.effect === "allow"
																		? "bg-green-100 text-green-800"
																		: "bg-red-100 text-red-800"
																}
															>
																{policy.effect}
															</Badge>
														</TableCell>
														<TableCell>{policy.priority}</TableCell>
														<TableCell>
															<Badge
																className={
																	policy.isActive
																		? "bg-green-100 text-green-800"
																		: "bg-gray-100 text-gray-800"
																}
															>
																{policy.isActive ? "Active" : "Inactive"}
															</Badge>
														</TableCell>
														<TableCell>
															<div className="flex gap-2">
																<Button variant="ghost" size="sm">
																	<Edit className="w-4 h-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	className="text-red-600"
																>
																	<Trash2 className="w-4 h-4" />
																</Button>
															</div>
														</TableCell>
													</TableRow>
												))
											)}
										</TableBody>
									</Table>
								</div>
							</Card>
						</TabsContent>
					</Tabs>
					</div>
				</div>
			</div>

			{/* Create Role Dialog */}
			<Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Role</DialogTitle>
						<DialogDescription>
							Define a new role with specific permissions
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="text-sm font-medium">Role Name</label>
							<Input
								placeholder="e.g., Content Manager"
								value={newRole.name}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setNewRole({ ...newRole, name: e.target.value })
								}
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Description</label>
							<Input
								placeholder="Describe the role's purpose"
								value={newRole.description}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setNewRole({ ...newRole, description: e.target.value })
								}
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Level</label>
							<Input
								type="number"
								placeholder="1-10"
								min="1"
								max="10"
								value={newRole.level}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setNewRole({ ...newRole, level: e.target.value })
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowRoleDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={createRole}
							className="bg-[#FF8C42] hover:bg-[#ff7a28]"
						>
							Create Role
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminLayout>
	);
}
