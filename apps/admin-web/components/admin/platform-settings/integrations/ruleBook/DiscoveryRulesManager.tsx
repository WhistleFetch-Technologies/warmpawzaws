"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Label,
	Input,
	Button,
	Card,
	Badge,
} from "@warmpawz/ui";
import { Plus, Edit2, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface DiscoveryRule {
	id: string;
	role_id: string;
	rule_key: string;
	rule_value: { value?: number | string | number[] };
	applies_to_flow: string | null;
	city: string | null;
	service_style?: string | null;
	service_type?: string | null;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

interface RuleKeyOption {
	key: string;
	label: string;
	type: string;
	unit?: string;
}

const ROLES = [
	"all",
	"walker",
	"pet_walker",
	"pet_nutritionist",
	"nutritionist",
	"veterinarian",
	"vet_clinic",
	"groomer",
	"trainer",
	"pharmacy",
	"behaviourist",
	"sitter",
	"diagnostics_provider",
];

const FLOWS = ["discover", "meal_search", "pharmacy_broadcast", "booking", "chat", "reviews", "video_call", "meal_order"];

const SERVICE_STYLES = [
	{ value: "", label: "All styles" },
	{ value: "at_home", label: "At home" },
	{ value: "at_center", label: "At center" },
	{ value: "tele", label: "Tele" },
];

const SERVICE_TYPES = [
	{ value: "", label: "All types" },
	{ value: "grooming", label: "Grooming" },
	{ value: "training", label: "Training" },
	{ value: "veterinary", label: "Veterinary" },
	{ value: "walking", label: "Walking" },
	{ value: "nutrition", label: "Nutrition" },
	{ value: "pharmacy", label: "Pharmacy" },
];

function displayValue(rule: DiscoveryRule): string {
	const v = rule.rule_value?.value;
	if (Array.isArray(v)) return v.join(", ");
	if (v !== undefined && v !== null) return String(v);
	return "—";
}

/** Attribute (unit/type) for table display – from keys lookup by rule_key. */
function attributeForRule(rule: DiscoveryRule, keys: RuleKeyOption[]): string {
	const opt = keys.find((k) => k.key === rule.rule_key);
	if (!opt) return "—";
	if (opt.unit) return opt.unit;
	return opt.label || "—";
}

export function DiscoveryRulesManager() {
	const [rules, setRules] = useState<DiscoveryRule[]>([]);
	const [keys, setKeys] = useState<RuleKeyOption[]>([]);
	const [loading, setLoading] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<DiscoveryRule | null>(null);
	const [form, setForm] = useState({
		role_id: "all",
		rule_key: "",
		rule_value: "" as string | number,
		applies_to_flow: "" as string,
		service_style: "" as string,
		service_type: "" as string,
		is_active: true,
	});
	const [filterRole, setFilterRole] = useState<string>("");
	const [filterKey, setFilterKey] = useState<string>("");
	const [filterServiceStyle, setFilterServiceStyle] = useState<string>("");
	const [filterServiceType, setFilterServiceType] = useState<string>("");

	const loadRules = async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			if (filterRole) params.set("roleId", filterRole);
			if (filterKey) params.set("ruleKey", filterKey);
			if (filterServiceStyle) params.set("service_style", filterServiceStyle);
			if (filterServiceType) params.set("service_type", filterServiceType);
			const res = await apiClient.get<{ success: boolean; rules: DiscoveryRule[] }>(
				`/admin/discovery-rules?${params.toString()}`
			);
			if (res.success && res.rules) setRules(res.rules);
		} catch (e) {
			console.error("Error loading discovery rules:", e);
			toast.error("Failed to load rules");
		} finally {
			setLoading(false);
		}
	};

	const loadKeys = async () => {
		try {
			const res = await apiClient.get<{ success: boolean; keys: RuleKeyOption[] }>(
				"/admin/discovery-rules/keys"
			);
			if (res.success && res.keys) setKeys(res.keys);
		} catch (e) {
			console.error("Error loading rule keys:", e);
		}
	};

	useEffect(() => {
		loadRules();
	}, [filterRole, filterKey, filterServiceStyle, filterServiceType]);

	useEffect(() => {
		loadKeys();
	}, []);

	const openCreate = () => {
		setEditingRule(null);
		setForm({
			role_id: "all",
			rule_key: keys[0]?.key ?? "",
			rule_value: "",
			applies_to_flow: "",
			service_style: "",
			service_type: "",
			is_active: true,
		});
		setIsModalOpen(true);
	};

	const openEdit = (rule: DiscoveryRule) => {
		setEditingRule(rule);
		const v = rule.rule_value?.value;
		setForm({
			role_id: rule.role_id,
			rule_key: rule.rule_key,
			rule_value: Array.isArray(v) ? v.join(",") : (v ?? ""),
			applies_to_flow: rule.applies_to_flow ?? "",
			service_style: rule.service_style ?? "",
			service_type: rule.service_type ?? "",
			is_active: rule.is_active,
		});
		setIsModalOpen(true);
	};

	const parseValue = (key: string, raw: string | number): { value: number | string | number[] } => {
		const opt = keys.find((k) => k.key === key);
		if (opt?.type === "array") {
			const arr = typeof raw === "string" ? raw.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)) : [];
			return { value: arr };
		}
		if (opt?.type === "number") {
			const n = typeof raw === "number" ? raw : parseFloat(String(raw));
			return { value: isNaN(n) ? 0 : n };
		}
		return { value: String(raw ?? "") };
	};

	const handleSave = async () => {
		if (!form.rule_key) {
			toast.error("Select a rule key");
			return;
		}
		try {
			const rule_value = parseValue(form.rule_key, form.rule_value);
			if (editingRule) {
				await apiClient.put<{ success: boolean; rule: DiscoveryRule }>(
					`/admin/discovery-rules/${editingRule.id}`,
					{
						rule_value,
						applies_to_flow: form.applies_to_flow || null,
						service_style: form.service_style || null,
						service_type: form.service_type || null,
						is_active: form.is_active,
					}
				);
				toast.success("Rule updated");
			} else {
				await apiClient.post<{ success: boolean; rule: DiscoveryRule }>(
					"/admin/discovery-rules",
					{
						role_id: form.role_id,
						rule_key: form.rule_key,
						rule_value,
						applies_to_flow: form.applies_to_flow || null,
						service_style: form.service_style || null,
						service_type: form.service_type || null,
						is_active: form.is_active,
					}
				);
				toast.success("Rule created");
			}
			setIsModalOpen(false);
			loadRules();
		} catch (e: unknown) {
			const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to save";
			toast.error(msg);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Deactivate this rule?")) return;
		try {
			await apiClient.delete(`/admin/discovery-rules/${id}`);
			toast.success("Rule deactivated");
			loadRules();
		} catch (e) {
			toast.error("Failed to deactivate rule");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-slate-900">Rule Book</h2>
					<p className="text-slate-500 text-sm mt-1">
						Discovery radius, max results, sort, pharmacy broadcast, follow-up & chat days, booking notice, reminders.
					</p>
				</div>
				<Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
					<Plus className="w-4 h-4 mr-2" />
					Add Rule
				</Button>
			</div>

			<div className="flex flex-wrap gap-2">
				<Select value={filterRole || "all"} onValueChange={(v: string) => setFilterRole(v === "all" ? "" : v)}>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="Role" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All roles</SelectItem>
						{ROLES.map((r) => (
							<SelectItem key={r} value={r}>
								{r}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={filterKey || "all"} onValueChange={(v: string) => setFilterKey(v === "all" ? "" : v)}>
					<SelectTrigger className="w-[220px]">
						<SelectValue placeholder="Rule key" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All keys</SelectItem>
						{keys.map((k) => (
							<SelectItem key={k.key} value={k.key}>
								{k.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={filterServiceStyle || "all"} onValueChange={(v: string) => setFilterServiceStyle(v === "all" ? "" : v)}>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Service style" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All styles</SelectItem>
						{SERVICE_STYLES.filter((s) => s.value).map((s) => (
							<SelectItem key={s.value} value={s.value}>
								{s.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={filterServiceType || "all"} onValueChange={(v: string) => setFilterServiceType(v === "all" ? "" : v)}>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Service type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						{SERVICE_TYPES.filter((t) => t.value).map((t) => (
							<SelectItem key={t.value} value={t.value}>
								{t.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{loading ? (
				<div className="text-slate-500 py-8">Loading rules…</div>
			) : (
				<div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Role</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Rule key</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Value</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Attribute</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Service style</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Service type</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Flow</th>
									<th className="text-left py-3 px-4 font-semibold text-slate-700">Active</th>
									<th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
								</tr>
							</thead>
							<tbody>
								{rules.map((rule) => (
									<tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50/50">
										<td className="py-3 px-4">{rule.role_id}</td>
										<td className="py-3 px-4 font-mono text-xs">{rule.rule_key}</td>
										<td className="py-3 px-4">{displayValue(rule)}</td>
										<td className="py-3 px-4 text-slate-600">{attributeForRule(rule, keys)}</td>
										<td className="py-3 px-4">{rule.service_style || "—"}</td>
										<td className="py-3 px-4">{rule.service_type || "—"}</td>
										<td className="py-3 px-4">{rule.applies_to_flow ?? "—"}</td>
										<td className="py-3 px-4">
											<Badge variant={rule.is_active ? "default" : "secondary"}>
												{rule.is_active ? "Yes" : "No"}
											</Badge>
										</td>
										<td className="py-3 px-4 text-right">
											<Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
												<Edit2 className="w-4 h-4" />
											</Button>
											<Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(rule.id)}>
												<Trash2 className="w-4 h-4" />
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{rules.length === 0 && (
						<div className="text-center py-16 bg-slate-50/50">
							<BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
							<p className="text-slate-600 font-medium">No rules match the filters</p>
							<p className="text-slate-500 text-sm mt-1">Add a rule or clear filters to see seeded defaults.</p>
						</div>
					)}
				</div>
			)}

			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>{editingRule ? "Edit Rule" : "Add Rule"}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						{!editingRule && (
							<div>
								<Label>Role</Label>
								<Select value={form.role_id} onValueChange={(v: string) => setForm((f) => ({ ...f, role_id: v }))}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ROLES.map((r) => (
											<SelectItem key={r} value={r}>
												{r}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
						<div>
							<Label>Rule key</Label>
							<Select
								value={form.rule_key}
								onValueChange={(v: string) => setForm((f) => ({ ...f, rule_key: v }))}
								disabled={!!editingRule}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select key" />
								</SelectTrigger>
								<SelectContent>
									{keys.map((k) => (
										<SelectItem key={k.key} value={k.key}>
											{k.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>
								Value
								{(() => {
									const opt = keys.find((k) => k.key === form.rule_key);
									if (opt) {
										const typeUnit = [opt.type, opt.unit].filter(Boolean).join(", unit: ");
										return typeUnit ? ` (${typeUnit})` : "";
									}
									return " (number, text, or comma-separated numbers for array)";
								})()}
							</Label>
							<Input
								value={form.rule_value}
								onChange={(e) => setForm((f) => ({ ...f, rule_value: e.target.value }))}
								placeholder="e.g. 10 or nearest or 5,10,20"
							/>
						</div>
						<div>
							<Label>Flow (optional)</Label>
							<Select
								value={form.applies_to_flow || "none"}
								onValueChange={(v: string) => setForm((f) => ({ ...f, applies_to_flow: v === "none" ? "" : v }))}
							>
								<SelectTrigger>
									<SelectValue placeholder="Flow" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">—</SelectItem>
									{FLOWS.map((f) => (
										<SelectItem key={f} value={f}>
											{f}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>Service style (optional)</Label>
							<Select
								value={form.service_style || "none"}
								onValueChange={(v: string) => setForm((f) => ({ ...f, service_style: v === "none" ? "" : v }))}
							>
								<SelectTrigger>
									<SelectValue placeholder="All styles" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">All styles</SelectItem>
									{SERVICE_STYLES.filter((s) => s.value).map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>Service type (optional)</Label>
							<Select
								value={form.service_type || "none"}
								onValueChange={(v: string) => setForm((f) => ({ ...f, service_type: v === "none" ? "" : v }))}
							>
								<SelectTrigger>
									<SelectValue placeholder="All types" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">All types</SelectItem>
									{SERVICE_TYPES.filter((t) => t.value).map((t) => (
										<SelectItem key={t.value} value={t.value}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="is_active"
								checked={form.is_active}
								onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
								className="rounded border-slate-300"
							/>
							<Label htmlFor="is_active">Active</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">
							{editingRule ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
