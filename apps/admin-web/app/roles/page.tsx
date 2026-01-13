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
	ChevronDown,
	ChevronRight,
	Search,
	X,
	Save,
	Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// All 45 capabilities organized by category
const ALL_CAPABILITIES = {
	"Core Operations": [
		{ id: 'dashboard', name: 'Dashboard', description: 'Dashboard overview and stats' },
		{ id: 'bookings', name: 'Bookings', description: 'Manage appointments and bookings' },
		{ id: 'services', name: 'Services', description: 'Manage services catalog' },
		{ id: 'staff', name: 'Staff Management', description: 'Manage team members' },
		{ id: 'schedule', name: 'Schedule', description: 'Manage availability and schedules' },
		{ id: 'profile', name: 'Profile', description: 'Update vendor profile' },
	],
	"Finance & Payments": [
		{ id: 'earnings', name: 'Earnings', description: 'View earnings and revenue' },
		{ id: 'settlements', name: 'Settlements', description: 'View payouts and settlements' },
		{ id: 'bank_account', name: 'Bank Account', description: 'Manage bank details' },
		{ id: 'pricing', name: 'Pricing', description: 'Manage service pricing' },
	],
	"Communication": [
		{ id: 'chat', name: 'Chat', description: 'Messages and chat with customers' },
		{ id: 'notifications', name: 'Notifications', description: 'Send and manage notifications' },
		{ id: 'video_calling', name: 'Video Calling', description: 'Video consultations and calls' },
		{ id: 'tele', name: 'Tele Consultation', description: 'Telephone consultations' },
	],
	"Healthcare": [
		{ id: 'prescriptions', name: 'Prescriptions', description: 'Create and manage prescriptions' },
		{ id: 'medical_records', name: 'Medical Records', description: 'Access and manage medical records' },
		{ id: 'diagnostics', name: 'Diagnostics', description: 'Diagnostic tests and results' },
		{ id: 'pharmacy', name: 'Pharmacy', description: 'Pharmacy management and inventory' },
		{ id: 'emergency', name: 'Emergency Services', description: 'Emergency protocols and services' },
		{ id: 'emergency_protocols', name: 'Emergency Protocols', description: 'Emergency response protocols' },
		{ id: 'ambulance_services', name: 'Ambulance Services', description: 'Ambulance and emergency transport' },
		{ id: 'diagnostic_lab', name: 'Diagnostic Lab', description: 'Diagnostic laboratory services' },
		{ id: 'patient_monitoring', name: 'Patient Monitoring', description: 'Patient monitoring and tracking' },
		{ id: 'vet_summary', name: 'Vet Summary', description: 'Veterinary summary and reports' },
		{ id: 'prescription_verification', name: 'Prescription Verification', description: 'Verify and validate prescriptions' },
		{ id: 'controlled_substances', name: 'Controlled Substances', description: 'Manage controlled substances' },
		{ id: 'multi_doctor_management', name: 'Multi-Doctor Management', description: 'Manage multiple doctors/staff' },
	],
	"Specialized Services": [
		{ id: 'ambulance', name: 'Ambulance', description: 'Ambulance vehicles and services' },
		{ id: 'cafe_tables', name: 'Cafe Tables', description: 'Cafe table management' },
		{ id: 'table_management', name: 'Table Management', description: 'Manage tables, seating, and reservations' },
		{ id: 'rooms', name: 'Rooms', description: 'Resort/boarding rooms management' },
		{ id: 'room_management', name: 'Room Management', description: 'Manage rooms, occupancy, and bookings' },
		{ id: 'insurance_plans', name: 'Insurance Plans', description: 'Insurance plans and policies' },
		{ id: 'pet_profiles', name: 'Pet Profiles', description: 'Pet profiles for adoption' },
		{ id: 'meal_plans', name: 'Meal Plans', description: 'Meal plans and diet charts' },
		{ id: 'training_programs', name: 'Training Programs', description: 'Training programs and sessions' },
		{ id: 'walking', name: 'Walking', description: 'Walking services and routes' },
		{ id: 'pax_management', name: 'PAX Management', description: 'Manage party size and capacity' },
		{ id: 'occupancy_tracking', name: 'Occupancy Tracking', description: 'Track room/table occupancy' },
		{ id: 'nightly_pricing', name: 'Nightly Pricing', description: 'Nightly rates for rooms' },
		{ id: 'menu', name: 'Menu', description: 'Menu management for cafes/restaurants' },
		{ id: 'diet_charts', name: 'Diet Charts', description: 'Diet charts and meal planning' },
		{ id: 'counseling', name: 'Counseling', description: 'Counseling services' },
		{ id: 'adoption', name: 'Adoption', description: 'Pet adoption management' },
		{ id: 'donation', name: 'Donation', description: 'Donation management' },
		{ id: 'events', name: 'Events', description: 'Event management' },
		{ id: 'memorial', name: 'Memorial', description: 'Memorial services' },
		{ id: 'claims_management', name: 'Claims Management', description: 'Insurance claims management' },
		{ id: 'policy_management', name: 'Policy Management', description: 'Insurance policy management' },
	],
	"Operations": [
		{ id: 'inventory', name: 'Inventory', description: 'Inventory management and stock control' },
		{ id: 'orders', name: 'Orders', description: 'Order management and processing' },
		{ id: 'delivery', name: 'Delivery', description: 'Delivery tracking and management' },
		{ id: 'gps_tracking', name: 'GPS Tracking', description: 'GPS tracking for services and deliveries' },
		{ id: 'reports', name: 'Reports', description: 'Reports and analytics' },
		{ id: 'settings', name: 'Settings', description: 'Vendor settings and configuration' },
		{ id: 'catalog', name: 'Catalog', description: 'Product and service catalog management' },
		{ id: 'expiry_management', name: 'Expiry Management', description: 'Manage product expiry dates' },
		{ id: 'distance_pricing', name: 'Distance Pricing', description: 'Pricing based on distance' },
		{ id: 'staff_management', name: 'Staff Management', description: 'Comprehensive staff management' },
		{ id: 'schedule_management', name: 'Schedule Management', description: 'Advanced schedule management' },
		{ id: 'facility_management', name: 'Facility Management', description: 'Facility and location management' },
		{ id: 'custom_services', name: 'Custom Services', description: 'Create and manage custom services' },
	],
	"Advanced Features": [
		{ id: 'packages', name: 'Packages', description: 'Package management and bundles' },
		{ id: 'subscriptions', name: 'Subscriptions', description: 'Subscription management' },
		{ id: 'coupons', name: 'Coupons', description: 'Coupon management and discounts' },
		{ id: 'promotions', name: 'Promotions', description: 'Promotions and marketing campaigns' },
		{ id: 'reviews', name: 'Reviews', description: 'Review management and responses' },
		{ id: 'analytics', name: 'Analytics', description: 'Analytics dashboard and insights' },
		{ id: 'export', name: 'Export', description: 'Data export functionality' },
		{ id: 'integrations', name: 'Integrations', description: 'Third-party integrations' },
		{ id: 'package_management', name: 'Package Management', description: 'Package and bundle management' },
	],
	"Media": [
		{ id: 'photo_updates', name: 'Photo Updates', description: 'Photo updates and sharing' },
		{ id: 'gallery', name: 'Gallery', description: 'Photo gallery management' },
		{ id: 'portfolio', name: 'Portfolio', description: 'Portfolio showcase' },
		{ id: 'progress_tracking', name: 'Progress Tracking', description: 'Track progress with photos/videos' },
		{ id: 'cctv_access', name: 'CCTV Access', description: 'Access CCTV feeds' },
	],
};

