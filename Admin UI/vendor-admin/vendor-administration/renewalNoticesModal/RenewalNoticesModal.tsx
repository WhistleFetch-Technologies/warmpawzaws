import { useState, useEffect } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@repo/ui";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
interface RenewalNoticesModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export function RenewalNoticesModal({
	isOpen,
	onClose,
	onSuccess,
}: RenewalNoticesModalProps) {
	const [loading, setLoading] = useState(false);
	const [recipients, setRecipients] = useState("30"); // Days until expiry
	const [recipientCount, setRecipientCount] = useState(18);
	const [messageTemplate, setMessageTemplate] = useState(
		"Dear vendor, your license is scheduled to expire soon. Please complete the renewal process to continue providing services."
	);

	// Fetch expiring vendor count when modal opens
	useEffect(() => {
		if (isOpen) {
			fetchExpiringVendorCount();
		}
	}, [isOpen, recipients]);

	const fetchExpiringVendorCount = async () => {
		try {
			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/renewals/expiring?days=${recipients}`,
				{
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setRecipientCount(data.count || 0);
			}
		} catch (error) {
			console.error("Error fetching expiring vendor count:", error);
		}
	};

	if (!isOpen) return null;

	const handleSendRenewal = async () => {
		try {
			setLoading(true);

			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/renewals/send`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						daysUntilExpiry: parseInt(recipients),
						messageTemplate,
						subject: "License Renewal Required - Action Needed",
						adminId: "admin_1",
						adminName: "Admin",
					}),
				}
			);

			if (response.ok) {
				const result = await response.json();
				console.log("Renewal notices sent:", result);
				onSuccess();
			} else {
				const error = await response.json();
				console.error("Error sending renewal notices:", error);
				alert("Failed to send renewal notices");
			}
		} catch (error) {
			console.error("Error sending renewal notices:", error);
			alert("Failed to send renewal notices");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] mx-4">
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b border-gray-200">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
							<Send className="w-5 h-5 text-purple-600" />
						</div>
						<div>
							<h2 className="text-lg">Send Renewal Notices</h2>
							<p className="text-sm text-gray-500">
								Send license renewal notifications to vendors with expiring
								licenses
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
					>
						<X className="w-5 h-5 text-gray-500" />
					</button>
				</div>

				{/* Content */}
				<div className="p-6 space-y-5">
					{/* Recipients */}
					<div>
						<label className="block text-sm mb-2">Recipients</label>
						<div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
							<div className="text-sm text-gray-700">
								Expiring in {recipients} days ({recipientCount} vendors)
							</div>
						</div>
					</div>

					{/* Message Template */}
					<div>
						<label className="block text-sm mb-2">Message Template</label>
						<textarea
							value={messageTemplate}
							onChange={(e) => setMessageTemplate(e.target.value)}
							rows={4}
							className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
							placeholder="Enter message template..."
						/>
					</div>

					{/* Preview */}
					<div>
						<button className="text-sm text-blue-600 hover:text-blue-700 mb-2">
							Preview
						</button>
						<div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
							<div className="text-sm">
								<span className="text-gray-600">Subject:</span> License Renewal
								Required - Action Needed
							</div>
							<div className="text-sm">
								<span className="text-gray-600">Recipients:</span>{" "}
								{recipientCount} vendors (expiring in {recipients} days)
							</div>
							<div className="text-sm text-gray-700 mt-3">
								Dear vendor, your license is scheduled to expire soon. Please
								complete the renewal process to continue providing services.
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
					<Button
						variant="outline"
						onClick={onClose}
						disabled={loading}
						className="gap-2"
					>
						<X className="w-4 h-4" />
						Cancel
					</Button>
					<Button
						onClick={handleSendRenewal}
						disabled={loading}
						className="bg-green-600 hover:bg-green-700 text-white gap-2"
					>
						<Send className="w-4 h-4" />
						{loading ? "Sending..." : "Send Renewal"}
					</Button>
				</div>
			</div>
		</div>
	);
}
