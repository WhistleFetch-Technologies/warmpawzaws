'use client';

/**
 * Banner Admin Component
 * Redirects to full Banner Management page
 * Full implementation: apps/admin-web/app/banners/page.tsx
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Image as ImageIcon, ExternalLink } from "lucide-react";
import { Button } from "@warmpawz/ui";

export function BannerAdmin() {
	const router = useRouter();

	return (
		<div className="p-6 space-y-6">
			<div>
				<h2 className="text-black text-xl font-semibold">Banner Management</h2>
				<p className="text-gray-500 text-sm mt-1">Manage marketplace banners</p>
			</div>
			<div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
				<ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
				<p className="text-gray-500 mb-4">Full banner management is available</p>
				<Button 
					onClick={() => router.push('/banners')}
					className="bg-[#FF8C42] hover:bg-[#FF7029] text-white"
				>
					<ExternalLink className="w-4 h-4 mr-2" />
					Open Banner Management
				</Button>
			</div>
		</div>
	);
}

