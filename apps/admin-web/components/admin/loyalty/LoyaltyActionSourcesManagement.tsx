'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Badge } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Beaker, Filter, BookOpen, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useNotifications } from '@/hooks';

type Json = Record<string, any>;

type ActionSource = {
	id: string;
	source_type: 'http' | 'job' | 'db_outbox';
	route_pattern: string;
	method: string;
	status_min: number;
	status_max: number;
	success_predicate?: string | null;
	action_name: string;
	entity_resolver: string;
	entity_type: 'customer' | 'vendor' | 'auto';
	amount_resolver?: string | null;
	reference_type?: string | null;
	reference_id_resolver?: string | null;
	metadata_resolvers?: Json;
	enabled: boolean;
	priority: number;
	dry_run: boolean;
	notes?: string | null;
	created_at?: string;
	updated_at?: string;
};

type ActionRuleLite = {
	action_name: string;
};

const METHODS = ['POST','PUT','PATCH','GET','DELETE'] as const;
const ENTITY_TYPES = ['auto','customer','vendor'] as const;

function emptySource(): Partial<ActionSource> {
	return {
		source_type: 'http',
		route_pattern: '',
		method: 'POST',
		status_min: 200,
		status_max: 299,
		action_name: '',
		entity_resolver: '$.customer_id || $.body.customerId || $.jwt.sub',
		entity_type: 'auto',
		enabled: true,
		priority: 100,
		dry_run: false,
		metadata_resolvers: {},
	};
}

