import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldAlert } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { ROLE_HOME, ROLE_LABEL, useAuth } from '@/context/AuthContext';
import { services } from '@/services/data-provider';
import { errMsg } from '@/services/errors';
import { TLink } from '@/components/shared/TLink';
import { Logo } from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { SmartImage } from '@/components/ui/SmartImage';
import { Badge } from '@/components/ui/Badge';
 
function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { config } = useTenant();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <SmartImage src={config.branding.heroImageUrl} alt="" width={1200} className="absolute inset-0 h-full w-full" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/50" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white"><p className="font-serif text-4xl font-semibold leading-tight">{config.home.headline}</p><p className="mt-2 text-white/70">{config.branding.tagline}</p></div>
        <div className="absolute left-10 top-8"><Logo light /></div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="font-serif text-4xl font-semibold">{title}</h1><p className="mt-1 text-ink-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
 
export function LoginPage() {
  const { tenant, to } = useTenant();
  const { user, login, logout } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [error, setError] = useState('');
  const [demos, setDemos] = useState<{ role: string; name: string; email: string; password: string }[]>([]);
  const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => { services.auth.demoAccounts?.(tenant.id).then(setDemos).catch(() => undefined); }, [tenant.id]);
 
  const go = (role: keyof typeof ROLE_HOME) => nav(sp.get('next') ?? to(ROLE_HOME[role]), { replace: true });
  const submit = async (v: z.infer<typeof schema>) => {
    setError('');
    try { const u = await login({ ...v, tenantId: tenant.id }); go(u.role); } catch (e) { setError(errMsg(e)); }
  };
  if (user && user.tenantId === tenant.id) return <Navigate to={sp.get('next') ?? to(ROLE_HOME[user.role])} replace />;
 
  return (
    <AuthShell title="Welcome back" subtitle={`Sign in to your ${tenant.name} account.`}>
      {user && user.tenantId !== tenant.id && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>You are signed in as <b>{user.name}</b> ({ROLE_LABEL[user.role]}) on another account. <button className="underline" onClick={() => logout()}>Sign out</button> to use this studio.</span></div>
      )}
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" invalid={!!errors.email} className="!h-11" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" invalid={!!errors.password} className="!h-11" {...register('password')} /></Field>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">New here? <TLink to="/register" className="font-semibold text-brand-dark underline">Create a client account</TLink></p>
      {demos.length > 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-paper-2/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Demo accounts <Badge tone="warning" className="ml-1">mock mode</Badge></p>
          <p className="mt-1 text-xs text-ink-muted">Click to sign in instantly. Mock auth is for development only — it is not production security.</p>
          <ul className="mt-3 grid gap-1.5">{demos.map((d) => (
            <li key={d.email}><button type="button" onClick={() => { setValue('email', d.email); setValue('password', d.password); void submit({ email: d.email, password: d.password }); }} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left text-sm transition hover:border-brand"><span className="min-w-0"><span className="block truncate font-medium">{d.name}</span><span className="block truncate text-xs text-ink-muted">{d.email}</span></span><Badge tone="brand">{ROLE_LABEL[d.role as keyof typeof ROLE_LABEL]}</Badge></button></li>
          ))}</ul>
        </div>
      )}
    </AuthShell>
  );
}
 
export function RegisterPage() {
  const { tenant, to } = useTenant();
  const { user, register: signUp } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState('');
  const schema = z.object({
    name: z.string().trim().min(2, 'Please enter your name'), email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,}$/, 'Enter a valid phone number'),
    password: z.string().min(8, 'Use at least 8 characters').regex(/\d/, 'Include at least one number'), confirm: z.string(),
  }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (user && user.tenantId === tenant.id) return <Navigate to={to(ROLE_HOME[user.role])} replace />;
  const submit = async (v: z.infer<typeof schema>) => {
    setError('');
    try { const u = await signUp({ name: v.name, email: v.email, phone: v.phone, password: v.password, tenantId: tenant.id }); nav(to(ROLE_HOME[u.role]), { replace: true }); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <AuthShell title="Create your account" subtitle={`Track bookings and receive your photographs from ${tenant.name}.`}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <Field label="Full name" error={errors.name?.message}><Input autoComplete="name" invalid={!!errors.name} className="!h-11" {...register('name')} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" invalid={!!errors.email} className="!h-11" {...register('email')} /></Field>
          <Field label="Phone" error={errors.phone?.message}><Input type="tel" autoComplete="tel" invalid={!!errors.phone} className="!h-11" {...register('phone')} /></Field>
          <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" invalid={!!errors.password} className="!h-11" {...register('password')} /></Field>
          <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" invalid={!!errors.confirm} className="!h-11" {...register('confirm')} /></Field>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">Already registered? <TLink to="/login" className="font-semibold text-brand-dark underline">Sign in</TLink></p>
    </AuthShell>
  );
}