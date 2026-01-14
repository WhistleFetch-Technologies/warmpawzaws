"use client";

export const dynamic = "force-dynamic";

import { AdminVendorManagement } from "@/components/admin/AdminVendorManagement";

export default function VendorsPage() {
	return (
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
	);
}