export function LoyaltyActionSourcesManagement() {
	const notifications = useNotifications({ autoClearSuccess: true });
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState<ActionSource[]>([]);
	const [methodFilter, setMethodFilter] = useState<string>('all');
	const [routeFilter, setRouteFilter] = useState<string>('');
	const [onlyEnabled, setOnlyEnabled] = useState<boolean>(true);

	const [isOpen, setIsOpen] = useState(false);
	const [editing, setEditing] = useState<ActionSource | null>(null);
	const [form, setForm] = useState<Partial<ActionSource>>(emptySource());

	const [testOpen, setTestOpen] = useState(false);
	const [guideOpen, setGuideOpen] = useState(false);
	const [testPayload, setTestPayload] = useState<string>(JSON.stringify({
		request: { method: 'POST', path: '/payments', body: { customerId: 'cust_1', amount: 1500 } },
		response: { status: 200, body: { payment_status: 'completed', payment_id: 'pay_123', vendor_id: 'ven_9' } },
		jwt: { sub: 'cust_1', role: 'customer' }
	}, null, 2));
	const [testResult, setTestResult] = useState<Json | null>(null);
	const selectedId = editing?.id;

	// Action name options (searchable)
	const [actionOptions, setActionOptions] = useState<string[]>([]);
	const [loadingActions, setLoadingActions] = useState<boolean>(false);
	const actionsAbortRef = useRef<AbortController | null>(null);
	const debounceRef = useRef<number | undefined>(undefined);
	const [isCustomAction, setIsCustomAction] = useState<boolean>(false);
	const [selectedActionNames, setSelectedActionNames] = useState<string[]>([]);
	const [editingSiblingIds, setEditingSiblingIds] = useState<string[]>([]);

	const toStableJson = (v: any) => {
		try {
			return JSON.stringify(v ?? {});
		} catch {
			return '{}';
		}
	};

	const triggerGroupKey = (src: Partial<ActionSource>) => ([
		src.source_type || 'http',
		src.route_pattern || '',
		src.method || 'POST',
		String(src.status_min ?? 200),
		String(src.status_max ?? 299),
		src.success_predicate || '',
		src.entity_resolver || '',
		src.entity_type || 'auto',
		src.amount_resolver || '',
		src.reference_type || '',
		src.reference_id_resolver || '',
		toStableJson(src.metadata_resolvers || {}),
		String(!!src.enabled),
		String(src.priority ?? 100),
		String(!!src.dry_run),
	]).join('|');

	const load = async () => {
		setLoading(true);
		try {
			const qs = new URLSearchParams();
			if (methodFilter !== 'all') qs.set('method', methodFilter);
			if (routeFilter) qs.set('route', routeFilter);
			if (onlyEnabled) qs.set('enabled', 'true');
			const url = qs.toString() ? `/admin/action-sources?${qs.toString()}` : '/admin/action-sources';
			const res = await apiClient.get<{ success: boolean; sources: ActionSource[] }>(url);
			setItems(res.sources || []);
		} catch (e: any) {
			notifications.setError(e.message || 'Failed to load triggers');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

	const filtered = useMemo(() => items, [items]);

	// Load distinct action names (searchable) for modal
	const loadActions = async (q: string) => {
		try {
			actionsAbortRef.current?.abort();
			const ac = new AbortController();
			actionsAbortRef.current = ac;
			setLoadingActions(true);

			const params = new URLSearchParams();
			if (q?.trim()) params.set('search', q.trim());
			params.set('limit', '100');

			const res = await apiClient.get<any>(`/admin/loyalty/actions?${params.toString()}`);
			const items = Array.isArray(res?.actions) ? res.actions : [];
			setActionOptions(items.filter((v: any) => typeof v === 'string' && v.length > 0));
		} catch (e) {
			// Fallback for environments where /admin/loyalty/actions isn't exposed
			try {
				const rulesRes = await apiClient.get<{ success: boolean; rules: ActionRuleLite[] }>('/admin/loyalty-action-rules');
				const fromRules = (rulesRes.rules || []).map((r) => r.action_name).filter(Boolean);
				const fromSources = items.map((it) => it.action_name).filter(Boolean);
				const combined = Array.from(new Set([...fromRules, ...fromSources]));
				const needle = (q || '').trim().toLowerCase();
				const filtered = needle
					? combined.filter((name) => name.toLowerCase().includes(needle))
					: combined;
				setActionOptions(filtered.slice(0, 100));
			} catch {
				setActionOptions([]);
			}
		} finally {
			setLoadingActions(false);
		}
	};

	const openCreate = () => {
		setEditing(null);
		setForm(emptySource());
		setIsCustomAction(false);
		setSelectedActionNames([]);
		setEditingSiblingIds([]);
		setIsOpen(true);
	};
	const openEdit = (it: ActionSource) => {
		const key = triggerGroupKey(it);
		const siblings = items.filter((row) => triggerGroupKey(row) === key);
		setEditing(it);
		setForm({
			...it,
			metadata_resolvers: it.metadata_resolvers || {}
		});
		setIsCustomAction(false);
		setSelectedActionNames(Array.from(new Set(siblings.map((s) => s.action_name).filter(Boolean))));
		setEditingSiblingIds(siblings.map((s) => s.id));
		setIsOpen(true);
	};

	// Prime action list when dialog opens; cleanup on close
	useEffect(() => {
		if (isOpen) {
			loadActions('');
		} else {
			actionsAbortRef.current?.abort();
			window.clearTimeout(debounceRef.current);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const save = async () => {
		try {
			// Basic validations
			if (!form.route_pattern) return notifications.setError('route_pattern is required');
			if (!form.method) return notifications.setError('method is required');
			if (!selectedActionNames.length) return notifications.setError('At least one action_name is required');
			if (!form.entity_resolver) return notifications.setError('entity_resolver is required');

			const body = { ...form } as any;
			// Parse metadata_resolvers if textarea string
			if (typeof (body.metadata_resolvers as any) === 'string') {
				try { body.metadata_resolvers = JSON.parse(body.metadata_resolvers); } catch { body.metadata_resolvers = {}; }
			}
			const actionNames = Array.from(new Set(selectedActionNames.map((v) => v.trim()).filter(Boolean)));
			if (!actionNames.length) return notifications.setError('At least one valid action_name is required');

			if (editing && actionNames.length > 0) {
				const siblingRows = items.filter((it) => editingSiblingIds.includes(it.id));
				const desired = new Set(actionNames);
				const existingByAction = new Map<string, ActionSource>();
				for (const row of siblingRows) {
					if (!existingByAction.has(row.action_name)) existingByAction.set(row.action_name, row);
				}

				// Update rows that should remain; delete rows removed from selection.
				for (const row of siblingRows) {
					if (desired.has(row.action_name)) {
						await apiClient.put(`/admin/action-sources/${row.id}`, { ...body, action_name: row.action_name });
					} else {
						await apiClient.delete(`/admin/action-sources/${row.id}`);
					}
				}

				// Create rows for newly selected actions that don't exist yet in this trigger group.
				for (const actionName of actionNames) {
					if (!existingByAction.has(actionName)) {
						await apiClient.post(`/admin/action-sources`, { ...body, action_name: actionName });
					}
				}
				notifications.setSuccess('Trigger(s) updated');
			} else {
				for (const actionName of actionNames) {
					await apiClient.post(`/admin/action-sources`, { ...body, action_name: actionName });
				}
				notifications.setSuccess('Trigger(s) created');
			}
			setIsOpen(false);
			await load();
		} catch (e: any) {
			notifications.setError(e.message || 'Save failed');
		}
	};

	const remove = async (it: ActionSource) => {
		if (!confirm('Delete this trigger?')) return;
		try {
			await apiClient.delete(`/admin/action-sources/${it.id}`);
			notifications.setSuccess('Trigger deleted');
			await load();
		} catch (e: any) {
			notifications.setError(e.message || 'Delete failed');
		}
	};

	const runTest = async () => {
		if (!selectedId) return;
		try {
			const payload = JSON.parse(testPayload);
			const res = await apiClient.post(`/admin/action-sources/${selectedId}/test`, payload);
			setTestResult(res as unknown as Json);
		} catch (e: any) {
			notifications.setError(e.message || 'Test failed');
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Triggers (Action Sources)</CardTitle>
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => setGuideOpen(true)}>
								<BookOpen className="w-4 h-4 mr-2" />
								Guidelines
							</Button>
						<Button onClick={openCreate}>
							<Plus className="w-4 h-4 mr-2" />
							Create Trigger
						</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap items-end gap-3 mb-4">
						<div className="w-40">
							<Label>Method</Label>
							<Select value={methodFilter} onValueChange={setMethodFilter}>
								<SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All</SelectItem>
									{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div className="grow min-w-[220px]">
							<Label>Route</Label>
							<Input value={routeFilter} onChange={(e: any) => setRouteFilter(e.target.value)} placeholder="/payments" />
						</div>
						<div className="flex items-center gap-2">
							<Switch checked={onlyEnabled} onCheckedChange={(v: boolean) => setOnlyEnabled(v)} />
							<Label>Only enabled</Label>
						</div>
						<Button variant="outline" onClick={load}>
							<Filter className="w-4 h-4 mr-2" />
							Apply
						</Button>
					</div>

					{loading ? (
						<div className="text-sm text-muted-foreground">Loading...</div>
					) : filtered.length === 0 ? (
						<div className="text-sm text-muted-foreground">No triggers found</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Method</TableHead>
									<TableHead>Route</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Priority</TableHead>
									<TableHead>Updated</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map(it => (
									<TableRow key={it.id}>
										<TableCell className="font-mono text-xs">{it.method}</TableCell>
										<TableCell className="font-mono text-xs">{it.route_pattern}</TableCell>
										<TableCell className="font-mono text-xs">{it.action_name}</TableCell>
										<TableCell>
											<Badge variant={it.enabled ? 'default' : 'secondary'}>{it.enabled ? 'Enabled' : 'Disabled'}</Badge>
											{it.dry_run && <Badge className="ml-2" variant="secondary">Dry-run</Badge>}
										</TableCell>
										<TableCell>{it.priority}</TableCell>
										<TableCell className="text-xs">{it.updated_at ? new Date(it.updated_at).toLocaleString() : ''}</TableCell>
										<TableCell>
											<div className="flex gap-2">
												<Button size="sm" variant="outline" onClick={() => openEdit(it)}><Edit className="w-4 h-4" /></Button>
												<Button size="sm" variant="secondary" onClick={() => { setEditing(it); setTestOpen(true); setTestResult(null); }}><Beaker className="w-4 h-4" /></Button>
												<Button size="sm" variant="destructive" onClick={() => remove(it)}><Trash2 className="w-4 h-4" /></Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			{/* Create/Edit Drawer (modal) */}
			<Dialog open={isOpen} onOpenChange={(o: boolean) => !o && setIsOpen(false)}>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{editing ? 'Edit Trigger' : 'Create Trigger'}</DialogTitle>
						<DialogDescription>Define when to emit and how to extract event fields.</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label>Method</Label>
							<Select value={form.method || 'POST'} onValueChange={(v: any) => setForm({ ...form, method: v })}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>Route Pattern</Label>
							<Input value={form.route_pattern || ''} onChange={(e: any) => setForm({ ...form, route_pattern: e.target.value })} placeholder="/payments" />
						</div>
						<div>
							<Label>Status Min</Label>
							<Input type="number" value={form.status_min ?? 200} onChange={(e: any) => setForm({ ...form, status_min: Number(e.target.value) })} />
						</div>
						<div>
							<Label>Status Max</Label>
							<Input type="number" value={form.status_max ?? 299} onChange={(e: any) => setForm({ ...form, status_max: Number(e.target.value) })} />
						</div>
						<div className="col-span-2">
							<Label>Success Predicate</Label>
							<Input value={form.success_predicate || ''} onChange={(e: any) => setForm({ ...form, success_predicate: e.target.value })} placeholder='e.g. $.payment_status == "completed" or leave blank' />
						</div>
						<div className="col-span-2">
							<Label>Action Name</Label>
							<Select
								value={isCustomAction ? '__custom__' : ''}
								onValueChange={(value: string) => {
									if (value === '__custom__') {
										setIsCustomAction(true);
										return;
									}
									setIsCustomAction(false);
									if (value && !selectedActionNames.includes(value)) {
										setSelectedActionNames((prev) => [...prev, value]);
									}
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder={loadingActions ? 'Loading actions…' : 'Select action name'} />
								</SelectTrigger>
								<SelectContent>
									{actionOptions.map((name) => (
										<SelectItem key={name} value={name}>{name}</SelectItem>
									))}
									<SelectItem value="__custom__">Custom action...</SelectItem>
								</SelectContent>
							</Select>
							{isCustomAction && (
								<div className="mt-2 flex gap-2">
									<Input
										value={form.action_name || ''}
										onChange={(e: any) => setForm({ ...form, action_name: e.target.value })}
										placeholder="Enter custom action name"
										autoComplete="off"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											const v = (form.action_name || '').trim();
											if (!v) return;
											if (!selectedActionNames.includes(v)) {
												setSelectedActionNames((prev) => [...prev, v]);
											}
											setForm({ ...form, action_name: '' });
										}}
									>
										Add
									</Button>
								</div>
							)}
							{selectedActionNames.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-2">
									{selectedActionNames.map((name) => (
										<Badge key={name} variant="secondary" className="flex items-center gap-1">
											<span className="font-mono text-xs">{name}</span>
											<button
												type="button"
												aria-label={`Remove ${name}`}
												onClick={() => setSelectedActionNames((prev) => prev.filter((it) => it !== name))}
												className="inline-flex items-center"
											>
												<X className="w-3 h-3" />
											</button>
										</Badge>
									))}
								</div>
							)}
							<p className="text-xs text-muted-foreground mt-1">
								{loadingActions
									? 'Loading actions list…'
									: actionOptions.length
										? `${actionOptions.length} actions available`
										: 'No actions found yet. Use Custom action if needed.'}
							</p>
						</div>
						<div className="col-span-2">
							<Label>Entity Resolver</Label>
							<Input value={form.entity_resolver || ''} onChange={(e: any) => setForm({ ...form, entity_resolver: e.target.value })} placeholder="$.customer_id || $.body.customerId || $.jwt.sub" />
						</div>
						<div>
							<Label>Entity Type</Label>
							<Select value={form.entity_type || 'auto'} onValueChange={(v: any) => setForm({ ...form, entity_type: v })}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>Amount Resolver</Label>
							<Input value={form.amount_resolver || ''} onChange={(e: any) => setForm({ ...form, amount_resolver: e.target.value })} placeholder="$.amount || $.body.amount" />
						</div>
						<div>
							<Label>Reference Type</Label>
							<Input value={form.reference_type || ''} onChange={(e: any) => setForm({ ...form, reference_type: e.target.value })} placeholder="payment" />
						</div>
						<div>
							<Label>Reference Id Resolver</Label>
							<Input value={form.reference_id_resolver || ''} onChange={(e: any) => setForm({ ...form, reference_id_resolver: e.target.value })} placeholder="$.payment_id || $.id" />
						</div>
						<div className="col-span-2">
							<Label>Metadata Resolvers (JSON)</Label>
							<Textarea rows={5} value={typeof form.metadata_resolvers === 'string' ? (form.metadata_resolvers as any) : JSON.stringify(form.metadata_resolvers || {}, null, 2)}
								onChange={(e: any) => setForm({ ...form, metadata_resolvers: e.target.value })} />
						</div>
						<div>
							<Label>Priority</Label>
							<Input type="number" value={form.priority ?? 100} onChange={(e: any) => setForm({ ...form, priority: Number(e.target.value) })} />
						</div>
						<div className="flex items-center gap-2">
							<Switch checked={!!form.enabled} onCheckedChange={(v: boolean) => setForm({ ...form, enabled: v })} />
							<Label>Enabled</Label>
						</div>
						<div className="flex items-center gap-2">
							<Switch checked={!!form.dry_run} onCheckedChange={(v: boolean) => setForm({ ...form, dry_run: v })} />
							<Label>Dry-run</Label>
						</div>
						<div className="col-span-2">
							<Label>Notes</Label>
							<Textarea rows={2} value={form.notes || ''} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} />
						</div>
					</div>
					<DialogFooter className="mt-4">
						<Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
						<Button onClick={save}>{editing ? 'Update' : 'Create'}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Trigger Guidelines */}
			<Dialog open={guideOpen} onOpenChange={(o: boolean) => !o && setGuideOpen(false)}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Trigger Setup Guidelines (Non-Technical)</DialogTitle>
						<DialogDescription>
							Use this guide to configure loyalty triggers correctly without development knowledge.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 text-sm">
						<div className="rounded-lg border p-3">
							<p className="font-semibold mb-2">1) What is a Trigger?</p>
							<p>
								A trigger decides when to emit a loyalty event after an API action succeeds.
								It connects endpoint activity to reward rules using Action Name.
							</p>
						</div>
						<div className="rounded-lg border p-3">
							<p className="font-semibold mb-2">2) Before You Start (Checklist)</p>
							<ul className="list-disc pl-5 space-y-1">
								<li>Action Rule already exists for the same Action Name.</li>
								<li>You know method and route pattern for the business action.</li>
								<li>You know if this is for customer or vendor.</li>
								<li>You know success condition (usually <code>$.success == true</code>).</li>
							</ul>
						</div>
						<div className="rounded-lg border p-3">
							<p className="font-semibold mb-2">3) Field Guide</p>
							<ul className="list-disc pl-5 space-y-1">
								<li><strong>Method / Route Pattern:</strong> Must exactly match API action.</li>
								<li><strong>Status Min/Max:</strong> Keep 200-299 for successful responses.</li>
								<li><strong>Success Predicate:</strong> Extra success check from response JSON.</li>
								<li><strong>Action Name:</strong> Must exactly match action rule name.</li>
								<li><strong>Entity Resolver:</strong> Path to customer/vendor id in body/jwt/response.</li>
								<li><strong>Entity Type:</strong> Choose customer/vendor (avoid auto unless instructed).</li>
								<li><strong>Amount Resolver:</strong> Needed only for percentage/per-amount rules.</li>
								<li><strong>Reference Type/Id:</strong> Business reference and unique id resolver.</li>
								<li><strong>Metadata Resolvers:</strong> Optional advanced values for rule conditions.</li>
								<li><strong>Priority:</strong> Higher priority is checked first.</li>
								<li><strong>Enabled:</strong> Turn on to activate this trigger.</li>
								<li><strong>Dry-run:</strong> Test mode (logs only, no real emission).</li>
							</ul>
						</div>
						<div className="rounded-lg border p-3">
							<p className="font-semibold mb-2">4) Safe Setup Flow</p>
							<ol className="list-decimal pl-5 space-y-1">
								<li>Create/confirm action rule first.</li>
								<li>Create trigger with the same action name.</li>
								<li>Enable Dry-run and test once.</li>
								<li>Confirm mapped values are correct.</li>
								<li>Disable Dry-run and test again.</li>
								<li>Verify points transaction is created.</li>
							</ol>
						</div>
						<div className="rounded-lg border p-3">
							<p className="font-semibold mb-2">5) Common Issues</p>
							<ul className="list-disc pl-5 space-y-1">
								<li>No points awarded: action name mismatch, disabled trigger, or failed predicate.</li>
								<li>Wrong user: entity resolver points to wrong field.</li>
								<li>Repeated points on one-time: different action name or wrong frequency config.</li>
								<li>No options in Action Name list: backend action list endpoint unavailable; use custom value.</li>
							</ul>
						</div>
						<div className="rounded-lg border p-3">
							<p className="font-semibold mb-2">6) Recommended Resolver Templates</p>
							<ul className="list-disc pl-5 space-y-1">
								<li><strong>Vendor:</strong> <code>$.body.vendorId || $.jwt.vendorId</code></li>
								<li><strong>Customer:</strong> <code>$.body.customerId || $.jwt.sub</code></li>
								<li><strong>Success check:</strong> <code>$.success == true</code></li>
							</ul>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setGuideOpen(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Test Modal */}
			<Dialog open={testOpen} onOpenChange={(o: boolean) => !o && setTestOpen(false)}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Test Mapping</DialogTitle>
						<DialogDescription>Provide sample request/response/jwt to preview the event.</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-4">
						<div className="col-span-2">
							<Label>Payload (JSON)</Label>
							<Textarea rows={14} value={testPayload} onChange={(e: any) => setTestPayload(e.target.value)} />
						</div>
						<div className="col-span-2">
							<Button onClick={runTest}><Beaker className="w-4 h-4 mr-2" />Run Test</Button>
						</div>
						<div className="col-span-2">
							<Label>Result</Label>
							<pre className="bg-slate-950 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto min-h-[120px]">{testResult ? JSON.stringify(testResult, null, 2) : '—'}</pre>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setTestOpen(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

