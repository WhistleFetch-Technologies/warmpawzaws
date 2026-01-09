import { useState } from "react";
import {
	Button,
	Label,
	Textarea,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui";
import { X, AlertTriangle } from "lucide-react";

interface RejectVendorModalProps {
	isOpen: boolean;
	vendorName: string;
	onSubmit: (reason: string, notes?: string) => void;
	onCancel: () => void;
}

export function RejectVendorModal({
	isOpen,
	vendorName,
	onSubmit,
	onCancel,
}: RejectVendorModalProps) {
	const [reason, setReason] = useState("");
	const [notes, setNotes] = useState("");

	const handleSubmit = () => {
		if (!reason.trim()) {
			return;
		}
		onSubmit(reason, notes);
		setReason("");
		setNotes("");
	};

	const handleClose = () => {
		setReason("");
		setNotes("");
		onCancel();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
							<AlertTriangle className="w-5 h-5 text-red-600" />
						</div>
						<div>
							<DialogTitle>Reject Vendor Application</DialogTitle>
							<p className="text-sm text-gray-500 mt-1">
								This action cannot be undone
							</p>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 mt-4">
					<div className="bg-red-50 border border-red-200 rounded-lg p-3">
						<p className="text-sm text-red-800">
							You are about to reject the application for{" "}
							<strong>{vendorName}</strong>.
						</p>
					</div>

					<div>
						<Label htmlFor="reason" className="text-sm font-medium">
							Rejection Reason <span className="text-red-500">*</span>
						</Label>
						<Textarea
							id="reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="e.g., Incomplete documents, Invalid license, etc."
							rows={3}
							className="mt-1.5"
							required
						/>
						<p className="text-xs text-gray-500 mt-1">
							This will be shared with the vendor
						</p>
					</div>

					<div>
						<Label htmlFor="notes" className="text-sm font-medium">
							Additional Notes (Optional)
						</Label>
						<Textarea
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Any additional information for the vendor..."
							rows={2}
							className="mt-1.5"
						/>
					</div>

					<div className="flex gap-2 justify-end pt-2">
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleSubmit}
							disabled={!reason.trim()}
							className="bg-red-600 hover:bg-red-700"
						>
							<X className="w-4 h-4 mr-2" />
							Reject Application
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
