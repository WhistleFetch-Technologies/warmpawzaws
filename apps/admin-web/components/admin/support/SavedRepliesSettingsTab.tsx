"use client";

import { useEffect, useState } from "react";
import { Edit, FileText, Plus, Save, Trash2 } from "lucide-react";
import {
	Badge,
	Button,
	Card,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@warmpawz/ui";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

const CATEGORIES = ["Refund", "Booking", "Technical", "General"] as const;

interface ReplyTemplateRow {
	id: string;
	name: string;
	category: string;
	content: string;
	isActive: boolean;
	isSystem?: boolean;
	updatedAt?: string;
}

export function SavedRepliesSettingsTab() {
	const [templates, setTemplates] = useState<ReplyTemplateRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [editing, setEditing] = useState<Partial<ReplyTemplateRow> | null>(null);

	const loadTemplates = async () => {
		setLoading(true);
		try {
			const res = await apiClient.get<{ success?: boolean; templates?: ReplyTemplateRow[] }>(
				"/support/settings/reply-templates"
			);
			if (res.success) setTemplates(res.templates || []);
		} catch (error) {
			console.error("Failed to load reply templates:", error);
			toast.error("Failed to load saved replies");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadTemplates();
	}, []);

	const saveTemplate = async () => {
		if (!editing?.name?.trim() || !editing?.content?.trim()) {
			toast.error("Name and content are required");
			return;
		}
		try {
			const res = await apiClient.post<{ success?: boolean; message?: string }>(
				"/support/settings/reply-templates",
				{
					id: editing.id,
					name: editing.name.trim(),
					category: editing.category || "General",
					content: editing.content.trim(),
					isActive: editing.isActive !== false,
				}
			);
			if (res.success) {
				toast.success(res.message || "Template saved");
				setShowModal(false);
				setEditing(null);
				await loadTemplates();
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : "Failed to save template";
			toast.error(msg);
		}
	};

	const toggleActive = async (row: ReplyTemplateRow) => {
		try {
			const res = await apiClient.post<{ success?: boolean }>("/support/settings/reply-templates", {
				id: row.id,
				name: row.name,
				category: row.category,
				content: row.content,
				isActive: !row.isActive,
			});
			if (res.success) {
				toast.success(row.isActive ? "Template disabled" : "Template enabled");
				await loadTemplates();
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : "Failed to update template";
			toast.error(msg);
		}
	};

	const deleteTemplate = async (row: ReplyTemplateRow) => {
		if (row.isSystem) {
			toast.error("System templates cannot be deleted. Disable them instead.");
			return;
		}
		if (!confirm(`Delete template "${row.name}"?`)) return;
		try {
			const res = await apiClient.delete<{ success?: boolean }>(
				`/support/settings/reply-templates/${row.id}`
			);
			if (res.success) {
				toast.success("Template deleted");
				await loadTemplates();
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : "Failed to delete template";
			toast.error(msg);
		}
	};

	if (loading) {
		return <p className="text-sm text-gray-500">Loading saved replies…</p>;
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-lg font-semibold text-gray-900">Saved Replies</h2>
					<p className="text-sm text-gray-500 mt-0.5">
						Manage macros that agents insert into the reply composer
					</p>
				</div>
				<Button
					onClick={() => {
						setEditing({ category: "General", isActive: true });
						setShowModal(true);
					}}
					className="bg-[#FF8C42] hover:bg-[#E07830] text-white"
				>
					<Plus className="w-4 h-4 mr-2" />
					Add Template
				</Button>
			</div>

			<Card className="border border-gray-200 overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-semibold text-gray-600">Template Name</th>
								<th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
								<th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
								<th className="text-left px-4 py-3 font-semibold text-gray-600">Last Updated</th>
								<th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
							</tr>
						</thead>
						<tbody>
							{templates.length === 0 ? (
								<tr>
									<td colSpan={5} className="px-4 py-8 text-center text-gray-400">
										No templates yet
									</td>
								</tr>
							) : (
								templates.map((row) => (
									<tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
										<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<FileText className="w-4 h-4 text-gray-400 shrink-0" />
												<span className="font-medium text-gray-900">{row.name}</span>
												{row.isSystem && (
													<Badge variant="outline" className="text-[10px]">
														System
													</Badge>
												)}
											</div>
										</td>
										<td className="px-4 py-3 text-gray-600">{row.category}</td>
										<td className="px-4 py-3">
											<Badge
												className={
													row.isActive
														? "bg-green-100 text-green-700"
														: "bg-gray-100 text-gray-500"
												}
											>
												{row.isActive ? "Active" : "Disabled"}
											</Badge>
										</td>
										<td className="px-4 py-3 text-gray-500 text-xs">
											{row.updatedAt
												? new Date(row.updatedAt).toLocaleString()
												: "—"}
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => {
														setEditing(row);
														setShowModal(true);
													}}
													title="Edit"
												>
													<Edit className="w-4 h-4" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => void toggleActive(row)}
													className="text-xs"
												>
													{row.isActive ? "Disable" : "Enable"}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => void deleteTemplate(row)}
													disabled={row.isSystem}
													className="text-red-600 hover:text-red-700"
													title="Delete"
												>
													<Trash2 className="w-4 h-4" />
												</Button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</Card>

			<Dialog open={showModal} onOpenChange={setShowModal}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{editing?.id ? "Edit Template" : "Add Template"}</DialogTitle>
						<DialogDescription>
							Agents can insert this text into the reply box and edit before sending
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<label className="text-sm font-medium text-gray-700 mb-1.5 block">Name *</label>
							<Input
								value={editing?.name || ""}
								onChange={(e) => setEditing({ ...editing, name: e.target.value })}
								placeholder="e.g. Refund Under Review"
							/>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700 mb-1.5 block">Category</label>
							<Select
								value={editing?.category || "General"}
								onValueChange={(value: string) => setEditing({ ...editing, category: value })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{CATEGORIES.map((c) => (
										<SelectItem key={c} value={c}>
											{c}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-sm font-medium text-gray-700 mb-1.5 block">Content *</label>
							<Textarea
								value={editing?.content || ""}
								onChange={(e) => setEditing({ ...editing, content: e.target.value })}
								placeholder="Template body…"
								rows={8}
								className="resize-none font-mono text-sm"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowModal(false)}>
							Cancel
						</Button>
						<Button onClick={() => void saveTemplate()} className="bg-[#FF8C42] hover:bg-[#E07830] text-white">
							<Save className="w-4 h-4 mr-2" />
							Save Template
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
