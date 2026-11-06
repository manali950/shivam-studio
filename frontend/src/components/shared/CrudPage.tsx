/**
 * Config-driven list + create/edit/delete page used by most admin modules (photographers, services, packages,
 * testimonials, YouTube, Drive, plans…). Validation is Zod (react-hook-form resolver) — the same shapes the API validates.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData } from '@tanstack/react-query';
import { Controller, useForm, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { useDebounce } from '@/hooks/useDebounce';
import type { ID } from '@/types';
import type { Paged } from '@/services/data-provider/types';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { PageHeader } from '../ui/Card';
import { DataTable, Pagination, SearchInput, type Column } from '../ui/DataTable';
import { EmptyState, ErrorState } from '../ui/Feedback';
import { ChipSelect, Field, Input, Select, TagInput, Textarea, Toggle } from '../ui/Form';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { SmartImage } from '../ui/SmartImage';
 
export interface FieldDef {
  name: string; label: string; required?: boolean; hint?: ReactNode; placeholder?: string; span?: 1 | 2; rows?: number;
  type: 'text' | 'email' | 'url' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'toggle' | 'tags' | 'chips' | 'image';
  options?: { value: string; label: string }[]; step?: number; min?: number; suggestions?: string[]; notice?: ReactNode;
}
export interface FilterDef { name: string; label: string; options: { value: string; label: string }[] }
 
interface Props<T extends { id: ID }, F extends FieldValues> {
  title: string; subtitle?: string; noun: string; queryKey: string;
  load: (tenantId: ID, params: any) => Promise<Paged<T>>;
  create?: (tenantId: ID, input: any) => Promise<unknown>;
  update?: (tenantId: ID, id: ID, input: any) => Promise<unknown>;
  remove?: (tenantId: ID, id: ID) => Promise<unknown>;
  columns: Column<T>[]; fields: FieldDef[]; schema: ZodType<F, any, any>;
  defaults: F | ((row: T | null) => F); toPayload?: (v: F, row: T | null) => unknown;
  filters?: FilterDef[]; searchPlaceholder?: string; pageSize?: number; extraActions?: ReactNode;
  rowActions?: (r: T) => ReactNode; invalidate?: string[]; modalSize?: 'md' | 'lg'; canDelete?: (r: T) => boolean;
  renderGrid?: (rows: T[], helpers: { edit: (r: T) => void; del: (r: T) => void }) => ReactNode; onRowClick?: (r: T) => void;
  deleteBody?: (r: T) => ReactNode;
}
 
export function CrudPage<T extends { id: ID }, F extends FieldValues>(p: Props<T, F>) {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(sp.get('q') ?? '');
  const q = useDebounce(search);
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const pageSize = p.pageSize ?? 12;
  // `?new=1` (header quick actions) opens the create form once, then clears itself.
  useEffect(() => {
    if (sp.get('new') && p.create) { setEditing('new'); const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const params = useMemo(() => ({ page, pageSize, search: q || undefined, ...filterVals }), [page, pageSize, q, filterVals]);
 
  const list = useTenantQuery<Paged<T>>([p.queryKey, 'list', params], (tid) => p.load(tid, params), { placeholderData: keepPreviousData } as any);
  const inv = [p.queryKey, ...(p.invalidate ?? [])];
  const save = useTenantMutation<{ id?: ID; payload: unknown }, unknown>((tid, a) => (a.id ? p.update!(tid, a.id, a.payload) : p.create!(tid, a.payload)), inv, { success: `${cap(p.noun)} saved`, onSuccess: () => setEditing(null) });
  const del = useTenantMutation<ID, unknown>((tid, id) => p.remove!(tid, id), inv, { success: `${cap(p.noun)} deleted`, onSuccess: () => setDeleting(null) });
 
  const edit = (r: T) => setEditing(r); const askDelete = (r: T) => setDeleting(r);
  const rows = list.data?.items ?? [];
  const actions = (r: T) => (<>
    {p.rowActions?.(r)}
    {p.update && <IconButton label={`Edit ${p.noun}`} onClick={() => edit(r)}><Pencil className="h-4 w-4" /></IconButton>}
    {p.remove && (p.canDelete?.(r) ?? true) && <IconButton label={`Delete ${p.noun}`} onClick={() => askDelete(r)} className="hover:text-red-600"><Trash2 className="h-4 w-4" /></IconButton>}
  </>);
 
  return (
    <div>
      <PageHeader title={p.title} subtitle={p.subtitle} actions={<>{p.extraActions}{p.create && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Add {p.noun}</Button>}</>} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={p.searchPlaceholder ?? `Search ${p.noun}s…`} className="w-full sm:w-64" />
          {p.filters?.map((f) => (
            <Select key={f.name} aria-label={f.label} value={filterVals[f.name] ?? ''} className="w-auto min-w-[8rem]" onChange={(e) => { setFilterVals((s) => ({ ...s, [f.name]: e.target.value })); setPage(1); }}>
              <option value="">{f.label}: all</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ))}
          <span className="ml-auto text-xs text-ink-muted">{list.data ? `${list.data.total} total` : ''}</span>
        </div>
        {list.error ? <div className="p-4"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : p.renderGrid && !list.isLoading && rows.length ? (
          <div className="p-3">{p.renderGrid(rows, { edit, del: askDelete })}</div>
        ) : (
          <DataTable columns={p.columns} rows={rows} rowKey={(r) => r.id} loading={list.isLoading} actions={actions} onRowClick={p.onRowClick ?? (p.update ? edit : undefined)}
            empty={<EmptyState title={`No ${p.noun}s found`} body={search || Object.values(filterVals).some(Boolean) ? 'Try clearing filters or searching for something else.' : `Add your first ${p.noun} to get started.`} action={p.create && !search ? <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Add {p.noun}</Button> : undefined} />} />
        )}
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
 
      {editing && (
        <RecordForm<T, F> key={editing === 'new' ? 'new' : editing.id} noun={p.noun} row={editing === 'new' ? null : editing} fields={p.fields} schema={p.schema} size={p.modalSize}
          defaults={typeof p.defaults === 'function' ? p.defaults(editing === 'new' ? null : editing) : p.defaults} saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => save.mutate({ id: editing === 'new' ? undefined : editing.id, payload: p.toPayload ? p.toPayload(v, editing === 'new' ? null : editing) : v })} />
      )}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger loading={del.isPending} title={`Delete ${p.noun}?`} confirmLabel="Delete"
        body={deleting && (p.deleteBody ? p.deleteBody(deleting) : <>This permanently removes the {p.noun}. This action cannot be undone.</>)} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </div>
  );
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
 
function RecordForm<T, F extends FieldValues>({ noun, row, fields, schema, defaults, saving, onClose, onSubmit, size }: {
  noun: string; row: T | null; fields: FieldDef[]; schema: ZodType<F, any, any>; defaults: F; saving: boolean; onClose: () => void; onSubmit: (v: F) => void; size?: 'md' | 'lg';
}) {
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: defaults as any });
  const err = (n: string) => (errors as any)[n]?.message as string | undefined;
  return (
    <Modal open onClose={onClose} size={size ?? 'lg'} title={`${row ? 'Edit' : 'Add'} ${noun}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={handleSubmit(onSubmit)}>{row ? 'Save changes' : `Add ${noun}`}</Button></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
        {fields.map((f) => {
          const span = f.span === 2 || f.type === 'textarea' || f.type === 'tags' || f.type === 'chips' || f.type === 'image' || f.type === 'toggle' ? 'sm:col-span-2' : '';
          const common = { invalid: !!err(f.name), placeholder: f.placeholder };
          let ctl: ReactNode;
          switch (f.type) {
            case 'textarea': ctl = <Textarea rows={f.rows ?? 3} {...common} {...register(f.name as any)} />; break;
            case 'number': ctl = <Input type="number" step={f.step ?? 1} min={f.min} inputMode="decimal" {...common} {...register(f.name as any, { valueAsNumber: true })} />; break;
            case 'select': ctl = <Select invalid={!!err(f.name)} {...register(f.name as any)}><option value="">Select…</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>; break;
            case 'toggle': ctl = <Controller control={control} name={f.name as any} render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={f.label} hint={f.hint} />} />; break;
            case 'tags': ctl = <Controller control={control} name={f.name as any} render={({ field }) => <TagInput value={field.value ?? []} onChange={field.onChange} placeholder={f.placeholder} suggestions={f.suggestions} />} />; break;
            case 'chips': ctl = <Controller control={control} name={f.name as any} render={({ field }) => <ChipSelect value={field.value ?? []} onChange={field.onChange} options={f.options as any} />} />; break;
            case 'image': ctl = (<div className="flex items-start gap-3"><Input type="url" {...common} {...register(f.name as any)} />{watch(f.name as any) && <SmartImage src={watch(f.name as any)} alt="Preview" className="h-9 w-14 shrink-0 rounded-md" width={120} />}</div>); break;
            default: ctl = <Input type={f.type} {...common} {...register(f.name as any)} />;
          }
          return f.type === 'toggle' ? <div key={f.name} className={span}>{ctl}</div> : (
            <Field key={f.name} label={f.label} required={f.required} error={err(f.name)} hint={f.hint} className={span} group={['tags', 'chips', 'image'].includes(f.type)}>
              {ctl}{f.notice}
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}