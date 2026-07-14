'use client';

import React, { Suspense } from "react";
import { UnifiedAdminSidebar } from "@/components/admin/layout/UnifiedAdminSidebar";
import { AdminRouteGuard } from "@/components/admin/layout/AdminRouteGuard";
import { Breadcrumbs } from "@/components/admin/shared/Breadcrumbs";
import { GlobalSearch } from "@/components/admin/shared/GlobalSearch";
import { AdminCopilotPanel } from "@/components/admin/copilot/AdminCopilotPanel";
import { CommercialCopilotPanel } from "@/components/admin/commercial-ai/CommercialCopilotPanel";
import { CommercialAiProvider } from "@/context/CommercialAiContext";
import { isCommercialAdminRoute } from "@/lib/commercial-ai/commercial-routes";
import { getFirstAllowedAdminRoute } from '@warmpawz/shared-types';
import { getStoredAdminPermissions } from '@/lib/admin-permissions';
import { hrefForAdminSidebarView } from '@/lib/admin-sidebar-nav';
import { useRouter, usePathname } from 'next/navigation';

function CopilotShell() {
	const pathname = usePathname() || '/';
	const commercial = isCommercialAdminRoute(pathname);
	return (
		<>
			{commercial ? <CommercialCopilotPanel /> : <AdminCopilotPanel />}
		</>
	);
}

export function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	
	const activeView =
		pathname && pathname !== "/" ? pathname.split("/")[1] : "analytics";

	const handleNavigate = (view: string) => {
		const route = hrefForAdminSidebarView(view);
		if (route === '/') {
			const dest = getFirstAllowedAdminRoute(getStoredAdminPermissions());
			router.push(dest ?? '/');
			return;
		}
		router.push(route);
	};

	return (
		<CommercialAiProvider>
		<div className="flex min-h-screen bg-gray-50">
			<Suspense fallback={null}>
				<CopilotShell />
			</Suspense>
			<Suspense fallback={null}>
				<UnifiedAdminSidebar
					activeView={activeView}
					onNavigate={handleNavigate}
				/>
			</Suspense>
			<div className="flex-1 flex flex-col min-h-screen">
				<header className="bg-white border-b border-gray-200 sticky top-0 z-30">
					<div className="max-w-7xl mx-auto px-6 py-3">
						<div className="flex items-center justify-between">
							<Breadcrumbs />
							<div className="w-80">
								<GlobalSearch />
							</div>
						</div>
					</div>
				</header>
				<main className="flex-1 overflow-auto">
					<AdminRouteGuard>{children}</AdminRouteGuard>
				</main>
			</div>
		</div>
		</CommercialAiProvider>
	);
}
