import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { services } from '@/services/data-provider';
import { DATA_MODE } from '@/services/data-provider';
import { errMsg } from '@/services/errors';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
 
const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
 
export default function PlatformLogin() {
  const { user, login, logout } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams();
  const [error, setError] = useState(''); const [demo, setDemo] = useState<{ email: string; password: string }[]>([]);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => { services.auth.demoAccounts?.(null).then(setDemo).catch(() => undefined); }, []);
  if (user?.role === 'super_admin') return <Navigate to={sp.get('next') ?? '/platform'} replace />;
  const submit = async (v: z.infer<typeof schema>) => {
    setError('');
    try { const u = await login({ ...v, tenantId: null }); if (u.role !== 'super_admin') { await logout(); setError('This sign-in is for platform administrators only.'); return; } nav(sp.get('next') ?? '/platform', { replace: true }); } catch (e) { setError(errMsg(e)); }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-[#14122e] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/30 ring-1 ring-violet-300/30"><Camera className="h-5 w-5" /></span><span className="font-serif text-2xl font-semibold">shivamStudio <span className="text-violet-300">Platform</span></span></div>
        <div className="rounded-2xl bg-white p-6 shadow-pop sm:p-8">
          <h1 className="flex items-center gap-2 font-serif text-3xl font-semibold"><ShieldCheck className="h-6 w-6 text-violet-600" />Platform sign-in</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage studios, plans and platform settings.</p>
          {user && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Signed in as {user.name}, who is not a platform administrator. <button className="font-semibold underline" onClick={() => logout()}>Sign out</button></p>}
          <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
            <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="username" className="!h-11" invalid={!!errors.email} {...register('email')} /></Field>
            <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" className="!h-11" invalid={!!errors.password} {...register('password')} /></Field>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
          </form>
          {DATA_MODE === 'mock' && demo[0] && (
            <div className="mt-5 rounded-xl border border-dashed border-line p-3 text-xs text-ink-muted"><p className="font-semibold text-ink-2">Demo mode</p><p className="mt-0.5">Mock sign-in is not real security — see the README. <button type="button" className="font-semibold text-violet-700 underline" onClick={() => { setValue('email', demo[0].email); setValue('password', demo[0].password); }}>Fill demo credentials</button></p></div>
          )}
        </div>
      </div>
    </div>
  );
}