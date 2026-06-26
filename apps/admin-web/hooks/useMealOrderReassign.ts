"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

export type MealLogisticsSummary = {
	success?: boolean;
	reassignPending?: boolean;
	canReassign?: boolean;
	reassignBlockedReason?: string | null;
	order?: Record<string, unknown>;
	tracking?: Record<string, unknown> | null;
	reassignHistory?: Array<Record<string, unknown>>;
};

export function useMealOrderReassign(mealOrderId: string | undefined, supportTicketId?: string) {
	const [summary, setSummary] = useState<MealLogisticsSummary | null>(null);
	const [loading, setLoading] = useState(false);
	const [reassigning, setReassigning] = useState(false);

	const refetch = useCallback(async () => {
		if (!mealOrderId) {
			setSummary(null);
			return;
		}
		setLoading(true);
		try {
			const res = await apiClient.get<MealLogisticsSummary>(
				`/admin/meal-orders/${encodeURIComponent(mealOrderId)}/logistics-summary`,
			);
			setSummary(res);
		} catch (e: unknown) {
			console.warn("[useMealOrderReassign] fetch failed:", e);
			setSummary(null);
		} finally {
			setLoading(false);
		}
	}, [mealOrderId]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	const reassignRider = useCallback(
		async (reason?: string) => {
			if (!mealOrderId) return false;
			setReassigning(true);
			try {
				const res = await apiClient.post<{ success?: boolean; error?: string; status?: string }>(
					`/admin/meal-orders/${encodeURIComponent(mealOrderId)}/reassign-rider`,
					{
						supportTicketId,
						reason: reason?.trim() || "Support CRM rider reassign",
					},
				);
				if (res?.success) {
					toast.success("Rider reassign requested — waiting for Pidge webhooks");
					await refetch();
					return true;
				}
				toast.error(res?.error || "Reassign failed");
				return false;
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : "Reassign failed";
				toast.error(msg);
				return false;
			} finally {
				setReassigning(false);
			}
		},
		[mealOrderId, supportTicketId, refetch],
	);

	return {
		summary,
		loading,
		reassigning,
		refetch,
		reassignRider,
	};
}
