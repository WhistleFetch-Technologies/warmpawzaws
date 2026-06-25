"use client";

import { useState } from "react";
import { Bike, Loader2, RefreshCw } from "lucide-react";
import { Badge, Button } from "@warmpawz/ui";
import { useMealOrderReassign } from "@/hooks/useMealOrderReassign";

interface MealLogisticsActionsProps {
	mealOrderId: string;
	supportTicketId?: string;
}

export function MealLogisticsActions({ mealOrderId, supportTicketId }: MealLogisticsActionsProps) {
	const { summary, loading, reassigning, refetch, reassignRider } = useMealOrderReassign(
		mealOrderId,
		supportTicketId,
	);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const tracking = summary?.tracking;
	const riderName =
		tracking?.delivery_person_name != null ? String(tracking.delivery_person_name) : "—";
	const riderPhone =
		tracking?.delivery_person_phone != null ? String(tracking.delivery_person_phone) : "—";
	const trackingStatus = tracking?.status != null ? String(tracking.status) : "—";
	const pidgeId =
		tracking?.external_task_id != null
			? String(tracking.external_task_id)
			: summary?.order?.pidge_order_id != null
				? String(summary.order.pidge_order_id)
				: "—";

	const canReassign = summary?.canReassign === true;
	const reassignPending = summary?.reassignPending === true;
	const blockedReason = summary?.reassignBlockedReason;

	const lastReassign = summary?.reassignHistory?.[0];

	return (
		<div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
			<p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Meal logistics</p>
			{loading && !summary ? (
				<p className="text-xs text-gray-500 flex items-center gap-1">
					<Loader2 className="w-3 h-3 animate-spin" /> Loading…
				</p>
			) : (
				<>
					<div className="text-xs space-y-0.5 text-gray-700">
						<p>
							<span className="text-gray-500">Rider:</span> {riderName} · {riderPhone}
						</p>
						<p>
							<span className="text-gray-500">Tracking:</span> {trackingStatus}
						</p>
						<p className="font-mono text-[10px] text-gray-500 break-all">Pidge: {pidgeId}</p>
					</div>
					{reassignPending ? (
						<Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px]">
							Reassign pending…
						</Badge>
					) : null}
					{lastReassign?.created_at ? (
						<p className="text-[10px] text-gray-500">
							Last reassign: {String(lastReassign.created_at).slice(0, 19).replace("T", " ")} (
							{String(lastReassign.status || "—")})
						</p>
					) : null}
					<div className="flex flex-wrap gap-2 pt-1">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-8 text-xs"
							onClick={() => void refetch()}
							disabled={loading || reassigning}
						>
							<RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
							Refresh
						</Button>
						{confirmOpen ? (
							<div className="flex flex-wrap gap-1 w-full">
								<Button
									type="button"
									size="sm"
									className="h-8 text-xs bg-[#FF8C42] hover:bg-orange-600"
									disabled={reassigning}
									onClick={async () => {
										const ok = await reassignRider();
										if (ok) setConfirmOpen(false);
									}}
								>
									{reassigning ? (
										<Loader2 className="w-3 h-3 animate-spin mr-1" />
									) : (
										<Bike className="w-3 h-3 mr-1" />
									)}
									Confirm reassign
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className="h-8 text-xs"
									onClick={() => setConfirmOpen(false)}
								>
									Cancel
								</Button>
							</div>
						) : (
							<Button
								type="button"
								size="sm"
								className="h-8 text-xs"
								disabled={!canReassign || reassigning || reassignPending}
								title={!canReassign ? blockedReason || "Cannot reassign" : undefined}
								onClick={() => setConfirmOpen(true)}
							>
								<Bike className="w-3 h-3 mr-1" />
								Reassign rider
							</Button>
						)}
					</div>
				</>
			)}
		</div>
	);
}
