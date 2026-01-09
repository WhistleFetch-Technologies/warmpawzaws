"use client";

import { useState } from "react";
import { PricingRulesEngine, InventoryManager } from "../";
import { Briefcase, TrendingUp, Package, Settings } from "lucide-react";
import { Button } from "@repo/ui";
import Link from "next/link";

export function EnterpriseLogicTab() {
	const [activeTab, setActiveTab] = useState("pricing");

	return (
		<div className="space-y-6 p-6">
			<div className="bg-linear-to-r from-slate-900 to-slate-800 p-6 rounded-xl text-white shadow-lg">
				<div className="flex items-center gap-4 mb-4">
					<Link href="/enterprise">
						<Button variant="ghost" className="text-white">
							← Back
						</Button>
					</Link>
					<div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
						<Briefcase className="w-6 h-6 text-[#FF8C42]" />
					</div>
					<div>
						<h2 className="text-2xl font-bold">Enterprise Logic Center</h2>
						<p className="text-white/70">
							Manage revenue optimization, dynamic pricing, and inventory logic.
						</p>
					</div>
				</div>
				<div className="flex gap-6 text-sm text-white/60 border-t border-white/10 pt-4 mt-4">
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						Surge Pricing Active
					</div>
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 bg-yellow-500 rounded-full"></div>5 Low
						Stock Alerts
					</div>
					<div className="flex items-center gap-2">
						<Settings className="w-3 h-3" />
						Auto-Reorder Enabled
					</div>
				</div>
			</div>

			<div className="space-y-6">
				<div className="bg-white p-1 border border-gray-200 rounded-xl w-full flex justify-start h-auto gap-1">
					<button
						onClick={() => setActiveTab("pricing")}
						className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
							activeTab === "pricing"
								? "bg-[#FF8C42] text-white shadow-sm"
								: "text-gray-600 hover:bg-gray-100"
						}`}
					>
						<TrendingUp className="w-4 h-4" />
						Pricing Engine
					</button>
					<button
						onClick={() => setActiveTab("inventory")}
						className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium ${
							activeTab === "inventory"
								? "bg-[#FF8C42] text-white shadow-sm"
								: "text-gray-600 hover:bg-gray-100"
						}`}
					>
						<Package className="w-4 h-4" />
						Inventory & Stock
					</button>
				</div>

				<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
					{activeTab === "pricing" && <PricingRulesEngine />}
					{activeTab === "inventory" && <InventoryManager />}
				</div>
			</div>
		</div>
	);
}
