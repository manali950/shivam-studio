import { addSearch } from '../../db/query.js';
import { assertRefs } from '../../db/refs.js';
import { audit } from '../../lib/audit.js';
import { conflict, forbidden, invalid, notFound } from '../../lib/errors.js';
import { isStaff, requireStaff } from '../../lib/handlers.js';
import { Page, type Ctx } from '../../lib/types.js';
import { todayIn } from '../../lib/validation.js';
import { eventsRepository } from '../events/events.repository.js';
import { createFromBooking } from '../events/events.workflow.js';
import { adminUserIds, clientUserId, notify, photographerUserIds } from '../notifications.js';
import { getSettings } from '../tenants/config.js';
import { bookingsRepository as repo, type Booking } from './bookings.repository.js';
import { assignSchema, bookingQuery, createBookingSchema, noteSchema, statusSchema, updateBookingSchema } from './bookings.schemas.js';
 
/** Who may see which bookings: staff all · client their own · photographer only those they are assigned to · anonymous none. */
function scope(ctx: Ctx, q: import('../../db/query.js').Query) {
  const p = ctx.principal;
  if (isStaff(p)) return;
  if (p?.role === 'client' && p.clientId) q.where('b.client_id = ?', p.clientId);
  else if (p?.role === 'photographer' && p.photographerId) q.where('EXISTS (SELECT 1 FROM booking_photographers bp WHERE bp.booking_id = b.id AND bp.photographer_id = ?)', p.photographerId);
  else q.raw('false');
}
 
const derivePayment = (paid: number, amount: number): Booking['paymentStatus'] => (paid <= 0 ? 'unpaid' : paid >= amount ? 'paid' : 'partial');
 
