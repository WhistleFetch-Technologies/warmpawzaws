"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileText, Search } from "lucide-react";
import { Button, Input } from "@warmpawz/ui";
import { apiClient } from "@/lib/api-client";

export interface ReplyTemplate {
	id: string;
	name: string;
	category: string;
	content: string;
}

interface SavedReplyTemplatePickerProps {
	onInsert: (content: string) => void;
}

export function SavedReplyTemplatePicker({ onInsert }: SavedReplyTemplatePickerProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
	const [loading, setLoading] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open || templates.length > 0) return;
		setLoading(true);
		apiClient
			.get<{ success?: boolean; templates?: ReplyTemplate[] }>("/crm/reply-templates")
			.then((res) => {
				if (res.success) setTemplates(res.templates || []);
			})
			.catch((err) => console.error("Failed to load reply templates:", err))
			.finally(() => setLoading(false));
	}, [open, templates.length]);

	useEffect(() => {
		if (!open) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [open]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return templates;
		return templates.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				t.category.toLowerCase().includes(q) ||
				t.content.toLowerCase().includes(q)
		);
	}, [templates, search]);

	const handleSelect = (template: ReplyTemplate) => {
		onInsert(template.content);
		setOpen(false);
		setSearch("");
	};

	return (
		<div className="relative" ref={containerRef}>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="h-8 text-xs border-gray-200 text-gray-700 hover:bg-gray-50"
				onClick={() => setOpen((v) => !v)}
			>
				<FileText className="w-3.5 h-3.5 mr-1" />
				Insert Template
				<ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
			</Button>

			{open && (
				<div className="absolute left-0 bottom-full mb-1 z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
					<div className="p-2 border-b border-gray-100">
						<div className="relative">
							<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
							<Input
								value={search}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
								placeholder="Search templates…"
								className="h-8 pl-7 text-xs"
								autoFocus
							/>
						</div>
					</div>
					<div className="max-h-56 overflow-y-auto">
						{loading ? (
							<p className="p-3 text-xs text-gray-500">Loading templates…</p>
						) : filtered.length === 0 ? (
							<p className="p-3 text-xs text-gray-400">No templates match your search</p>
						) : (
							filtered.map((t) => (
								<button
									key={t.id}
									type="button"
									className="w-full text-left px-3 py-2 hover:bg-[#FFF3E8] border-b border-gray-50 last:border-0"
									onClick={() => handleSelect(t)}
								>
									<p className="text-xs font-semibold text-gray-900">{t.name}</p>
									<p className="text-[10px] text-gray-500">{t.category}</p>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
