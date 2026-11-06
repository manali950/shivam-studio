import type { Db } from '../../db/pool.js';
import { Query, orderBy, type SortSpec } from '../../db/query.js';
 
export interface DeliveryInfo {
  targetHours: number; completedAt: string | null; highlightsSubmittedAt: string | null; highlightsPublishedAt: string | null;
  galleryPublishedAt: string | null; status: 'not_due' | 'pending' | 'highlights_submitted' | 'highlights_published' | 'delivered'; notes: string;
}
export interface StudioEvent {
  id: string; tenantId: string; bookingId: string | null; clientId: string | null; title: string; type: string; date: string; startTime: string; venue: string; city: string;
  description: string; status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'; progress: 'planned' | 'shooting' | 'wrapped' | 'editing' | 'delivered';
  photographerIds: string[]; isPublic: boolean; coverUrl: string; notes: { id: string; authorName: string; authorRole: string; text: string; createdAt: string }[];
  delivery: DeliveryInfo; createdAt: string;
}
 
const SELECT = `
  e.id, e.tenant_id AS "tenantId", e.booking_id AS "bookingId", e.client_id AS "clientId", e.title, e.type, e.date, e.start_time AS "startTime",
  e.venue, e.city, e.description, e.status, e.progress,
  COALESCE((SELECT jsonb_agg(ep.photographer_id ORDER BY ep.position) FROM event_photographers ep WHERE ep.event_id = e.id), '[]'::jsonb) AS "photographerIds",
  e.is_public AS "isPublic", e.cover_url AS "coverUrl",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', n.id, 'authorName', n.author_name, 'authorRole', n.author_role, 'text', n.text, 'createdAt', iso_ts(n.created_at)) ORDER BY n.created_at, n.id)
             FROM event_notes n WHERE n.event_id = e.id), '[]'::jsonb) AS notes,
  jsonb_build_object('targetHours', e.delivery_target_hours, 'completedAt', iso_ts(e.delivery_completed_at),
    'highlightsSubmittedAt', iso_ts(e.delivery_highlights_submitted_at), 'highlightsPublishedAt', iso_ts(e.delivery_highlights_published_at),
    'galleryPublishedAt', iso_ts(e.delivery_gallery_published_at), 'status', e.delivery_status, 'notes', e.delivery_notes) AS delivery,
  e.created_at AS "createdAt"`;
 
export const EVENT_SORT: SortSpec = { fields: { date: 'e.date', createdAt: 'e.created_at', title: 'e.title', status: 'e.status' }, default: 'date', order: 'desc' };
 
const COLS: Record<string, string> = {
  bookingId: 'booking_id', clientId: 'client_id', title: 'title', type: 'type', date: 'date', startTime: 'start_time', venue: 'venue', city: 'city',
  description: 'description', status: 'status', progress: 'progress', isPublic: 'is_public', coverUrl: 'cover_url', deliveryTargetHours: 'delivery_target_hours', deliveryNotes: 'delivery_notes',
};
 
