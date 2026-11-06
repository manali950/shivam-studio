import { useState } from 'react';
import { z } from 'zod';
import { Globe, Info } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useSaveConfig } from '@/hooks/admin';
import { SectionForm } from '@/components/shared/SectionForm';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Kv } from '@/components/shared/Bits';
import { Tabs } from '@/components/ui/Tabs';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatDate } from '@/lib/utils';
 
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #B08D57');
const url = z.string().trim().refine((v) => v === '' || /^https?:\/\//.test(v) || v.startsWith('/'), 'Enter an image URL');
const businessSchema = z.object({ legalName: z.string().trim().min(2, 'Enter your legal name'), taxId: z.string().trim().max(30).optional(), invoicePrefix: z.string().trim().min(2, '2–6 letters').max(6, '2–6 letters').regex(/^[A-Za-z0-9-]+$/, 'Letters and numbers only'), timezone: z.string().min(1), currency: z.enum(['INR', 'USD', 'EUR', 'GBP']), locale: z.string().min(2) });
const bookingSchema = z.object({ enquiryEnabled: z.boolean(), autoConfirm: z.boolean(), requireDeposit: z.boolean(), depositPercent: z.number({ invalid_type_error: '0–100' }).min(0, '0–100').max(100, '0–100'), minLeadDays: z.number({ invalid_type_error: '0–365' }).int().min(0, '0–365').max(365, '0–365') });
const alertSchema = z.object({ deliveryTargetHours: z.number({ invalid_type_error: '1–720' }).min(1, '1–720').max(720, '1–720'), emailOnNewBooking: z.boolean(), emailOnDelivery: z.boolean(), smsReminders: z.boolean(), reminderDaysBefore: z.number({ invalid_type_error: '0–30' }).int().min(0, '0–30').max(30, '0–30') });
const brandSchema = z.object({ logoUrl: url, faviconUrl: url, heroImageUrl: url, tagline: z.string().trim().min(3, 'Add a tagline').max(80), primaryColor: hex, secondaryColor: hex });
 
type Tab = 'business' | 'booking' | 'delivery' | 'branding' | 'domains';
const TZ = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney'].map((v) => ({ value: v, label: v }));
 
export default function SettingsPage() {
  const { tenant, config } = useTenant(); const save = useSaveConfig(); const [tab, setTab] = useState<Tab>('business');
  const s = config.settings;
  return (
    <div className="space-y-3">
      <PageHeader title="Settings" subtitle={`${tenant.name} · configuration`} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'business', label: 'Business' }, { key: 'booking', label: 'Booking rules' }, { key: 'delivery', label: 'Delivery & alerts' }, { key: 'branding', label: 'Branding' }, { key: 'domains', label: 'Domains' }]} />
      {tab === 'business' && <SectionForm key="b" title="Business details" subtitle="Used on invoices and money formatting across the studio." schema={businessSchema} saving={save.isPending}
        defaults={{ ...s.business, currency: s.currency, locale: s.locale, taxId: s.business.taxId }} onSave={(v) => { const { currency, locale, ...business } = v; save.mutate({ settings: { currency, locale, business: { ...business, taxId: business.taxId ?? '' } } }); }}
        fields={[{ name: 'legalName', label: 'Legal / business name', type: 'text', span: 2 }, { name: 'taxId', label: 'Tax ID (GSTIN / VAT)', type: 'text' }, { name: 'invoicePrefix', label: 'Invoice prefix', type: 'text' }, { name: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'EUR', 'GBP'].map((v) => ({ value: v, label: v })) }, { name: 'locale', label: 'Number format', type: 'select', options: [{ value: 'en-IN', label: 'English (India) · 1,23,456' }, { value: 'en-US', label: 'English (US) · 123,456' }, { value: 'en-GB', label: 'English (UK) · 123,456' }] }, { name: 'timezone', label: 'Time zone', type: 'select', options: TZ }]} />}
      {tab === 'booking' && <SectionForm key="k" title="Booking rules" subtitle="Control how website enquiries behave." schema={bookingSchema} saving={save.isPending} defaults={s.booking} onSave={(v) => save.mutate({ settings: { booking: v } })}
        fields={[{ name: 'enquiryEnabled', label: 'Accept new booking enquiries on the website', type: 'toggle', hint: 'Turn off while you are fully booked — the form shows a polite message.' }, { name: 'autoConfirm', label: 'Auto-confirm enquiries', type: 'toggle', hint: 'Not recommended: you will not get to check availability first.' }, { name: 'requireDeposit', label: 'Require an advance deposit', type: 'toggle' }, { name: 'depositPercent', label: 'Deposit (% of package price)', type: 'number', min: 0, max: 100 }, { name: 'minLeadDays', label: 'Minimum notice (days)', type: 'number', min: 0, max: 365, hint: 'Earliest date customers can request.' }]} />}
      {tab === 'delivery' && <SectionForm key="d" title="Photo delivery & notifications" subtitle="Your delivery promise and who gets told what." schema={alertSchema} saving={save.isPending}
        defaults={{ deliveryTargetHours: s.deliveryTargetHours, ...s.notifications }} onSave={(v) => { const { deliveryTargetHours, ...notifications } = v; save.mutate({ settings: { deliveryTargetHours, notifications } }); }}
        fields={[{ name: 'deliveryTargetHours', label: 'Highlights target (hours after the event)', type: 'number', min: 1, max: 720, hint: 'New events start with this target. 24 = next-day highlights. Overdue only flags the delivery board.' }, { name: 'reminderDaysBefore', label: 'Event reminder (days before)', type: 'number', min: 0, max: 30 }, { name: 'emailOnNewBooking', label: 'Email me when a new enquiry arrives', type: 'toggle' }, { name: 'emailOnDelivery', label: 'Email clients when photos are published', type: 'toggle' }, { name: 'smsReminders', label: 'SMS reminders to clients', type: 'toggle', hint: 'In-app notifications are always sent. Email/SMS delivery needs a provider configured on the backend.' }]} />}
      {tab === 'branding' && <SectionForm key="r" title="Branding" subtitle="Colours and imagery apply to your website, portals and emails instantly." schema={brandSchema} saving={save.isPending} defaults={config.branding} onSave={(v) => save.mutate({ branding: v })}
        fields={[{ name: 'tagline', label: 'Tagline', type: 'text', span: 2 }, { name: 'primaryColor', label: 'Primary colour', type: 'color' }, { name: 'secondaryColor', label: 'Accent colour', type: 'color' }, { name: 'logoUrl', label: 'Logo URL', type: 'url' }, { name: 'faviconUrl', label: 'Favicon URL', type: 'url' }, { name: 'heroImageUrl', label: 'Hero image URL', type: 'url', span: 2 }]}
        aside={(f) => { const v = f.watch(); return (
          <div className="space-y-2 rounded-xl border border-line p-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Preview</p>
            <div className="flex items-center gap-2"><SmartImage src={v.logoUrl} alt="" className="h-10 w-10 rounded-lg" /><p className="font-serif text-lg font-semibold">{tenant.name}</p></div>
            <div className="flex gap-2"><span className="h-9 flex-1 rounded-lg" style={{ background: hex.safeParse(v.primaryColor).success ? v.primaryColor : '#ddd' }} /><span className="h-9 flex-1 rounded-lg" style={{ background: hex.safeParse(v.secondaryColor).success ? v.secondaryColor : '#ddd' }} /></div>
            <p className="text-xs text-ink-muted">{v.tagline}</p></div>); }} />}
      {tab === 'domains' && (
        <Card>
          <CardHeader title="Domains & tenant resolution" subtitle="Where customers reach this studio" />
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Kv k="Subdomain"><span className="font-mono text-[13px]">{tenant.subdomain}.&lt;platform-domain&gt;</span></Kv><Kv k="Custom domain">{tenant.customDomain ? <span className="inline-flex items-center gap-1 font-mono text-[13px]"><Globe className="h-3.5 w-3.5" />{tenant.customDomain}</span> : <span className="text-ink-faint">Not connected</span>}</Kv><Kv k="Status"><StatusBadge status={tenant.status} /></Kv></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Kv k="Plan status"><StatusBadge status={tenant.subscriptionStatus} /></Kv><Kv k="Renews">{tenant.renewsAt ? formatDate(tenant.renewsAt) : '—'}</Kv><Kv k="Studio ID"><span className="font-mono text-xs">{tenant.id}</span></Kv></div>
            <div className="flex gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><Info className="mt-0.5 h-4 w-4 shrink-0" /><div className="space-y-1"><p>Domain changes are made by the platform administrator so DNS and certificates stay consistent. To connect <b>your own domain</b>, point a CNAME record at the platform host and ask support to attach it.</p><p>The app resolves your studio from the <b>custom domain</b>, then the <b>subdomain</b>, then (in development) the <b>/{tenant.slug}</b> path.</p></div></div>
            <Badge tone="neutral">Tenant isolation is enforced server-side on every request</Badge>
          </div>
        </Card>
      )}
    </div>
  );
}