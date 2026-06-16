"use client";

export const dynamic = "force-dynamic";

import { AdminVendorManagement } from "@/components/admin/AdminVendorManagement";
import { AdminRouteGuard } from "@/components/admin/layout/AdminRouteGuard";
import { hrefForAdminSidebarView } from "@/lib/admin-sidebar-nav";

export default function VendorsPage() {
	return (
		<AdminRouteGuard>
			<AdminVendorManagement
				onNavigate={(view) => {
					window.location.href = hrefForAdminSidebarView(view);
				}}
			/>
		</AdminRouteGuard>
	);
}
