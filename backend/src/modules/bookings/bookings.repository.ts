import type { Db } from '../../db/pool.js';
import { Query, orderBy, type SortSpec } from '../../db/query.js';
 
export interface Booking {
  id: string; tenantId: string; reference: string; clientId: string | null; customer: { name: string; email: string; phone: string };
  serviceId: string; packageId: string | null; eventDate: string; location: string; guestCount: number | null; requirements: string;
  status: 'enquiry' | 'pending' | 'confirmed' | 'completed' | 'rejected' | 'cancelled'; paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';
  amount: number; paidAmount: number; assignedPhotographerIds: string[]; notes: { id: string; authorName: string; text: string; createdAt: string }[];
  eventId: string | null; source: string; createdAt: string; updatedAt: string;
}
 
const SELECT = `
  b.id, b.tenant_id AS "tenantId", b.reference, b.client_id AS "clientId",
  jsonb_build_object('name', b.customer_name, 'email', b.customer_email, 'phone', b.customer_phone) AS customer,
  b.service_id AS "serviceId", b.package_id AS "packageId", b.event_date AS "eventDate", b.location, b.guest_count AS "guestCount", b.requirements,
  b.status, b.payment_status AS "paymentStatus", b.amount, b.paid_amount AS "paidAmount",
  COALESCE((SELECT jsonb_agg(bp.photographer_id ORDER BY bp.position) FROM booking_photographers bp WHERE bp.booking_id = b.id), '[]'::jsonb) AS "assignedPhotographerIds",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'authorName', n.author_name, 'text', n.text, 'createdAt', iso_ts(n.created_at)) ORDER BY n.created_at, n.id)
             FROM booking_notes n WHERE n.booking_id = b.id), '[]'::jsonb) AS notes,
  (SELECT e.id FROM events e WHERE e.booking_id = b.id AND e.deleted_at IS NULL LIMIT 1) AS "eventId",
  b.source, b.created_at AS "createdAt", b.updated_at AS "updatedAt"`;
 
const SORT: SortSpec = { fields: { createdAt: 'b.created_at', eventDate: 'b.event_date', amount: 'b.amount', status: 'b.status', reference: 'b.reference' }, default: 'createdAt', order: 'desc' };
 
const COLS: Record<string, string> = {
  clientId: 'client_id', customerName: 'customer_name', customerEmail: 'customer_email', customerPhone: 'customer_phone', serviceId: 'service_id', packageId: 'package_id',
  eventDate: 'event_date', location: 'location', guestCount: 'guest_count', requirements: 'requirements', status: 'status', paymentStatus: 'payment_status',
  amount: 'amount', paidAmount: 'paid_amount', source: 'source', reference: 'reference',
};
 
export const bookingsRepository = {
  async list(db: Db, tenantId: string, build: (q: Query) => void, o: { sort?: string; order?: 'asc' | 'desc'; page: number; pageSize: number }) {
    const q = new Query().where('b.tenant_id = ?', tenantId).raw('b.deleted_at IS NULL');
    build(q);
    const total = (await db.query<{ n: number }>(`SELECT count(*) AS n FROM bookings b ${q.whereSql}`, q.params)).rows[0].n;
    const sql = `SELECT ${SELECT} FROM bookings b ${q.whereSql} ${orderBy(SORT, o.sort, o.order, 'b.id')} LIMIT ${q.p(o.pageSize)} OFFSET ${q.p((o.page - 1) * o.pageSize)}`;
    return { items: (await db.query<Booking>(sql, q.params)).rows, total };
  },
  async get(db: Db, tenantId: string, id: string, build?: (q: Query) => void): Promise<Booking | null> {
    const q = new Query().where('b.tenant_id = ? AND b.id = ?', tenantId, id).raw('b.deleted_at IS NULL');
    build?.(q);
    return (await db.query<Booking>(`SELECT ${SELECT} FROM bookings b ${q.whereSql}`, q.params)).rows[0] ?? null;
  },
  async listForClient(db: Db, tenantId: string, clientId: string) {
    return (await this.list(db, tenantId, (q) => q.where('b.client_id = ?', clientId), { sort: 'eventDate', order: 'desc', page: 1, pageSize: 1000 })).items;
  },
  /** Next reference like RWP-2026-0007. The advisory lock makes concurrent enquiries get distinct numbers. */
  async nextReference(db: Db, tenantId: string, prefix: string): Promise<string> {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bookings:${tenantId}`]);
    const year = new Date().getUTCFullYear();
    const { rows } = await db.query<{ n: number }>(
      `SELECT COALESCE(MAX((substring(reference FROM '([0-9]+)$'))::int), 0) + 1 AS n FROM bookings WHERE tenant_id = $1`, [tenantId]);
    return `${prefix}-${year}-${String(rows[0].n).padStart(4, '0')}`;
  },
  async insert(db: Db, tenantId: string, v: Record<string, unknown>): Promise<string> {
    const q = new Query(); const cols = ['tenant_id']; const phs = [q.p(tenantId)];
    for (const [k, val] of Object.entries(v)) if (COLS[k] && val !== undefined) { cols.push(COLS[k]); phs.push(q.p(val)); }
    return (await db.query<{ id: string }>(`INSERT INTO bookings (${cols.join(', ')}) VALUES (${phs.join(', ')}) RETURNING id`, q.params)).rows[0].id;
  },
  async update(db: Db, tenantId: string, id: string, v: Record<string, unknown>): Promise<boolean> {
    const q = new Query(); const sets: string[] = [];
    for (const [k, val] of Object.entries(v)) if (COLS[k] && val !== undefined) sets.push(`${COLS[k]} = ${q.p(val)}`);
    if (!sets.length) return true;
    return (await db.query(`UPDATE bookings SET ${sets.join(', ')} WHERE tenant_id = ${q.p(tenantId)} AND id = ${q.p(id)} AND deleted_at IS NULL`, q.params)).rowCount > 0;
  },
  async softDelete(db: Db, tenantId: string, id: string) {
    return (await db.query('UPDATE bookings SET deleted_at = now() WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL', [tenantId, id])).rowCount > 0;
  },
  async setPhotographers(db: Db, tenantId: string, bookingId: string, photographerIds: string[]) {
    await db.query('DELETE FROM booking_photographers WHERE tenant_id = $1 AND booking_id = $2', [tenantId, bookingId]);
    if (photographerIds.length)
      await db.query(
        `INSERT INTO booking_photographers (tenant_id, booking_id, photographer_id, position)
         SELECT $1, $2, p.id, p.ord - 1 FROM unnest($3::uuid[]) WITH ORDINALITY AS p(id, ord)`, [tenantId, bookingId, photographerIds]);
  },
  async addNote(db: Db, tenantId: string, bookingId: string, n: { userId: string; name: string; text: string }) {
    return (await db.query(
      `INSERT INTO booking_notes (tenant_id, booking_id, author_user_id, author_name, text) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, author_name AS "authorName", text, created_at AS "createdAt"`, [tenantId, bookingId, n.userId, n.name, n.text])).rows[0];
  },
};