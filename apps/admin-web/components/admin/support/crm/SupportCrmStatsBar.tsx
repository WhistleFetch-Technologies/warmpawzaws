"use client";

import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle,
	Clock,
	Ticket,
	TrendingUp,
} from "lucide-react";
import { Card } from "@warmpawz/ui";
import type { CRMStats } from "./types";

interface SupportCrmStatsBarProps {
	stats: CRMStats;
}

const STAT_ITEMS = [
	{
		key: "totalTickets" as const,
		label: "Total Tickets",
		color: "text-gray-900",
		icon: Ticket,
		iconBg: "bg-blue-50",
		iconColor: "text-blue-600",
		cardBg: "bg-white",
	},
	{
		key: "openTickets" as const,
		label: "Open",
		color: "text-red-600",
		icon: AlertTriangle,
		iconBg: "bg-red-100",
		iconColor: "text-red-600",
		cardBg: "bg-red-50/40",
	},
	{
		key: "inProgressTickets" as const,
		label: "In Progress",
		color: "text-yellow-600",
		icon: Clock,
		iconBg: "bg-yellow-100",
		iconColor: "text-yellow-600",
		cardBg: "bg-yellow-50/40",
	},
	{
		key: "resolvedTickets" as const,
		label: "Resolved",
		color: "text-green-600",
		icon: CheckCircle,
		iconBg: "bg-green-100",
		iconColor: "text-green-600",
		cardBg: "bg-green-50/40",
	},
	{
		key: "escalatedTickets" as const,
		label: "Escalated",
		color: "text-orange-600",
		icon: ArrowUpRight,
		iconBg: "bg-orange-100",
		iconColor: "text-orange-600",
		cardBg: "bg-orange-50/40",
	},
	{
		key: "todayTickets" as const,
		label: "Today",
		color: "text-purple-600",
		icon: TrendingUp,
		iconBg: "bg-purple-100",
		iconColor: "text-purple-600",
		cardBg: "bg-purple-50/40",
	},
];

export function SupportCrmStatsBar({ stats }: SupportCrmStatsBarProps) {
	return (
		<div className="grid grid-cols-3 xl:grid-cols-6 gap-2 px-4 pb-2">
			{STAT_ITEMS.map((item) => {
				const Icon = item.icon;
				const value = stats[item.key];
				return (
					<Card
						key={item.key}
						className={`p-2 border border-gray-100 shadow-none ${item.cardBg}`}
					>
						<div className="flex items-center justify-between gap-1">
							<div className="min-w-0">
								<p className="text-[10px] text-gray-500 font-medium truncate">{item.label}</p>
								<p className={`text-lg font-bold leading-tight ${item.color}`}>{value}</p>
							</div>
							<div className={`p-1.5 rounded-md shrink-0 ${item.iconBg}`}>
								<Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
							</div>
						</div>
					</Card>
				);
			})}
		</div>
	);
}