// Get all capabilities as a flat array
const getAllCapabilitiesFlat = () => {
	const flat: { id: string; name: string; description: string; category: string }[] = [];
	Object.entries(ALL_CAPABILITIES).forEach(([category, caps]) => {
		caps.forEach(cap => flat.push({ ...cap, category }));
	});
	return flat;
};

interface RoleFormData {
	name: string;
	display_name: string;
	description: string;
	capabilities: string[];
	vendorTypes: string[];
	serviceStyles: string[];
	isActive: boolean;
}

const initialFormData: RoleFormData = {
	name: "",
	display_name: "",
	description: "",
	capabilities: [],
	vendorTypes: [],
	serviceStyles: [],
	isActive: true,
};

const VENDOR_TYPES = [
	{ id: 'healthcare_provider', name: 'Healthcare Provider' },
	{ id: 'service_provider', name: 'Service Provider' },
	{ id: 'seller', name: 'Seller' },
	{ id: 'organization', name: 'Organization' },
	{ id: 'ngo', name: 'NGO' },
	{ id: 'business', name: 'Business' },
];

const SERVICE_STYLES = [
	{ id: 'at_center', name: 'At Center' },
	{ id: 'at_home', name: 'At Home' },
	{ id: 'video_consultation', name: 'Video Consultation' },
	{ id: 'tele', name: 'Tele Consultation' },
	{ id: 'delivery', name: 'Delivery' },
	{ id: 'pickup', name: 'Pickup' },
	{ id: 'outdoor', name: 'Outdoor' },
];

