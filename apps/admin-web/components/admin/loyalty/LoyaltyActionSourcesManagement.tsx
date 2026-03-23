'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Badge } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Beaker, Filter } from 'lucide-react';
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
	const [testPayload, setTestPayload] = useState<string>(JSON.stringify({
		request: { method: 'POST', path: '/payments', body: { customerId: 'cust_1', amount: 1500 } },
		response: { status: 200, body: { payment_status: 'completed', payment_id: 'pay_123', vendor_id: 'ven_9' } },
		jwt: { sub: 'cust_1', role: 'customer' }
	}, null, 2));
	const [testResult, setTestResult] = useState<Json | null>(null);
	const selectedId = editing?.id;

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

	const openCreate = () => {
		setEditing(null);
		setForm(emptySource());
		setIsOpen(true);
	};
	const openEdit = (it: ActionSource) => {
		setEditing(it);
		setForm({
			...it,
			metadata_resolvers: it.metadata_resolvers || {}
		});
		setIsOpen(true);
	};

	const save = async () => {
		try {
			// Basic validations
			if (!form.route_pattern) return notifications.setError('route_pattern is required');
			if (!form.method) return notifications.setError('method is required');
			if (!form.action_name) return notifications.setError('action_name is required');
			if (!form.entity_resolver) return notifications.setError('entity_resolver is required');

			const body = { ...form } as any;
			// Parse metadata_resolvers if textarea string
			if (typeof (body.metadata_resolvers as any) === 'string') {
				try { body.metadata_resolvers = JSON.parse(body.metadata_resolvers); } catch { body.metadata_resolvers = {}; }
			}
			if (editing) {
				await apiClient.put(`/admin/action-sources/${editing.id}`, body);
				notifications.setSuccess('Trigger updated');
			} else {
				await apiClient.post(`/admin/action-sources`, body);
				notifications.setSuccess('Trigger created');
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
						<Button onClick={openCreate}>
							<Plus className="w-4 h-4 mr-2" />
							Create Trigger
						</Button>
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
							<Input value={form.action_name || ''} onChange={(e: any) => setForm({ ...form, action_name: e.target.value })} placeholder="book_vet_consultation" />
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

