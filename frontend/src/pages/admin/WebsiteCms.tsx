import { z } from 'zod';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useSaveConfig } from '@/hooks/admin';
import { SectionForm } from '@/components/shared/SectionForm';
import { TLink } from '@/components/shared/TLink';
import { btn, Button, IconButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Tabs } from '@/components/ui/Tabs';
 
const optUrl = z.string().trim().refine((v) => v === '' || /^https?:\/\//.test(v), 'Enter a full https:// link').optional();
const imgUrl = z.string().trim().refine((v) => v === '' || /^https?:\/\//.test(v) || v.startsWith('/'), 'Enter an image URL');
 
const homeSchema = z.object({ headline: z.string().trim().min(5, 'Headline is required').max(90), subheadline: z.string().trim().min(10, 'Add a supporting line').max(220), heroCtaLabel: z.string().trim().min(2, 'Button label is required').max(24), featuredPhotoUrls: z.array(imgUrl) });
const aboutSchema = z.object({
  title: z.string().trim().min(3, 'Enter a title'), intro: z.string().trim().min(20, 'Write a short intro'), history: z.string().trim().min(20, 'Tell your story'), philosophy: z.string().trim().min(20, 'Describe your approach'),
  achievements: z.array(z.object({ label: z.string().trim().min(1, 'Label'), value: z.string().trim().min(1, 'Value') })), milestones: z.array(z.object({ year: z.string().trim().min(4, 'Year'), text: z.string().trim().min(3, 'Describe it') })),
});
const contactSchema = z.object({ email: z.string().trim().email('Enter a valid email'), phone: z.string().trim().min(7, 'Enter a phone number'), whatsapp: z.string().trim().regex(/^\d{8,15}$/, 'Digits only with country code, e.g. 919876543210'), address: z.string().trim().min(5, 'Enter your address'), city: z.string().trim().min(2, 'Enter your city'), mapUrl: optUrl, hours: z.string().trim().max(120).optional() });
const socialSchema = z.object({ instagram: optUrl, facebook: optUrl, youtube: optUrl, twitter: optUrl, pinterest: optUrl, text: z.string().trim().max(200).optional(), copyright: z.string().trim().max(120).optional() });
 
type Tab = 'home' | 'about' | 'contact' | 'social';
 
export default function WebsiteCms() {
  const { config, to } = useTenant(); const save = useSaveConfig(); const [tab, setTab] = useState<Tab>('home');
  return (
    <div className="space-y-3">
      <PageHeader title="Website content" subtitle="Edit what visitors see. Changes go live on your public website as soon as you save."
        actions={<TLink to="/" target="_blank" className={btn('outline', 'sm')}><ExternalLink className="h-4 w-4" />View website</TLink>} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'home', label: 'Home page' }, { key: 'about', label: 'About' }, { key: 'contact', label: 'Contact' }, { key: 'social', label: 'Social & footer' }]} />
      {tab === 'home' && <SectionForm key="home" title="Home page hero" subtitle="The first thing visitors read." schema={homeSchema} saving={save.isPending} onSave={(v) => save.mutate({ home: v })} defaults={config.home}
        fields={[{ name: 'headline', label: 'Headline', type: 'text', span: 2 }, { name: 'subheadline', label: 'Supporting line', type: 'textarea', rows: 2 }, { name: 'heroCtaLabel', label: 'Button label', type: 'text' }, { name: 'featuredPhotoUrls', label: 'Featured photograph URLs', type: 'tags', placeholder: 'Paste an image URL and press Enter', hint: 'Shown in the home page highlight strip.' }]} />}
      {tab === 'about' && <SectionForm key="about" title="About your studio" subtitle="Your story, numbers and milestones." schema={aboutSchema} saving={save.isPending} onSave={(v) => save.mutate({ about: v })} defaults={config.about}
        fields={[{ name: 'title', label: 'Page title', type: 'text', span: 2 }, { name: 'intro', label: 'Intro', type: 'textarea', rows: 3 }, { name: 'history', label: 'Our story', type: 'textarea', rows: 4 }, { name: 'philosophy', label: 'Philosophy', type: 'textarea', rows: 3 }]}
        extra={(f) => (<><Rows f={f} name="achievements" title="Achievements" a="label" b="value" aLabel="Label (e.g. Weddings)" bLabel="Value (e.g. 450+)" /><Rows f={f} name="milestones" title="Milestones" a="year" b="text" aLabel="Year" bLabel="What happened" /></>)} />}
      {tab === 'contact' && <SectionForm key="contact" title="Contact details" subtitle="Used on the Contact page, footer and the WhatsApp button." schema={contactSchema} saving={save.isPending} onSave={(v) => save.mutate({ contact: v })} defaults={config.contact}
        fields={[{ name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'text' }, { name: 'whatsapp', label: 'WhatsApp number', type: 'text', hint: 'Digits with country code, no + or spaces.' }, { name: 'city', label: 'City', type: 'text' }, { name: 'address', label: 'Address', type: 'text', span: 2 }, { name: 'hours', label: 'Opening hours', type: 'text', span: 2 }, { name: 'mapUrl', label: 'Google Maps link', type: 'url', span: 2 }]} />}
      {tab === 'social' && <SectionForm key="social" title="Social links & footer" subtitle="Leave a link blank to hide that icon." schema={socialSchema} saving={save.isPending}
        onSave={(v) => { const { text, copyright, ...social } = v; save.mutate({ social, footer: { text: text ?? '', copyright: copyright ?? '' } }); }} defaults={{ ...config.social, instagram: config.social.instagram ?? '', facebook: config.social.facebook ?? '', youtube: config.social.youtube ?? '', twitter: config.social.twitter ?? '', pinterest: config.social.pinterest ?? '', text: config.footer.text, copyright: config.footer.copyright }}
        fields={[{ name: 'instagram', label: 'Instagram', type: 'url' }, { name: 'facebook', label: 'Facebook', type: 'url' }, { name: 'youtube', label: 'YouTube channel', type: 'url' }, { name: 'twitter', label: 'X / Twitter', type: 'url' }, { name: 'pinterest', label: 'Pinterest', type: 'url' }, { name: 'text', label: 'Footer text', type: 'text', span: 2 }, { name: 'copyright', label: 'Copyright line', type: 'text', span: 2 }]} />}
      <span className="hidden">{to('/')}</span>
    </div>
  );
}
 
/** Repeating two-field rows (achievements / milestones) for the About form. */
function Rows({ f, name, title, a, b, aLabel, bLabel }: { f: UseFormReturn<any>; name: string; title: string; a: string; b: string; aLabel: string; bLabel: string }) {
  const { fields, append, remove } = useFieldArray({ control: f.control, name });
  const errs = (f.formState.errors as any)[name] as any[] | undefined;
  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-ink-2">{title}</p><Button size="xs" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => append({ [a]: '', [b]: '' })}>Add</Button></div>
      {fields.map((row, i) => (
        <div key={row.id} className="grid grid-cols-[7rem_1fr_auto] items-start gap-2">
          <Input aria-label={aLabel} placeholder={aLabel} invalid={!!errs?.[i]?.[a]} {...f.register(`${name}.${i}.${a}`)} />
          <Input aria-label={bLabel} placeholder={bLabel} invalid={!!errs?.[i]?.[b]} {...f.register(`${name}.${i}.${b}`)} />
          <IconButton label={`Remove ${title} row ${i + 1}`} onClick={() => remove(i)} className="hover:text-red-600"><Trash2 className="h-4 w-4" /></IconButton>
        </div>))}
    </div>
  );
}