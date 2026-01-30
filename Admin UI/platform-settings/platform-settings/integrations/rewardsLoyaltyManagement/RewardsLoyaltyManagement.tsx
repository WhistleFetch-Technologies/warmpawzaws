import React, { useState, useEffect } from "react";

// import { Label } from "../../ui/label";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	Button,
	Input,
	Switch,
	Badge,
} from "@repo/ui";
import { Gift, Plus, Save, Trash2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";

interface LoyaltyRule {
	id: string;
	category: "End User" | "Vendor";
	action: string;
	points: number;
	type: "fixed" | "percentage_spend" | "multiplier";
	thresholdAmount?: number;
	frequency: "one-time" | "recurring" | "monthly_limit" | "yearly";
	isActive: boolean;
	description: string;
}

export function RewardsLoyaltyManagement() {
	const [rules, setRules] = useState<LoyaltyRule[]>([]);
	const [loading, setLoading] = useState(true);
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		fetchRules();
	}, []);

	const fetchRules = async () => {
		try {
			// First try to init default rules if empty
			await fetch(
				`${getApiBaseUrl()}/loyalty/rules/init`,
				{
					method: "POST",
					headers: { ...getAuthHeaders() },
				}
			);

			const response = await fetch(
				`${getApiBaseUrl()}/loyalty/rules`,
				{
					headers: { ...getAuthHeaders() },
				}
			);
			const data = await response.json();
			if (data.rules) setRules(data.rules);
		} catch (error) {
			toast.error("Failed to load loyalty rules");
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			setLoading(true);
			await fetch(
				`${getApiBaseUrl()}/loyalty/rules`,
				{
					method: "PUT",
					headers: {
						...getAuthHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ rules }),
				}
			);
			toast.success("Loyalty rules updated successfully");
			setHasChanges(false);
		} catch (error) {
			toast.error("Failed to save rules");
		} finally {
			setLoading(false);
		}
	};

	const toggleRuleStatus = (index: number) => {
		const newRules = [...rules];
		newRules[index].isActive = !newRules[index].isActive;
		setRules(newRules);
		setHasChanges(true);
	};

	const updatePoints = (index: number, val: string) => {
		const newRules = [...rules];
		newRules[index].points = parseInt(val) || 0;
		setRules(newRules);
		setHasChanges(true);
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						Loyalty & Rewards Program
					</h2>
					<p className="text-muted-foreground">
						Manage Pawints earning rules for Customers and Vendors
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={handleSave}
						disabled={!hasChanges || loading}
						className="bg-orange-600 hover:bg-orange-700"
					>
						<Save className="w-4 h-4 mr-2" />
						Save Changes
					</Button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Pawints Issued
						</CardTitle>
						<Trophy className="h-4 w-4 text-yellow-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">124,500</div>
						<p className="text-xs text-muted-foreground">
							+20% from last month
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Points Redeemed
						</CardTitle>
						<Gift className="h-4 w-4 text-pink-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">45,200</div>
						<p className="text-xs text-muted-foreground">36% redemption rate</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Active Referrals
						</CardTitle>
						<Users className="h-4 w-4 text-blue-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">892</div>
						<p className="text-xs text-muted-foreground">+12 since yesterday</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Earning Rules Configuration</CardTitle>
					<CardDescription>
						Define how users earn points. Changes apply immediately after
						saving.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Status</TableHead>
								<TableHead>User Type</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Reward Logic</TableHead>
								<TableHead>Frequency</TableHead>
								<TableHead>Points</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rules.map((rule, idx) => (
								<TableRow key={rule.id}>
									<TableCell>
										<Switch
											checked={rule.isActive}
											onCheckedChange={() => toggleRuleStatus(idx)}
										/>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												rule.category === "Vendor" ? "secondary" : "outline"
											}
										>
											{rule.category}
										</Badge>
									</TableCell>
									<TableCell>
										<div className="font-medium">{rule.description}</div>
										<div className="text-xs text-muted-foreground font-mono">
											{rule.action}
										</div>
									</TableCell>
									<TableCell>
										{rule.type === "fixed" && (
											<Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
												Fixed
											</Badge>
										)}
										{rule.type === "percentage_spend" && (
											<Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
												Per ₹{rule.thresholdAmount}
											</Badge>
										)}
										{rule.type === "multiplier" && (
											<Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
												Multiplier
											</Badge>
										)}
									</TableCell>
									<TableCell className="capitalize">{rule.frequency}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Input
												type="number"
												value={rule.points}
												onChange={(e) => updatePoints(idx, e.target.value)}
												className="w-20"
											/>
											<span className="text-xs text-muted-foreground">pts</span>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
