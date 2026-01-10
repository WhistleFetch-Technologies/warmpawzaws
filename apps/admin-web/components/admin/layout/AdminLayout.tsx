"use client";

import React from "react";
import { UnifiedAdminSidebar } from "@/components/admin/layout/UnifiedAdminSidebar";
import { useRouter, usePathname } from "next/navigation";

export function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	
	// Determine active view from current path
	// Improved activeView logic: always use the first segment after root
	const activeView =
		pathname && pathname !== "/" ? pathname.split("/")[1] : "dashboard";

	// Handle navigation from sidebar
	const handleNavigate = (view: string) => {
		console.log('🔧 [AdminLayout] Navigating to:', view);
		if (view === "dashboard") {
			router.push("/");
		} else {
			const route = `/${view}`;
			console.log('🔧 [AdminLayout] Pushing route:', route);
			router.push(route);
		}
	};

	return (
		<div className="flex min-h-screen">
			<UnifiedAdminSidebar
				activeView={activeView}
				onNavigate={handleNavigate}
			/>
			<div className="flex-1 z-40 flex flex-col bg-gray-50">{children}</div>
		</div>
	);
}

