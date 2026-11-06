import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, KeyRound, Video as VideoIcon } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { errMsg } from '@/services/errors';
import { cn, timeAgo, titleCase } from '@/lib/utils';
import { YouTubeEmbed } from '@/components/shared/YouTubeEmbed';
import { TLink } from '@/components/shared/TLink';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/SmartImage';
import { Tabs } from '@/components/ui/Tabs';
import { useClientVideos } from './clientData';
 
export function ClientVideos() {
  const q = useClientVideos(); const [cat, setCat] = useState('all');
  const items = (q.data?.items ?? []).filter((v) => cat === 'all' || v.category === cat);
  const cats = [...new Set((q.data?.items ?? []).map((v) => v.category))];
  return (
    <div className="space-y-4">
      <div><h1 className="font-serif text-3xl font-semibold">My videos</h1><p className="text-sm text-ink-muted">Wedding films, pre-wedding stories and event highlights from your studio.</p></div>
      <Tabs variant="pill" value={cat} onChange={setCat} items={[{ key: 'all', label: 'All' }, ...cats.map((c) => ({ key: c, label: titleCase(c) }))]} />
      {q.isLoading ? <Skeleton className="aspect-video max-w-xl rounded-xl" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : items.length === 0 ? <EmptyState icon={<VideoIcon className="h-5 w-5" />} title="No videos yet" body="Your films will appear here once the studio uploads them." /> : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((v) => <Card key={v.id} className="overflow-hidden"><YouTubeEmbed videoId={v.youtubeId} title={v.title} thumbnail={v.thumbnailUrl} className="rounded-none" /><div className="p-3"><p className="font-medium leading-snug">{v.title}</p><p className="mt-0.5 text-xs text-ink-muted">{titleCase(v.category)}{v.visibility === 'client' ? ' · private to you' : ''}</p>{v.description && <p className="mt-1 text-xs text-ink-2">{v.description}</p>}</div></Card>)}</div>
      )}
    </div>
  );
}
 
export function ClientNotifications() {
  const { user } = useAuth(); const { to } = useTenant(); const qc = useQueryClient();
  const q = useTenantQuery(['notifications', 'page', user!.id], (t) => services.notifications.list(t, user!.id, { pageSize: 50 }));
  const read = useTenantMutation<string, unknown>((t, id) => services.notifications.markRead(t, id), ['notifications']);
  const all = useTenantMutation<void, unknown>((t) => services.notifications.markAllRead(t, user!.id), ['notifications'], { success: 'All notifications marked as read' });
  const unread = q.data?.items.filter((n) => !n.read).length ?? 0;
  void qc;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-serif text-3xl font-semibold">Notifications</h1><p className="text-sm text-ink-muted">Booking updates, reminders and photo deliveries.</p></div>{unread > 0 && <Button variant="outline" icon={<CheckCheck className="h-4 w-4" />} onClick={() => all.mutate()} loading={all.isPending}>Mark all read ({unread})</Button>}</div>
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data?.items.length === 0 ? <EmptyState icon={<Bell className="h-5 w-5" />} title="You're all caught up" /> : (
        <Card><ul className="divide-y divide-line">{q.data?.items.map((n) => (
          <li key={n.id} className={cn('flex gap-3 p-4', !n.read && 'bg-brand-soft/40')}>
            <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', n.read ? 'bg-paper-2 text-ink-faint' : 'bg-brand text-brand-contrast')}><Bell className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{n.title}</p><p className="mt-0.5 text-sm text-ink-2">{n.body}</p><div className="mt-1.5 flex items-center gap-3 text-xs"><span className="text-ink-faint">{timeAgo(n.createdAt)}</span><TLink to={n.link} onClick={() => !n.read && read.mutate(n.id)} className="font-semibold text-brand-dark">Open</TLink>{!n.read && <button onClick={() => read.mutate(n.id)} className="text-ink-muted hover:text-ink">Mark read</button>}</div></div>
          </li>))}</ul></Card>
      )}
      <span className="hidden">{to('/')}</span>
    </div>
  );
}
 
const profileSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,}$/, 'Enter a valid phone number') });
const pwSchema = z.object({ current: z.string().min(1, 'Enter your current password'), next: z.string().min(8, 'Use at least 8 characters').regex(/\d/, 'Include a number'), confirm: z.string() }).refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
 
/** Profile form shared by the client portal and the photographer portal. */
export function ClientProfile() {
  const { user, setUser } = useAuth(); const toast = useToast();
  const p = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name, phone: user?.phone } });
  const w = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  const saveProfile = async (v: z.infer<typeof profileSchema>) => { try { setUser(await services.auth.updateProfile(v)); toast.success('Profile updated'); } catch (e) { toast.error(errMsg(e)); } };
  const savePw = async (v: z.infer<typeof pwSchema>) => { try { await services.auth.changePassword({ current: v.current, next: v.next }); w.reset(); toast.success('Password changed'); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      <div className="md:col-span-2 flex items-center gap-4"><Avatar src={user?.avatarUrl} name={user?.name ?? '?'} size={64} /><div><h1 className="font-serif text-3xl font-semibold">Your profile</h1><p className="text-sm text-ink-muted">{user?.email}</p></div></div>
      <Card><CardHeader title="Personal details" /><form className="space-y-3 p-4" onSubmit={p.handleSubmit(saveProfile)} noValidate>
        <Field label="Full name" error={p.formState.errors.name?.message}><Input {...p.register('name')} /></Field>
        <Field label="Email" hint="Email is your sign-in and cannot be changed here."><Input value={user?.email ?? ''} disabled readOnly /></Field>
        <Field label="Phone" error={p.formState.errors.phone?.message}><Input type="tel" {...p.register('phone')} /></Field>
        <Button type="submit" loading={p.formState.isSubmitting}>Save changes</Button></form></Card>
      <Card><CardHeader title="Password" subtitle="Use at least 8 characters with a number" action={<KeyRound className="h-4 w-4 text-ink-faint" />} /><form className="space-y-3 p-4" onSubmit={w.handleSubmit(savePw)} noValidate>
        <Field label="Current password" error={w.formState.errors.current?.message}><Input type="password" autoComplete="current-password" {...w.register('current')} /></Field>
        <Field label="New password" error={w.formState.errors.next?.message}><Input type="password" autoComplete="new-password" {...w.register('next')} /></Field>
        <Field label="Confirm new password" error={w.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" {...w.register('confirm')} /></Field>
        <Button type="submit" variant="dark" loading={w.formState.isSubmitting}>Update password</Button></form></Card>
    </div>
  );
}