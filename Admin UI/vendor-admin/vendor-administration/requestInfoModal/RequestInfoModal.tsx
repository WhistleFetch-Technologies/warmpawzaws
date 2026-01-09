import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Button,
	Label,
	Textarea,
	Input,
} from "@repo/ui";

import { MessageCircle, Info } from "lucide-react";

interface RequestInfoModalProps {
	isOpen: boolean;
	vendorName: string;
	onSubmit: (message: string, requiredFields: string[]) => void;
	onCancel: () => void;
}

export function RequestInfoModal({
	isOpen,
	vendorName,
	onSubmit,
	onCancel,
}: RequestInfoModalProps) {
	const [message, setMessage] = useState("");
	const [fieldsInput, setFieldsInput] = useState("");

	const handleSubmit = () => {
		if (!message.trim()) {
			return;
		}
		const requiredFields = fieldsInput
			? fieldsInput
					.split(",")
					.map((f) => f.trim())
					.filter(Boolean)
			: [];
		onSubmit(message, requiredFields);
		setMessage("");
		setFieldsInput("");
	};

	const handleClose = () => {
		setMessage("");
		setFieldsInput("");
		onCancel();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
							<MessageCircle className="w-5 h-5 text-orange-600" />
						</div>
						<div>
							<DialogTitle>Request Additional Information</DialogTitle>
							<p className="text-sm text-gray-500 mt-1">
								Ask vendor to provide more details
							</p>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 mt-4">
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
						<div className="flex items-start gap-2">
							<Info className="w-4 h-4 text-blue-600 mt-0.5" />
							<p className="text-sm text-blue-800">
								Request more information from <strong>{vendorName}</strong>. The
								vendor will be notified via SMS and email.
							</p>
						</div>
					</div>

					<div>
						<Label htmlFor="message" className="text-sm font-medium">
							Message to Vendor <span className="text-red-500">*</span>
						</Label>
						<Textarea
							id="message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="e.g., Please upload a clear copy of your veterinary license"
							rows={4}
							className="mt-1.5"
							required
						/>
						<p className="text-xs text-gray-500 mt-1">
							Be specific about what information is needed
						</p>
					</div>

					<div>
						<Label htmlFor="fields" className="text-sm font-medium">
							Required Fields (Optional)
						</Label>
						<Input
							id="fields"
							value={fieldsInput}
							onChange={(e) => setFieldsInput(e.target.value)}
							placeholder="e.g., license, degree, experience"
							className="mt-1.5"
						/>
						<p className="text-xs text-gray-500 mt-1">
							Comma-separated list of fields that need attention
						</p>
					</div>

					<div className="flex gap-2 justify-end pt-2">
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={!message.trim()}
							className="bg-orange-600 hover:bg-orange-700 text-white"
						>
							<MessageCircle className="w-4 h-4 mr-2" />
							Send Request
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