export default function RBACDashboard() {
	const router = useRouter();
	const [roles, setRoles] = useState<any[]>([]);
	const [permissions, setPermissions] = useState<any[]>([]);
	const [policies, setPolicies] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState("roles");
	const [showRoleDialog, setShowRoleDialog] = useState(false);
	const [editingRole, setEditingRole] = useState<any>(null);
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedCategories, setExpandedCategories] = useState<string[]>(Object.keys(ALL_CAPABILITIES));
	const [formData, setFormData] = useState<RoleFormData>(initialFormData);

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

	const openCreateDialog = () => {
		setEditingRole(null);
		setFormData(initialFormData);
		setSearchQuery("");
		setExpandedCategories(Object.keys(ALL_CAPABILITIES));
		setShowRoleDialog(true);
	};

	const openEditDialog = (role: any) => {
		setEditingRole(role);
		setFormData({
			name: role.name || role.roleCode || "",
			display_name: role.display_name || role.roleName || "",
			description: role.description || "",
			capabilities: role.capabilities || role.permissions || [],
			vendorTypes: role.vendorTypes || [],
			serviceStyles: role.serviceStyles || [],
			isActive: role.isActive !== false,
		});
		setSearchQuery("");
		setExpandedCategories(Object.keys(ALL_CAPABILITIES));
		setShowRoleDialog(true);
	};

	const closeDialog = () => {
		setShowRoleDialog(false);
		setEditingRole(null);
		setFormData(initialFormData);
	};

	const toggleCapability = (capId: string) => {
		setFormData(prev => ({
			...prev,
			capabilities: prev.capabilities.includes(capId)
				? prev.capabilities.filter(c => c !== capId)
				: [...prev.capabilities, capId],
		}));
	};

	const toggleCategory = (category: string) => {
		const categoryCapIds = ALL_CAPABILITIES[category as keyof typeof ALL_CAPABILITIES]?.map(c => c.id) || [];
		const allSelected = categoryCapIds.every(id => formData.capabilities.includes(id));
		
		if (allSelected) {
			setFormData(prev => ({
				...prev,
				capabilities: prev.capabilities.filter(c => !categoryCapIds.includes(c)),
			}));
		} else {
			setFormData(prev => ({
				...prev,
				capabilities: [...new Set([...prev.capabilities, ...categoryCapIds])],
			}));
		}
	};

	const toggleExpandCategory = (category: string) => {
		setExpandedCategories(prev => 
			prev.includes(category)
				? prev.filter(c => c !== category)
				: [...prev, category]
		);
	};

	const toggleVendorType = (vtId: string) => {
		setFormData(prev => ({
			...prev,
			vendorTypes: prev.vendorTypes.includes(vtId)
				? prev.vendorTypes.filter(v => v !== vtId)
				: [...prev.vendorTypes, vtId],
		}));
	};

	const toggleServiceStyle = (ssId: string) => {
		setFormData(prev => ({
			...prev,
			serviceStyles: prev.serviceStyles.includes(ssId)
				? prev.serviceStyles.filter(s => s !== ssId)
				: [...prev.serviceStyles, ssId],
		}));
	};

	const selectAllCapabilities = () => {
		const allCaps = getAllCapabilitiesFlat().map(c => c.id);
		setFormData(prev => ({ ...prev, capabilities: allCaps }));
	};

	const clearAllCapabilities = () => {
		setFormData(prev => ({ ...prev, capabilities: [] }));
	};

	const getFilteredCapabilities = () => {
		if (!searchQuery.trim()) return ALL_CAPABILITIES;
		
		const query = searchQuery.toLowerCase();
		const filtered: typeof ALL_CAPABILITIES = {} as any;
		
		Object.entries(ALL_CAPABILITIES).forEach(([category, caps]) => {
			const matchingCaps = caps.filter(
				c => c.name.toLowerCase().includes(query) || 
					c.description.toLowerCase().includes(query) ||
					c.id.toLowerCase().includes(query)
			);
			if (matchingCaps.length > 0) {
				(filtered as any)[category] = matchingCaps;
			}
		});
		
		return filtered;
	};

	const saveRole = async () => {
		if (!formData.name || !formData.display_name) {
			toast.error("Role name and display name are required");
			return;
		}

		if (formData.capabilities.length === 0) {
			toast.error("Please select at least one capability");
			return;
		}

		try {
			setSaving(true);
			const payload = {
				name: formData.name.toLowerCase().replace(/\s+/g, '_'),
				display_name: formData.display_name,
				description: formData.description,
				capabilities: formData.capabilities,
				vendorTypes: formData.vendorTypes,
				serviceStyles: formData.serviceStyles,
				isActive: formData.isActive,
			};

			if (editingRole) {
				const res = await apiClient.put<any>(`/admin/roles/${editingRole.id}`, payload);
				if (res.success) {
					toast.success("Role updated successfully");
					closeDialog();
					loadData();
				} else {
					throw new Error(res.error || "Failed to update role");
				}
			} else {
				const res = await apiClient.post<any>("/admin/roles", payload);
				if (res.success) {
					toast.success("Role created successfully");
					closeDialog();
					loadData();
				} else {
					throw new Error(res.error || "Failed to create role");
				}
			}
		} catch (error: any) {
			console.error("Error saving role:", error);
			toast.error(error.message || "Failed to save role");
		} finally {
			setSaving(false);
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
									onClick={openCreateDialog}
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
																	onClick={() => openEditDialog(role)}
																	title="Edit role"
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

			{/* Create/Edit Role Dialog */}
			<Dialog open={showRoleDialog} onOpenChange={closeDialog}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
					<DialogHeader>
						<DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
						<DialogDescription>
							{editingRole ? "Update role configuration and capabilities" : "Define a new role with specific capabilities"}
						</DialogDescription>
					</DialogHeader>
					
					<div className="flex-1 overflow-y-auto space-y-6 py-4">
						{/* Basic Info */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-medium block mb-1">Display Name *</label>
								<Input
									placeholder="e.g., Pet Cafe"
									value={formData.display_name}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setFormData({ ...formData, display_name: e.target.value })
									}
								/>
							</div>
							<div>
								<label className="text-sm font-medium block mb-1">Role Code *</label>
								<Input
									placeholder="e.g., pet_cafe"
									value={formData.name}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										setFormData({ ...formData, name: e.target.value })
									}
								/>
							</div>
						</div>
						
						<div>
							<label className="text-sm font-medium block mb-1">Description</label>
							<Input
								placeholder="Describe the role's purpose..."
								value={formData.description}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setFormData({ ...formData, description: e.target.value })
								}
							/>
						</div>

						{/* Vendor Types */}
						<div>
							<label className="text-sm font-medium block mb-2">Vendor Types</label>
							<div className="flex flex-wrap gap-2">
								{VENDOR_TYPES.map(vt => (
									<button
										key={vt.id}
										type="button"
										onClick={() => toggleVendorType(vt.id)}
										className={`px-3 py-1 rounded-full text-sm border transition-colors ${
											formData.vendorTypes.includes(vt.id)
												? 'bg-[#FF8C42] text-white border-[#FF8C42]'
												: 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
										}`}
									>
										{vt.name}
									</button>
								))}
							</div>
						</div>

						{/* Service Styles */}
						<div>
							<label className="text-sm font-medium block mb-2">Service Styles</label>
							<div className="flex flex-wrap gap-2">
								{SERVICE_STYLES.map(ss => (
									<button
										key={ss.id}
										type="button"
										onClick={() => toggleServiceStyle(ss.id)}
										className={`px-3 py-1 rounded-full text-sm border transition-colors ${
											formData.serviceStyles.includes(ss.id)
												? 'bg-[#FF8C42] text-white border-[#FF8C42]'
												: 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
										}`}
									>
										{ss.name}
									</button>
								))}
							</div>
						</div>

						{/* Capabilities Selection */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<label className="text-sm font-medium">
									Capabilities ({formData.capabilities.length} selected)
								</label>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={selectAllCapabilities}
										className="text-xs text-blue-600 hover:underline"
									>
										Select All
									</button>
									<span className="text-gray-300">|</span>
									<button
										type="button"
										onClick={clearAllCapabilities}
										className="text-xs text-gray-600 hover:underline"
									>
										Clear All
									</button>
								</div>
							</div>
							
							{/* Search */}
							<div className="relative mb-3">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
								<Input
									placeholder="Search capabilities..."
									value={searchQuery}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
									className="pl-10"
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => setSearchQuery("")}
										className="absolute right-3 top-1/2 transform -translate-y-1/2"
									>
										<X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
									</button>
								)}
							</div>

							{/* Capabilities List */}
							<div className="border rounded-lg max-h-[300px] overflow-y-auto">
								{Object.entries(getFilteredCapabilities()).map(([category, caps]) => {
									const categoryCapIds = caps.map(c => c.id);
									const selectedCount = categoryCapIds.filter(id => formData.capabilities.includes(id)).length;
									const allSelected = selectedCount === caps.length;
									const someSelected = selectedCount > 0 && selectedCount < caps.length;
									const isExpanded = expandedCategories.includes(category);
									
									return (
										<div key={category} className="border-b last:border-b-0">
											{/* Category Header */}
											<div 
												className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
												onClick={() => toggleExpandCategory(category)}
											>
												<div className="flex items-center gap-2">
													{isExpanded ? (
														<ChevronDown className="w-4 h-4 text-gray-500" />
													) : (
														<ChevronRight className="w-4 h-4 text-gray-500" />
													)}
													<input
														type="checkbox"
														checked={allSelected}
														ref={checkbox => {
															if (checkbox) checkbox.indeterminate = someSelected;
														}}
														onChange={(e) => {
															e.stopPropagation();
															toggleCategory(category);
														}}
														onClick={(e) => e.stopPropagation()}
														className="w-4 h-4 text-[#FF8C42] rounded border-gray-300 focus:ring-[#FF8C42]"
													/>
													<span className="font-medium text-gray-900">{category}</span>
												</div>
												<Badge variant="outline" className="text-xs">
													{selectedCount}/{caps.length}
												</Badge>
											</div>
											
											{/* Category Capabilities */}
											{isExpanded && (
												<div className="p-2 grid grid-cols-2 gap-2">
													{caps.map(cap => (
														<label
															key={cap.id}
															className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
																formData.capabilities.includes(cap.id)
																	? 'bg-orange-50 border border-orange-200'
																	: 'hover:bg-gray-50 border border-transparent'
															}`}
														>
															<input
																type="checkbox"
																checked={formData.capabilities.includes(cap.id)}
																onChange={() => toggleCapability(cap.id)}
																className="w-4 h-4 mt-0.5 text-[#FF8C42] rounded border-gray-300 focus:ring-[#FF8C42]"
															/>
															<div className="flex-1 min-w-0">
																<p className="text-sm font-medium text-gray-900">{cap.name}</p>
																<p className="text-xs text-gray-500 truncate">{cap.description}</p>
															</div>
														</label>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>

						{/* Active Toggle */}
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={formData.isActive}
								onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
								className="w-4 h-4 text-[#FF8C42] rounded border-gray-300 focus:ring-[#FF8C42]"
							/>
							<label className="text-sm font-medium">Active Role</label>
						</div>
					</div>

					<DialogFooter className="border-t pt-4">
						<Button
							variant="outline"
							onClick={closeDialog}
							disabled={saving}
						>
							Cancel
						</Button>
						<Button
							onClick={saveRole}
							className="bg-[#FF8C42] hover:bg-[#ff7a28]"
							disabled={saving}
						>
							{saving ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<Save className="w-4 h-4 mr-2" />
									{editingRole ? "Update Role" : "Create Role"}
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminLayout>
	);
}
