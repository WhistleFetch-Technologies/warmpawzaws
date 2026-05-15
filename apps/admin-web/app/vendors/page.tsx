"use client";

export const dynamic = "force-dynamic";

import { AdminVendorManagement } from "@/components/admin/AdminVendorManagement";
import { AdminRouteGuard } from "@/components/admin/layout/AdminRouteGuard";

export default function VendorsPage() {
	return (
		<AdminRouteGuard>
			<AdminVendorManagement
				onNavigate={(view) => {
					// Align with UnifiedAdminSidebar navigation ids
					if (view === "vendor-admin") {
						window.location.href = "/vendors";
						return;
					}
					window.location.href = `/${view}`;
				}}
			/>
		</AdminRouteGuard>
	);
}
