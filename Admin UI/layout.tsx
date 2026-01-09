"use client";
import { UnifiedAdminSidebar } from "@/components/layout/UnifiedAdminSidebar";
import { useRouter, usePathname } from "next/navigation";

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	// Determine active view from current path
	console.log("Current pathname:", pathname);
	// Improved activeView logic: always use the first segment after root
	const activeView =
		pathname && pathname !== "/" ? pathname.split("/")[1] : "vendor-admin";
	console.log("Active view:", activeView);

	// Handle navigation from sidebar
	const handleNavigate = (view: string) => {
		router.push(`/${view}`);
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
