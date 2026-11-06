import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { errMsg } from '@/services/errors';
import { isoDay, titleCase } from '@/lib/utils';
import { TLink } from '@/components/shared/TLink';
import { Button, btn } from '@/components/ui/Button';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/Form';
import { PageBanner } from './parts';
 
const phone = z.string().trim().min(7, 'Enter a valid phone number').regex(/^[+\d][\d\s()-]{6,}$/, 'Enter a valid phone number');
 
/* ------------------------------------------------------------------ contact */
const contactSchema = z.object({ name: z.string().trim().min(2, 'Please enter your name'), email: z.string().trim().email('Enter a valid email'), phone: phone.optional().or(z.literal('')), message: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(1500) });
type ContactForm = z.infer<typeof contactSchema>;
 
export function ContactPage() {
  const { tenant, config } = useTenant();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactForm>({ resolver: zodResolver(contactSchema) });
  const c = config.contact;
  const submit = async (v: ContactForm) => {
    setBusy(true);
    try { await services.tenants.submitContact(tenant.id, v); setSent(true); reset(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const info = [[Phone, 'Call', c.phone, `tel:${c.phone.replace(/\s/g, '')}`], [Mail, 'Email', c.email, `mailto:${c.email}`], [MessageCircle, 'WhatsApp', 'Message us on WhatsApp', `https://wa.me/${c.whatsapp}`], [MapPin, 'Studio', c.address, c.mapUrl], [Clock, 'Hours', c.hours, '']] as const;
  return (
    <>
      <PageBanner eyebrow="Contact" title="Let's talk about your story" subtitle="Questions, availability or a custom quote — we reply within one working day." />
      <section className="container-x grid gap-10 py-14 lg:grid-cols-12">
        <ul className="space-y-3 lg:col-span-5">
          {info.map(([Icon, label, value, href]) => (
            <li key={label} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="text-xs text-ink-muted">{label}</p>{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener" className="break-words font-medium hover:text-brand-dark">{value || '—'}</a> : <p className="font-medium">{value || '—'}</p>}</div>
            </li>
          ))}
          {c.address && <li className="overflow-hidden rounded-2xl border border-line"><iframe title="Studio location map" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full border-0" src={`https://maps.google.com/maps?q=${encodeURIComponent(c.address)}&z=14&output=embed`} /></li>}
        </ul>
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            {sent ? (
              <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><h2 className="mt-4 font-serif text-3xl font-semibold">Message sent</h2><p className="mt-2 text-ink-muted">Thank you — {tenant.name} will reply within one working day.</p><Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another message</Button></div>
            ) : (
              <form onSubmit={handleSubmit(submit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
                <h2 className="font-serif text-3xl font-semibold sm:col-span-2">Send us a message</h2>
                <Field label="Your name" required error={errors.name?.message}><Input autoComplete="name" invalid={!!errors.name} {...register('name')} /></Field>
                <Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} /></Field>
                <Field label="Phone / WhatsApp" error={errors.phone?.message} className="sm:col-span-2"><Input type="tel" autoComplete="tel" invalid={!!errors.phone} {...register('phone')} /></Field>
                <Field label="Message" required error={errors.message?.message} className="sm:col-span-2"><Textarea rows={5} invalid={!!errors.message} {...register('message')} /></Field>
                <Button type="submit" size="lg" loading={busy} className="sm:col-span-2">Send message</Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
 
/* ------------------------------------------------------------------ booking enquiry */
export function BookingPage() {
  const { tenant, config, money } = useTenant();
  const { user } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [done, setDone] = useState<{ reference: string; email: string } | null>(null);
  // The confirmation replaces a long form: bring it into view (on phones the visitor submits from the bottom of the page).
  useEffect(() => { if (done) window.scrollTo({ top: 0, behavior: 'auto' }); }, [done]);
  const bs = config.settings.booking;
  const minDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + bs.minLeadDays); return isoDay(d); }, [bs.minLeadDays]);
 
  const svcQ = useTenantQuery(['services', 'public'], (t) => services.services.list(t, { pageSize: 30, status: 'active', sort: 'sortOrder' } as any));
  const pkgQ = useTenantQuery(['packages', 'public'], (t) => services.packages.list(t, { pageSize: 50, status: 'active', sort: 'sortOrder' } as any));
 
  const schema = useMemo(() => z.object({
    serviceId: z.string().min(1, 'Choose a service'), packageId: z.string().optional(),
    eventDate: z.string().min(1, 'Choose the event date').refine((d) => d >= minDate, `Dates must be at least ${bs.minLeadDays} days from today`),
    location: z.string().trim().min(3, 'Where will the event take place?'),
    guestCount: z.number({ invalid_type_error: 'Enter a number' }).int().min(1).max(5000).optional().or(z.nan().transform(() => undefined)),
    name: z.string().trim().min(2, 'Please enter your name'), email: z.string().trim().email('Enter a valid email'), phone,
    requirements: z.string().max(1000).optional(), consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm we may contact you' }) }),
  }), [minDate, bs.minLeadDays]);
  type F = z.infer<typeof schema>;
 
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { serviceId: sp.get('service') ?? '', packageId: sp.get('package') ?? '', name: user?.tenantId === tenant.id ? user.name : '', email: user?.tenantId === tenant.id ? user.email : '', phone: user?.tenantId === tenant.id ? user.phone : '' } as Partial<F>,
  });
  const serviceId = watch('serviceId'); const packageId = watch('packageId');
  const pkgs = (pkgQ.data?.items ?? []).filter((p) => p.serviceId === serviceId);
  const svc = svcQ.data?.items.find((s) => s.id === serviceId); const pkg = pkgs.find((p) => p.id === packageId);
  useEffect(() => { if (packageId && !pkgs.some((p) => p.id === packageId) && pkgQ.data) setValue('packageId', ''); }, [serviceId, pkgQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const price = pkg?.price ?? svc?.startingPrice ?? 0;
 
  const submit = async (v: F) => {
    try {
      const b = await services.bookings.create(tenant.id, { serviceId: v.serviceId, packageId: v.packageId || null, eventDate: v.eventDate, location: v.location, guestCount: v.guestCount ?? null, requirements: v.requirements ?? '', customer: { name: v.name, email: v.email, phone: v.phone } });
      setDone({ reference: b.reference, email: v.email });
    } catch (e) { toast.error(errMsg(e)); }
  };
 
  if (done) return (
    <><PageBanner eyebrow="Enquiry received" title="Thank you — we'll be in touch" />
      <section className="container-x max-w-2xl py-14 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <p className="mt-4 text-sm text-ink-muted">Your reference</p><p className="font-serif text-4xl font-semibold tracking-wide">{done.reference}</p>
        <p className="mx-auto mt-4 max-w-md text-ink-muted">{tenant.name} will confirm availability by email at <b className="text-ink">{done.email}</b> within one working day. A deposit of {bs.depositPercent}% secures your date once confirmed.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><TLink to="/register" className={btn('primary', 'lg')}>Create an account to track your booking</TLink><TLink to="/" className={btn('outline', 'lg')}>Back to home</TLink></div>
      </section></>
  );
 
  return (
    <>
      <PageBanner eyebrow="Booking enquiry" title="Check your date" subtitle="Tell us about your event. This is an enquiry — nothing is charged until we confirm." />
      <section className="container-x grid gap-8 py-12 lg:grid-cols-12">
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-8 lg:col-span-8">
          {!bs.enquiryEnabled && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Online enquiries are currently paused. Please call {config.contact.phone || 'the studio'} to book.</div>}
          <fieldset className="rounded-2xl border border-line bg-white p-5 sm:p-6"><legend className="px-2 font-serif text-xl font-semibold">1 · What are we photographing?</legend>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Service" required error={errors.serviceId?.message}><Select invalid={!!errors.serviceId} {...register('serviceId')}><option value="">Choose a service…</option>{svcQ.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Package (optional)" hint={serviceId && pkgs.length === 0 ? 'Custom quote for this service' : undefined}><Select disabled={!serviceId || pkgs.length === 0} {...register('packageId')}><option value="">Not sure yet / custom</option>{pkgs.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</Select></Field>
              <Field label="Event date" required error={errors.eventDate?.message}><Input type="date" min={minDate} invalid={!!errors.eventDate} {...register('eventDate')} /></Field>
              <Field label="Approx. guests" error={errors.guestCount?.message}><Input type="number" inputMode="numeric" min={1} placeholder="e.g. 250" {...register('guestCount', { valueAsNumber: true })} /></Field>
              <Field label="Event location / venue" required error={errors.location?.message} className="sm:col-span-2"><Input placeholder="Venue name and city" invalid={!!errors.location} {...register('location')} /></Field>
              <Field label="Special requirements" className="sm:col-span-2" error={errors.requirements?.message}><Textarea rows={3} placeholder="Rituals, shot lists, preferred photographer, drone, film…" {...register('requirements')} /></Field>
            </div>
          </fieldset>
          <fieldset className="rounded-2xl border border-line bg-white p-5 sm:p-6"><legend className="px-2 font-serif text-xl font-semibold">2 · Your details</legend>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={errors.name?.message}><Input autoComplete="name" invalid={!!errors.name} {...register('name')} /></Field>
              <Field label="Phone / WhatsApp" required error={errors.phone?.message}><Input type="tel" autoComplete="tel" invalid={!!errors.phone} {...register('phone')} /></Field>
              <Field label="Email" required error={errors.email?.message} className="sm:col-span-2"><Input type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} /></Field>
              <div className="sm:col-span-2"><Checkbox label="I agree that the studio may contact me about this enquiry." {...register('consent')} />{errors.consent && <p role="alert" className="mt-1 text-xs text-red-600">{errors.consent.message}</p>}</div>
            </div>
          </fieldset>
          <Button type="submit" size="lg" loading={isSubmitting} disabled={!bs.enquiryEnabled} className="w-full sm:w-auto">Send booking enquiry</Button>
        </form>
        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl bg-ink p-6 text-white">
              <p className="eyebrow !text-brand">Your estimate</p>
              <p className="mt-2 font-serif text-4xl font-semibold">{price ? money(price) : '—'}</p>
              <p className="mt-1 text-sm text-white/60">{pkg ? pkg.name : svc ? `${svc.name} · starting price` : 'Select a service to see pricing'}</p>
              {pkg && <ul className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm text-white/75"><li>{pkg.durationHours} hours · {pkg.photographerCount} photographer{pkg.photographerCount > 1 ? 's' : ''}</li>{pkg.deliverables.slice(0, 3).map((d) => <li key={d}>✓ {d}</li>)}</ul>}
              {price > 0 && bs.requireDeposit && <p className="mt-4 rounded-lg bg-white/10 p-3 text-xs text-white/80">Deposit to confirm: <b>{money(Math.round(price * bs.depositPercent / 100))}</b> ({bs.depositPercent}%)</p>}
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 text-sm text-ink-2"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-brand-dark" />What happens next</p><ol className="mt-3 list-inside list-decimal space-y-1.5 text-ink-muted"><li>We check availability for {svc ? titleCase(svc.category) : 'your'} date</li><li>You receive a tailored quote within one working day</li><li>Pay the deposit to lock the date</li><li>Get next-day highlights after your event</li></ol></div>
          </div>
        </aside>
      </section>
    </>
  );
}