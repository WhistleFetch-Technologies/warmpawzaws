import { useState } from "react";
import { X, Download, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui";
import { projectId, publicAnonKey } from "@repo/utils/supabase/info";
interface ExportApplicationsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function ExportApplicationsModal({
	isOpen,
	onClose,
}: ExportApplicationsModalProps) {
	const [loading, setLoading] = useState(false);
	const [exportFormat, setExportFormat] = useState("pdf");
	const [dataRange, setDataRange] = useState("all");

	if (!isOpen) return null;

	const handleExport = async () => {
		try {
			setLoading(true);

			const response = await fetch(
				`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/applications/export`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${publicAnonKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						format: exportFormat,
						range: dataRange,
						adminId: "admin_1",
						adminName: "Admin",
					}),
				}
			);

			if (response.ok) {
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `vendor_applications_${new Date().getTime()}.${exportFormat}`;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);
				onClose();
			} else {
				const error = await response.json();
				console.error("Error exporting applications:", error);
				alert("Failed to export applications");
			}
		} catch (error) {
			console.error("Error exporting applications:", error);
			alert("Failed to export applications");
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
						<div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
							<Download className="w-5 h-5 text-blue-600" />
						</div>
						<div>
							<h2 className="text-lg">Export Applications Data</h2>
							<p className="text-sm text-gray-500">
								Download vendor application data in various formats for
								reporting and analysis
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
					{/* Export Format */}
					<div>
						<label className="block text-sm mb-2">Export Format</label>
						<select
							value={exportFormat}
							onChange={(e) => setExportFormat(e.target.value)}
							className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent bg-white"
						>
							<option value="pdf">PDF Report</option>
							<option value="csv">CSV Spreadsheet</option>
							<option value="xlsx">Excel Workbook</option>
							<option value="json">JSON Data</option>
						</select>
					</div>

					{/* Data Range */}
					<div>
						<label className="block text-sm mb-2">Data Range</label>
						<select
							value={dataRange}
							onChange={(e) => setDataRange(e.target.value)}
							className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent bg-white"
						>
							<option value="all">All Applications (5 total)</option>
							<option value="pending">Pending Only</option>
							<option value="approved">Approved Only</option>
							<option value="rejected">Rejected Only</option>
							<option value="last-30-days">Last 30 Days</option>
							<option value="last-90-days">Last 90 Days</option>
						</select>
					</div>

					{/* Export Details */}
					<div className="p-4 bg-green-50 rounded-lg border border-green-200">
						<h3 className="text-sm text-green-800 mb-2">Export Details</h3>
						<div className="space-y-1 text-sm text-gray-700">
							<div>
								<span className="text-gray-600">Format:</span>{" "}
								{exportFormat.toUpperCase()}
							</div>
							<div>
								<span className="text-gray-600">Data:</span> All 5 vendor
								records
							</div>
							<div>
								<span className="text-gray-600">Includes:</span> Vendor details,
								contact info, ratings, documents, status
							</div>
							<div>
								<span className="text-gray-600">File size:</span> ~2.5 MB
							</div>
						</div>
					</div>

					{/* Warning Note */}
					<div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
						<AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
						<div className="text-sm text-gray-700">
							<span className="text-orange-800">Note:</span> Exported data
							contains sensitive vendor information. Please handle according to
							data privacy policies.
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
						onClick={handleExport}
						disabled={loading}
						className="bg-green-600 hover:bg-green-700 text-white gap-2"
					>
						<Download className="w-4 h-4" />
						{loading ? "Exporting..." : "Export Data"}
					</Button>
				</div>
			</div>
		</div>
	);
}
