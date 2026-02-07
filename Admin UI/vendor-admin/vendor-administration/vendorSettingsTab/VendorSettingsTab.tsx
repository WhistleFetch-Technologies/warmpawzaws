import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Plus } from "lucide-react";
import { getApiBaseUrl, getAuthHeaders } from "@repo/utils/api-config";
import { Button } from "@repo/ui";

interface RefundTier {
	hoursBeforeService: number;
	refundPercentage: number;
	cancellationFee: number | null;
	vendor: string;
}

interface RefundPolicies {
	customerCancellation: {
		tiers: RefundTier[];
	};
	providerCancellation: {
		refundToCustomer: number;
		additionalCompensation: number;
		cancellationFee: number;
		vendor: string;
	};
	refundProcessing: {
		mode: "auto" | "manual";
		processingTimeBusinessDays: number;
		actionRefundType: "immediate" | "hold";
		disputeResolutionTimeDays: number;
		refundPreference: "wallet" | "original" | "customer-choice";
		vendor: string;
	};
}

export function VendorSettingsTab() {
	const [expandedSection, setExpandedSection] = useState<string | null>(
		"refund-policies"
	);
	const [refundPolicies, setRefundPolicies] = useState<RefundPolicies | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		loadRefundPolicies();
	}, []);

	const loadRefundPolicies = async () => {
		try {
			const response = await fetch(
				`${getApiBaseUrl()}/admin/vendor-settings/refund-policies`,
				{
					headers: {
						...getAuthHeaders(),
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setRefundPolicies(data.policies);
			}
		} catch (error) {
			console.error("Error loading refund policies:", error);
		} finally {
			setLoading(false);
		}
	};

	const saveRefundPolicies = async () => {
		if (!refundPolicies) return;

		try {
			setSaving(true);
			const response = await fetch(
				`${getApiBaseUrl()}/admin/vendor-settings/refund-policies`,
				{
					method: "POST",
					headers: {
						...getAuthHeaders(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify(refundPolicies),
				}
			);

			if (response.ok) {
				console.log("✅ Refund policies saved");
			}
		} catch (error) {
			console.error("Error saving refund policies:", error);
		} finally {
			setSaving(false);
		}
	};

	const toggleSection = (section: string) => {
		setExpandedSection(expandedSection === section ? null : section);
	};

	const addRefundTier = () => {
		if (!refundPolicies) return;

		const newTier: RefundTier = {
			hoursBeforeService: 24,
			refundPercentage: 50,
			cancellationFee: null,
			vendor: "grooming",
		};

		setRefundPolicies({
			...refundPolicies,
			customerCancellation: {
				tiers: [...refundPolicies.customerCancellation.tiers, newTier],
			},
		});
	};

	const removeTier = (index: number) => {
		if (!refundPolicies) return;

		const newTiers = refundPolicies.customerCancellation.tiers.filter(
			(_, i) => i !== index
		);
		setRefundPolicies({
			...refundPolicies,
			customerCancellation: {
				tiers: newTiers,
			},
		});
	};

	const updateTier = (index: number, field: keyof RefundTier, value: any) => {
		if (!refundPolicies) return;

		const newTiers = [...refundPolicies.customerCancellation.tiers];
		newTiers[index] = { ...newTiers[index], [field]: value };

		setRefundPolicies({
			...refundPolicies,
			customerCancellation: {
				tiers: newTiers,
			},
		});
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="text-center">
					<div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-600">Loading vendor settings...</p>
				</div>
			</div>
		);
	}

	if (!refundPolicies) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-600">No refund policies found</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Refund Policies Section */}
			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<button
					onClick={() => toggleSection("refund-policies")}
					className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
				>
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
							<svg
								className="w-4 h-4 text-green-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div className="text-left">
							<div className="text-sm font-medium text-gray-900">
								Refund Policies
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{expandedSection === "refund-policies" && (
							<button
								onClick={(e) => {
									e.stopPropagation();
									loadRefundPolicies();
								}}
								className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
								title="Reset to Default"
							>
								<RotateCcw className="w-4 h-4 text-gray-600" />
							</button>
						)}
						{expandedSection === "refund-policies" ? (
							<ChevronUp className="w-5 h-5 text-gray-400" />
						) : (
							<ChevronDown className="w-5 h-5 text-gray-400" />
						)}
					</div>
				</button>

				{expandedSection === "refund-policies" && (
					<div className="px-6 pb-6 bg-orange-50">
						{/* Customer Cancellation */}
						<div className="mb-6">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">
										❌
									</div>
									<h4 className="text-sm font-medium text-gray-900">
										Customer Cancellation Tiers
									</h4>
								</div>
								<button
									onClick={addRefundTier}
									className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
								>
									<Plus className="w-3 h-3" />
									Add Tier
								</button>
							</div>
							<p className="text-xs text-gray-500 mb-4">
								Cancellation fees based on timing
							</p>

							<div className="space-y-3">
								{refundPolicies.customerCancellation.tiers.map(
									(tier, index) => (
										<div
											key={index}
											className="bg-white rounded-lg p-4 border border-gray-200"
										>
											<div className="grid grid-cols-4 gap-3">
												<div>
													<label className="block text-xs text-gray-600 mb-1.5">
														Hours before service
													</label>
													<input
														type="number"
														value={tier.hoursBeforeService}
														onChange={(e) =>
															updateTier(
																index,
																"hoursBeforeService",
																Number(e.target.value)
															)
														}
														className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
														placeholder="24"
													/>
													<span className="text-xs text-gray-400 mt-1 block">
														More than X hours
													</span>
												</div>
												<div>
													<label className="block text-xs text-gray-600 mb-1.5">
														Refund percentage (%)
													</label>
													<input
														type="number"
														value={tier.refundPercentage}
														onChange={(e) =>
															updateTier(
																index,
																"refundPercentage",
																Number(e.target.value)
															)
														}
														className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
														placeholder="100"
													/>
													<span className="text-xs text-gray-400 mt-1 block">
														% of booking value
													</span>
												</div>
												<div>
													<label className="block text-xs text-gray-600 mb-1.5">
														Cancellation fee (₹)
													</label>
													<input
														type="number"
														value={tier.cancellationFee || ""}
														onChange={(e) =>
															updateTier(
																index,
																"cancellationFee",
																e.target.value ? Number(e.target.value) : null
															)
														}
														className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
														placeholder="0"
													/>
													<span className="text-xs text-gray-400 mt-1 block">
														Optional flat fee
													</span>
												</div>
												<div>
													<label className="block text-xs text-gray-600 mb-1.5">
														Choose Vendor
													</label>
													<select
														value={tier.vendor}
														onChange={(e) =>
															updateTier(index, "vendor", e.target.value)
														}
														className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
													>
														<option value="grooming">Grooming Services</option>
														<option value="boarding">Boarding Services</option>
														<option value="veterinary">Veterinary</option>
														<option value="walking">Walking</option>
													</select>
													{index > 0 && (
														<button
															onClick={() => removeTier(index)}
															className="text-xs text-red-600 hover:text-red-700 mt-1"
														>
															Remove tier
														</button>
													)}
												</div>
											</div>
										</div>
									)
								)}
							</div>
						</div>

						{/* Provider Cancellation */}
						<div className="mb-6">
							<div className="flex items-center gap-2 mb-4">
								<div className="w-6 h-6 rounded-full bg-yellow-600 text-white flex items-center justify-center text-xs">
									⚠️
								</div>
								<h4 className="text-sm font-medium text-gray-900">
									Provider Cancellation
								</h4>
							</div>
							<p className="text-xs text-gray-500 mb-4">
								When service provider cancels
							</p>

							<div className="bg-white rounded-lg p-4 border border-gray-200">
								<div className="grid grid-cols-4 gap-3">
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Refund to customer (%)
										</label>
										<input
											type="number"
											value={
												refundPolicies.providerCancellation.refundToCustomer
											}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													providerCancellation: {
														...refundPolicies.providerCancellation,
														refundToCustomer: Number(e.target.value),
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											placeholder="100"
										/>
										<span className="text-xs text-gray-400 mt-1 block">
											Full refund
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Additional compensation (%)
										</label>
										<input
											type="number"
											value={
												refundPolicies.providerCancellation
													.additionalCompensation
											}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													providerCancellation: {
														...refundPolicies.providerCancellation,
														additionalCompensation: Number(e.target.value),
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											placeholder="10"
										/>
										<span className="text-xs text-gray-400 mt-1 block">
											Extra for inconvenience
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Cancellation fee on provider (₹)
										</label>
										<input
											type="number"
											value={
												refundPolicies.providerCancellation.cancellationFee
											}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													providerCancellation: {
														...refundPolicies.providerCancellation,
														cancellationFee: Number(e.target.value),
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											placeholder="500"
										/>
										<span className="text-xs text-gray-400 mt-1 block">
											Penalty on vendor
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Choose Vendor
										</label>
										<select
											value={refundPolicies.providerCancellation.vendor}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													providerCancellation: {
														...refundPolicies.providerCancellation,
														vendor: e.target.value,
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
										>
											<option value="grooming">Grooming Services</option>
											<option value="boarding">Boarding Services</option>
											<option value="veterinary">Veterinary</option>
											<option value="walking">Walking</option>
										</select>
										<span className="text-xs text-gray-400 mt-1 block">
											Apply to vendor type
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Refund Processing */}
						<div>
							<div className="flex items-center gap-2 mb-4">
								<div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
									⚙️
								</div>
								<h4 className="text-sm font-medium text-gray-900">
									Refund Processing
								</h4>
							</div>
							<p className="text-xs text-gray-500 mb-4">
								How refunds are processed
							</p>

							<div className="bg-white rounded-lg p-4 border border-gray-200">
								<div className="grid grid-cols-6 gap-3">
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Mode
										</label>
										<select
											value={refundPolicies.refundProcessing.mode}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													refundProcessing: {
														...refundPolicies.refundProcessing,
														mode: e.target.value as "auto" | "manual",
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
										>
											<option value="auto">Auto</option>
											<option value="manual">Manual</option>
										</select>
										<span className="text-xs text-gray-400 mt-1 block">
											Processing type
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Processing time (days)
										</label>
										<input
											type="number"
											value={
												refundPolicies.refundProcessing
													.processingTimeBusinessDays
											}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													refundProcessing: {
														...refundPolicies.refundProcessing,
														processingTimeBusinessDays: Number(e.target.value),
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											placeholder="5"
										/>
										<span className="text-xs text-gray-400 mt-1 block">
											Business days
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Action refund type
										</label>
										<select
											value={refundPolicies.refundProcessing.actionRefundType}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													refundProcessing: {
														...refundPolicies.refundProcessing,
														actionRefundType: e.target.value as
															| "immediate"
															| "hold",
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
										>
											<option value="immediate">Immediate</option>
											<option value="hold">Hold</option>
										</select>
										<span className="text-xs text-gray-400 mt-1 block">
											When to refund
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Dispute resolution (days)
										</label>
										<input
											type="number"
											value={
												refundPolicies.refundProcessing
													.disputeResolutionTimeDays
											}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													refundProcessing: {
														...refundPolicies.refundProcessing,
														disputeResolutionTimeDays: Number(e.target.value),
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
											placeholder="7"
										/>
										<span className="text-xs text-gray-400 mt-1 block">
											Days to resolve
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Refund preference
										</label>
										<select
											value={refundPolicies.refundProcessing.refundPreference}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													refundProcessing: {
														...refundPolicies.refundProcessing,
														refundPreference: e.target.value as
															| "wallet"
															| "original"
															| "customer-choice",
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
										>
											<option value="wallet">Wallet</option>
											<option value="original">Original method</option>
											<option value="customer-choice">Customer choice</option>
										</select>
										<span className="text-xs text-gray-400 mt-1 block">
											Where to refund
										</span>
									</div>
									<div>
										<label className="block text-xs text-gray-600 mb-1.5">
											Choose Vendor
										</label>
										<select
											value={refundPolicies.refundProcessing.vendor}
											onChange={(e) =>
												setRefundPolicies({
													...refundPolicies,
													refundProcessing: {
														...refundPolicies.refundProcessing,
														vendor: e.target.value,
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
										>
											<option value="grooming">Grooming Services</option>
											<option value="boarding">Boarding Services</option>
											<option value="veterinary">Veterinary</option>
											<option value="walking">Walking</option>
										</select>
										<span className="text-xs text-gray-400 mt-1 block">
											Apply to vendor type
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Save Button */}
						<div className="flex justify-end mt-6">
							<Button
								onClick={saveRefundPolicies}
								disabled={saving}
								className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
							>
								{saving ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