/** Links the booking to a customer record (creating it from the enquiry details when needed). */
async function ensureClient(ctx: Ctx, b: Booking): Promise<string> {
  if (b.clientId) return b.clientId;
  const found = (await ctx.db.query<{ id: string }>('SELECT id FROM clients WHERE tenant_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL', [ctx.tenantId, b.customer.email])).rows[0];
  const id = found?.id ?? (await ctx.db.query<{ id: string }>(
    `INSERT INTO clients (tenant_id, name, email, phone, source) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [ctx.tenantId, b.customer.name, b.customer.email, b.customer.phone, b.source === 'manual' ? 'walk-in' : b.source])).rows[0].id;
  await repo.update(ctx.db, ctx.tenantId, b.id, { clientId: id });
  return id;
}
 
export const bookingsService = {
  async list(ctx: Ctx, raw: unknown) {
    const p = bookingQuery.parse(raw);
    const { items, total } = await repo.list(ctx.db, ctx.tenantId, (q) => {
      scope(ctx, q);
      addSearch(q, p.search, ['b.reference', 'b.customer_name', 'b.customer_email', 'b.location']);
      if (p.status) q.where('b.status = ?', p.status);
      if (p.clientId) q.where('b.client_id = ?', p.clientId);
      if (p.paymentStatus) q.where('b.payment_status = ?', p.paymentStatus);
      if (p.photographerId) q.where('EXISTS (SELECT 1 FROM booking_photographers bp WHERE bp.booking_id = b.id AND bp.photographer_id = ?)', p.photographerId);
      if (p.from) q.where('b.event_date >= ?', p.from);
      if (p.to) q.where('b.event_date <= ?', p.to);
    }, { sort: p.sort, order: p.order, page: p.page, pageSize: p.pageSize });
    return new Page(items, total, p.page, p.pageSize);
  },
 
  async get(ctx: Ctx, id: string) {
    return (await repo.get(ctx.db, ctx.tenantId, id, (q) => scope(ctx, q))) ?? Promise.reject(notFound('Booking'));
  },
 
  /** Public enquiry (anonymous or signed-in client) or manual booking by staff. */
  async create(ctx: Ctx, body: unknown) {
    const input = createBookingSchema.parse(body);
    const staff = isStaff(ctx.principal);
    const tenant = (await ctx.db.query<{ status: string }>('SELECT status FROM tenants WHERE id = $1', [ctx.tenantId])).rows[0];
    if (tenant.status === 'inactive') throw forbidden('This studio is not accepting bookings.', 'TENANT_INACTIVE');
    const settings = await getSettings(ctx.db, ctx.tenantId);
    if (!settings.booking.enquiryEnabled && !staff) throw forbidden('Online enquiries are currently closed.', 'ENQUIRIES_CLOSED');
 
    const svc = (await ctx.db.query<{ id: string; name: string; starting_price: number }>(
      `SELECT id, name, starting_price FROM services WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL AND ($3 OR status = 'active')`,
      [ctx.tenantId, input.serviceId, staff])).rows[0];
    if (!svc) throw invalid('Please choose a valid service.');
    const pkg = input.packageId
      ? (await ctx.db.query<{ id: string; price: number }>('SELECT id, price FROM packages WHERE tenant_id = $1 AND id = $2 AND service_id = $3 AND deleted_at IS NULL', [ctx.tenantId, input.packageId, svc.id])).rows[0]
      : null;
    if (input.packageId && !pkg) throw invalid('That package does not belong to the selected service.');
    if (!staff && input.eventDate < todayIn(settings.business.timezone)) throw invalid('Event date must be in the future.', { eventDate: 'Choose a future date' });
 
    const client = ctx.principal?.role === 'client' && ctx.principal.clientId
      ? (await ctx.db.query<{ id: string; name: string; email: string; phone: string }>('SELECT id, name, email, phone FROM clients WHERE tenant_id = $1 AND id = $2', [ctx.tenantId, ctx.principal.clientId])).rows[0]
      : (await ctx.db.query<{ id: string; name: string; email: string; phone: string }>('SELECT id, name, email, phone FROM clients WHERE tenant_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL', [ctx.tenantId, input.customer.email])).rows[0];
    const customer = client && ctx.principal?.role === 'client' ? client : input.customer;
 
    const reference = await repo.nextReference(ctx.db, ctx.tenantId, settings.business.invoicePrefix || 'BK');
    const status = staff ? input.status ?? 'enquiry' : 'enquiry';
    const id = await repo.insert(ctx.db, ctx.tenantId, {
      reference, clientId: client?.id ?? null, customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone ?? '',
      serviceId: svc.id, packageId: pkg?.id ?? null, eventDate: input.eventDate, location: input.location, guestCount: input.guestCount ?? null,
      requirements: input.requirements ?? '', status, paymentStatus: 'unpaid', amount: (staff ? input.amount : undefined) ?? pkg?.price ?? svc.starting_price,
      paidAmount: 0, source: staff ? input.source ?? 'manual' : 'website',
    });
    let booking = (await repo.get(ctx.db, ctx.tenantId, id))!;
    if (status === 'confirmed') { await ensureClient(ctx, booking); await createFromBooking(ctx, booking.id); booking = (await repo.get(ctx.db, ctx.tenantId, id))!; }
 
    await notify(ctx.db, ctx.tenantId, await adminUserIds(ctx.db, ctx.tenantId), {
      type: 'new_enquiry', title: `New enquiry — ${booking.customer.name}`, body: `${svc.name} · ${booking.location} · ${booking.eventDate}`, link: '/admin/bookings' });
    await audit(ctx, 'create', 'booking', id, { source: booking.source });
    return booking;
  },
 
  async update(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    const existing = (await repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound('Booking'); })();
    const input = updateBookingSchema.parse(body);
    if (input.serviceId || input.packageId) {
      const serviceId = input.serviceId ?? existing.serviceId;
      await assertRefs(ctx.db, ctx.tenantId, 'services', [serviceId], 'Please choose a valid service.');
      if (input.packageId) {
        const ok = await ctx.db.query('SELECT 1 FROM packages WHERE tenant_id = $1 AND id = $2 AND service_id = $3 AND deleted_at IS NULL', [ctx.tenantId, input.packageId, serviceId]);
        if (!ok.rowCount) throw invalid('That package does not belong to the selected service.');
      }
    }
    const values: Record<string, unknown> = { ...input };
    if (input.customer) {
      const c = { ...existing.customer, ...input.customer };
      Object.assign(values, { customerName: c.name, customerEmail: c.email, customerPhone: c.phone });
    }
    const paid = input.paidAmount ?? existing.paidAmount; const amount = input.amount ?? existing.amount;
    if ((input.paidAmount !== undefined || input.amount !== undefined) && input.paymentStatus === undefined && existing.paymentStatus !== 'refunded') values.paymentStatus = derivePayment(paid, amount);
    await repo.update(ctx.db, ctx.tenantId, id, values);
    await audit(ctx, 'update', 'booking', id, { fields: Object.keys(input) });
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async remove(ctx: Ctx, id: string) {
    requireStaff(ctx);
    if (!(await repo.softDelete(ctx.db, ctx.tenantId, id))) throw notFound('Booking');
    await audit(ctx, 'delete', 'booking', id);
  },
 
  /** Status transitions. Confirming a booking creates the customer record and the event, then notifies the client. */
  async setStatus(ctx: Ctx, id: string, body: unknown) {
    const me = requireStaff(ctx);
    const { status, note } = statusSchema.parse(body);
    const b = (await repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound('Booking'); })();
    if (b.status === 'completed' && status !== 'completed') throw conflict('Completed bookings cannot be changed.');
    await repo.update(ctx.db, ctx.tenantId, id, { status });
    if (status === 'confirmed') { await ensureClient(ctx, b); await createFromBooking(ctx, id); }
    if (note) await repo.addNote(ctx.db, ctx.tenantId, id, { userId: me.userId, name: me.name, text: note });
    const messages: Partial<Record<Booking['status'], [string, string]>> = {
      confirmed: ['Booking confirmed 🎉', `Your booking ${b.reference} is confirmed for ${b.eventDate}.`],
      rejected: ['Booking update', `Unfortunately we cannot take booking ${b.reference}. ${note ?? ''}`.trim()],
      cancelled: ['Booking cancelled', `Booking ${b.reference} has been cancelled.`],
      pending: ['Booking under review', `We are reviewing booking ${b.reference} and will confirm shortly.`],
    };
    const m = messages[status];
    const fresh = (await repo.get(ctx.db, ctx.tenantId, id))!;
    if (m && b.status !== status) await notify(ctx.db, ctx.tenantId, [await clientUserId(ctx.db, ctx.tenantId, fresh.clientId)], { type: status === 'confirmed' ? 'booking_confirmed' : 'booking_update', title: m[0], body: m[1], link: '/portal/bookings' });
    await audit(ctx, 'status', 'booking', id, { from: b.status, to: status });
    return fresh;
  },
 
  async assignPhotographers(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    const { photographerIds } = assignSchema.parse(body);
    const b = (await repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound('Booking'); })();
    await assertRefs(ctx.db, ctx.tenantId, 'photographers', photographerIds, 'One or more photographers do not belong to this studio.');
    const added = photographerIds.filter((p) => !b.assignedPhotographerIds.includes(p));
    await repo.setPhotographers(ctx.db, ctx.tenantId, id, photographerIds);
    if (b.eventId) await eventsRepository.setPhotographers(ctx.db, ctx.tenantId, b.eventId, photographerIds);
    await ctx.db.query('UPDATE bookings SET updated_at = now() WHERE tenant_id = $1 AND id = $2', [ctx.tenantId, id]);
    await notify(ctx.db, ctx.tenantId, await photographerUserIds(ctx.db, ctx.tenantId, added), { type: 'booking_update', title: `You were assigned to ${b.customer.name}`, body: `${b.eventDate} · ${b.location}`, link: '/photographer/events' });
    await audit(ctx, 'assign', 'booking', id, { photographerIds });
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async addNote(ctx: Ctx, id: string, body: unknown) {
    const me = requireStaff(ctx);
    const { text } = noteSchema.parse(body);
    if (!(await repo.get(ctx.db, ctx.tenantId, id))) throw notFound('Booking');
    return repo.addNote(ctx.db, ctx.tenantId, id, { userId: me.userId, name: me.name, text });
  },
};