export const eventsRepository = {
  async list(db: Db, tenantId: string, build: (q: Query) => void, o: { sort?: string; order?: 'asc' | 'desc'; page: number; pageSize: number }) {
    const q = new Query().where('e.tenant_id = ?', tenantId).raw('e.deleted_at IS NULL');
    build(q);
    const total = (await db.query<{ n: number }>(`SELECT count(*) AS n FROM events e ${q.whereSql}`, q.params)).rows[0].n;
    const sql = `SELECT ${SELECT} FROM events e ${q.whereSql} ${orderBy(EVENT_SORT, o.sort, o.order, 'e.id')} LIMIT ${q.p(o.pageSize)} OFFSET ${q.p((o.page - 1) * o.pageSize)}`;
    return { items: (await db.query<StudioEvent>(sql, q.params)).rows, total };
  },
  async get(db: Db, tenantId: string, id: string, build?: (q: Query) => void): Promise<StudioEvent | null> {
    const q = new Query().where('e.tenant_id = ? AND e.id = ?', tenantId, id).raw('e.deleted_at IS NULL');
    build?.(q);
    return (await db.query<StudioEvent>(`SELECT ${SELECT} FROM events e ${q.whereSql}`, q.params)).rows[0] ?? null;
  },
  async listForClient(db: Db, tenantId: string, clientId: string) {
    return (await this.list(db, tenantId, (q) => q.where('e.client_id = ?', clientId), { sort: 'date', order: 'desc', page: 1, pageSize: 1000 })).items;
  },
  async insert(db: Db, tenantId: string, v: Record<string, unknown>): Promise<string> {
    const q = new Query(); const cols = ['tenant_id']; const phs = [q.p(tenantId)];
    for (const [k, val] of Object.entries(v)) if (COLS[k] && val !== undefined) { cols.push(COLS[k]); phs.push(q.p(val)); }
    return (await db.query<{ id: string }>(`INSERT INTO events (${cols.join(', ')}) VALUES (${phs.join(', ')}) RETURNING id`, q.params)).rows[0].id;
  },
  async update(db: Db, tenantId: string, id: string, v: Record<string, unknown>): Promise<boolean> {
    const q = new Query(); const sets: string[] = [];
    for (const [k, val] of Object.entries(v)) if (COLS[k] && val !== undefined) sets.push(`${COLS[k]} = ${q.p(val)}`);
    if (!sets.length) return true;
    return (await db.query(`UPDATE events SET ${sets.join(', ')} WHERE tenant_id = ${q.p(tenantId)} AND id = ${q.p(id)} AND deleted_at IS NULL`, q.params)).rowCount > 0;
  },
  async softDelete(db: Db, tenantId: string, id: string) {
    return (await db.query('UPDATE events SET deleted_at = now() WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL', [tenantId, id])).rowCount > 0;
  },
  async setPhotographers(db: Db, tenantId: string, eventId: string, photographerIds: string[]) {
    await db.query('DELETE FROM event_photographers WHERE tenant_id = $1 AND event_id = $2', [tenantId, eventId]);
    if (photographerIds.length)
      await db.query(
        `INSERT INTO event_photographers (tenant_id, event_id, photographer_id, position)
         SELECT $1, $2, p.id, p.ord - 1 FROM unnest($3::uuid[]) WITH ORDINALITY AS p(id, ord)`, [tenantId, eventId, photographerIds]);
  },
  async addNote(db: Db, tenantId: string, eventId: string, n: { userId: string; name: string; role: string; text: string }) {
    return (await db.query(
      `INSERT INTO event_notes (tenant_id, event_id, author_user_id, author_name, author_role, text) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, author_name AS "authorName", author_role AS "authorRole", text, created_at AS "createdAt"`,
      [tenantId, eventId, n.userId, n.name, n.role, n.text])).rows[0];
  },
  /** Moves an event into the delivery workflow (idempotent: only the first call changes anything). Returns true if it changed. */
  async markCompleted(db: Db, tenantId: string, id: string): Promise<boolean> {
    return (await db.query(
      `UPDATE events SET status = 'completed', delivery_completed_at = now(),
              progress = CASE WHEN progress IN ('planned','shooting') THEN 'wrapped' ELSE progress END
        WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL AND delivery_completed_at IS NULL`, [tenantId, id])).rowCount > 0;
  },
  /** Delivery workflow steps driven by gallery actions (the status itself is a generated column, never set by hand). */
  async markHighlightsSubmitted(db: Db, tenantId: string, id: string, note?: string) {
    await db.query(
      `UPDATE events SET delivery_highlights_submitted_at = now(), progress = 'editing', delivery_notes = COALESCE($3, delivery_notes) WHERE tenant_id = $1 AND id = $2`, [tenantId, id, note ?? null]);
  },
  async markHighlightsPublished(db: Db, tenantId: string, id: string) {
    await db.query('UPDATE events SET delivery_highlights_published_at = now() WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
  },
  async markDelivered(db: Db, tenantId: string, id: string) {
    await db.query(`UPDATE events SET delivery_gallery_published_at = now(), progress = 'delivered' WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  },
  /** Row lock for workflow transitions so two simultaneous publishes cannot interleave. */
  async lock(db: Db, tenantId: string, id: string) {
    await db.query('SELECT 1 FROM events WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [tenantId, id]);
  },
};