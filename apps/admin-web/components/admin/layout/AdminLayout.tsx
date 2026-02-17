"use client";

import React from "react";
import { UnifiedAdminSidebar } from "@/components/admin/layout/UnifiedAdminSidebar";
import { Breadcrumbs } from "@/components/admin/shared/Breadcrumbs";
import { GlobalSearch } from "@/components/admin/shared/GlobalSearch";
import { useRouter, usePathname } from "next/navigation";

export function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	
	// Determine active view from current path (Dashboard removed; default to analytics)
	const activeView =
		pathname && pathname !== "/" ? pathname.split("/")[1] : "analytics";

	// Handle navigation from sidebar
	const handleNavigate = (view: string) => {
		const route = view ? `/${view}` : "/";
		router.push(route);
	};

	return (
		<div className="flex min-h-screen bg-gray-50">
			<UnifiedAdminSidebar
				activeView={activeView}
				onNavigate={handleNavigate}
			/>
			{/* ✅ FIX: Improved z-index and structure for better visual hierarchy */}
			<div className="flex-1 flex flex-col min-h-screen">
				{/* Header with Breadcrumbs and Search - cleaner, no extra margin */}
				<header className="bg-white border-b border-gray-200 sticky top-0 z-30">
					<div className="max-w-7xl mx-auto px-6 py-3">
						<div className="flex items-center justify-between">
							<Breadcrumbs />
							{/* Hide global search (vendor/orders/bookings) on Region Manager and Pet Info as per requirements */}
							{pathname && !pathname.startsWith("/regions") && !pathname.startsWith("/pet-info") && (
								<div className="w-80">
									<GlobalSearch />
								</div>
							)}
						</div>
					</div>
				</header>
				{/* Main content area with proper scrolling */}
				<main className="flex-1 overflow-auto">
					{children}
				</main>
			</div>
		</div>
	);
}

