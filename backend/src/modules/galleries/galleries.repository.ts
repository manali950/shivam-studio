import type { Db } from '../../db/pool.js';
import { Query, addSearch, orderBy, type SortSpec } from '../../db/query.js';
 
export interface GalleryPhoto {
  id: string; url: string; title: string; description: string; category: string; isHighlight: boolean; featured: boolean; order: number;
  width: number; height: number; camera?: string; lens?: string; exposure?: string;
}
export interface GallerySummary {
  id: string; tenantId: string; eventId: string | null; clientId: string | null; title: string; description: string; coverUrl: string; visibility: 'private' | 'client' | 'public';
  externalLinks: { id: string; label: string; url: string }[]; highlightsSubmittedAt: string | null; highlightsPublishedAt: string | null; completePublishedAt: string | null;
  photoCount: number; highlightCount: number; previewUrls: string[]; createdAt: string; updatedAt: string;
}
export interface Gallery extends GallerySummary { photos: GalleryPhoto[] }
 
/** Who is looking: staff and assigned photographers see every photo; everyone else only what has been published. */
export interface Viewer { staffLike: boolean; clientId: string | null }
 
/** SQL predicate for "this photo is visible to this viewer" — the delivery rule lives here, once. */
const visible = (v: Viewer, g = 'g', p = 'p') => (v.staffLike ? 'true' : `(${g}.complete_published_at IS NOT NULL OR (${g}.highlights_published_at IS NOT NULL AND ${p}.is_highlight))`);
 
/** `q` is used to register the client id as a bind parameter (external links are only shown to staff and the gallery's own client). */
function summarySelect(v: Viewer, q: Query) {
  const links = v.staffLike ? 'true' : v.clientId ? `g.client_id = ${q.p(v.clientId)}` : 'false';
  return `
  g.id, g.tenant_id AS "tenantId", g.event_id AS "eventId", g.client_id AS "clientId", g.title, g.description, g.cover_url AS "coverUrl", g.visibility,
  CASE WHEN ${links} THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'url', l.url) ORDER BY l.sort_order, l.id)
                                     FROM gallery_external_links l WHERE l.gallery_id = g.id), '[]'::jsonb) ELSE '[]'::jsonb END AS "externalLinks",
  g.highlights_submitted_at AS "highlightsSubmittedAt", g.highlights_published_at AS "highlightsPublishedAt", g.complete_published_at AS "completePublishedAt",
  (SELECT count(*) FROM gallery_photos p WHERE p.gallery_id = g.id AND ${visible(v)}) AS "photoCount",
  (SELECT count(*) FROM gallery_photos p WHERE p.gallery_id = g.id AND p.is_highlight AND ${visible(v)}) AS "highlightCount",
  COALESCE((SELECT jsonb_agg(s.url ORDER BY s.sort_order, s.id) FROM (
      SELECT p.url, p.sort_order, p.id FROM gallery_photos p
       WHERE p.gallery_id = g.id AND ${visible(v)}
         AND (p.is_highlight OR NOT EXISTS (SELECT 1 FROM gallery_photos h WHERE h.gallery_id = g.id AND h.is_highlight AND ${visible(v, 'g', 'h')}))
       ORDER BY p.sort_order, p.id LIMIT 4) s), '[]'::jsonb) AS "previewUrls",
  g.created_at AS "createdAt", g.updated_at AS "updatedAt"`;
}
 
const SORT: SortSpec = { fields: { updatedAt: 'g.updated_at', createdAt: 'g.created_at', title: 'g.title' }, default: 'updatedAt', order: 'desc' };
const PHOTO = `p.id, p.url, p.title, p.description, p.category, p.is_highlight AS "isHighlight", p.featured, p.sort_order AS "order", p.width, p.height, p.camera, p.lens, p.exposure`;
/** Optional EXIF columns come back as null — omit them so the JSON matches `camera?: string`. */
const clean = <T extends object>(p: T): T => { const r = p as Record<string, unknown>; for (const k of ['camera', 'lens', 'exposure']) if (r[k] == null) delete r[k]; return p; };
 
const GCOLS: Record<string, string> = { eventId: 'event_id', clientId: 'client_id', title: 'title', description: 'description', coverUrl: 'cover_url', visibility: 'visibility' };
const PCOLS: Record<string, string> = {
  title: 'title', description: 'description', category: 'category', isHighlight: 'is_highlight', featured: 'featured', order: 'sort_order', width: 'width', height: 'height',
  camera: 'camera', lens: 'lens', exposure: 'exposure',
};
 
export const galleriesRepository = {
  async list(db: Db, tenantId: string, v: Viewer, build: (q: Query) => void, o: { sort?: string; order?: 'asc' | 'desc'; page: number; pageSize: number }) {
    const q = new Query().where('g.tenant_id = ?', tenantId).raw('g.deleted_at IS NULL');
    build(q);
    const total = (await db.query<{ n: number }>(`SELECT count(*) AS n FROM galleries g ${q.whereSql}`, q.params)).rows[0].n;
    const select = summarySelect(v, q);
    const sql = `SELECT ${select} FROM galleries g ${q.whereSql} ${orderBy(SORT, o.sort, o.order, 'g.id')} LIMIT ${q.p(o.pageSize)} OFFSET ${q.p((o.page - 1) * o.pageSize)}`;
    return { items: (await db.query<GallerySummary>(sql, q.params)).rows, total };
  },
  async get(db: Db, tenantId: string, id: string, v: Viewer, build?: (q: Query) => void): Promise<GallerySummary | null> {
    const q = new Query().where('g.tenant_id = ? AND g.id = ?', tenantId, id).raw('g.deleted_at IS NULL');
    build?.(q);
    const select = summarySelect(v, q);
    return (await db.query<GallerySummary>(`SELECT ${select} FROM galleries g ${q.whereSql}`, q.params)).rows[0] ?? null;
  },
  async photos(db: Db, tenantId: string, galleryId: string, v: Viewer): Promise<GalleryPhoto[]> {
    const sql = `SELECT ${PHOTO} FROM gallery_photos p JOIN galleries g ON g.tenant_id = p.tenant_id AND g.id = p.gallery_id
                  WHERE p.tenant_id = $1 AND p.gallery_id = $2 AND ${visible(v)} ORDER BY p.sort_order, p.id`;
    return (await db.query<GalleryPhoto>(sql, [tenantId, galleryId])).rows.map(clean);
  },
  async insert(db: Db, tenantId: string, v: Record<string, unknown>): Promise<string> {
    const q = new Query(); const cols = ['tenant_id']; const phs = [q.p(tenantId)];
    for (const [k, val] of Object.entries(v)) if (GCOLS[k] && val !== undefined) { cols.push(GCOLS[k]); phs.push(q.p(val)); }
    return (await db.query<{ id: string }>(`INSERT INTO galleries (${cols.join(', ')}) VALUES (${phs.join(', ')}) RETURNING id`, q.params)).rows[0].id;
  },
  async update(db: Db, tenantId: string, id: string, v: Record<string, unknown>) {
    const q = new Query(); const sets: string[] = [];
    for (const [k, val] of Object.entries(v)) if (GCOLS[k] && val !== undefined) sets.push(`${GCOLS[k]} = ${q.p(val)}`);
    if (!sets.length) return;
    await db.query(`UPDATE galleries SET ${sets.join(', ')} WHERE tenant_id = ${q.p(tenantId)} AND id = ${q.p(id)} AND deleted_at IS NULL`, q.params);
  },
  async touch(db: Db, tenantId: string, id: string) { await db.query('UPDATE galleries SET updated_at = now() WHERE tenant_id = $1 AND id = $2', [tenantId, id]); },
  async softDelete(db: Db, tenantId: string, id: string) {
    return (await db.query('UPDATE galleries SET deleted_at = now() WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL', [tenantId, id])).rowCount > 0;
  },
  async lock(db: Db, tenantId: string, id: string) { await db.query('SELECT 1 FROM galleries WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [tenantId, id]); },
 
  async replaceLinks(db: Db, tenantId: string, galleryId: string, links: { id?: string; label: string; url: string }[]) {
    await db.query('DELETE FROM gallery_external_links WHERE tenant_id = $1 AND gallery_id = $2', [tenantId, galleryId]);
    for (const [i, l] of links.entries())
      await db.query('INSERT INTO gallery_external_links (tenant_id, gallery_id, label, url, sort_order) VALUES ($1,$2,$3,$4,$5)', [tenantId, galleryId, l.label, l.url, i]);
  },
  async addPhotos(db: Db, tenantId: string, galleryId: string, photos: Record<string, any>[]) {
    let order = (await db.query<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0) AS m FROM gallery_photos WHERE gallery_id = $1', [galleryId])).rows[0].m;
    for (const p of photos)
      await db.query(
        `INSERT INTO gallery_photos (tenant_id, gallery_id, url, title, description, category, sort_order, width, height, camera, lens, exposure)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [tenantId, galleryId, p.url, p.title ?? 'Untitled', p.description ?? '', p.category ?? 'wedding', ++order, p.width ?? 1200, p.height ?? 800, p.camera ?? null, p.lens ?? null, p.exposure ?? null]);
    await db.query(`UPDATE galleries SET cover_url = (SELECT url FROM gallery_photos WHERE gallery_id = $2 ORDER BY sort_order, id LIMIT 1) WHERE tenant_id = $1 AND id = $2 AND cover_url = ''`, [tenantId, galleryId]);
  },
  async updatePhoto(db: Db, tenantId: string, galleryId: string, photoId: string, v: Record<string, unknown>): Promise<boolean> {
    const q = new Query(); const sets: string[] = [];
    for (const [k, val] of Object.entries(v)) if (PCOLS[k] && val !== undefined) sets.push(`${PCOLS[k]} = ${q.p(val)}`);
    if (!sets.length) return (await db.query('SELECT 1 FROM gallery_photos WHERE tenant_id = $1 AND gallery_id = $2 AND id = $3', [tenantId, galleryId, photoId])).rowCount > 0;
    return (await db.query(`UPDATE gallery_photos SET ${sets.join(', ')} WHERE tenant_id = ${q.p(tenantId)} AND gallery_id = ${q.p(galleryId)} AND id = ${q.p(photoId)}`, q.params)).rowCount > 0;
  },
  async removePhoto(db: Db, tenantId: string, galleryId: string, photoId: string) {
    return (await db.query('DELETE FROM gallery_photos WHERE tenant_id = $1 AND gallery_id = $2 AND id = $3', [tenantId, galleryId, photoId])).rowCount > 0;
  },
  async reorder(db: Db, tenantId: string, galleryId: string, photoIds: string[]) {
    await db.query(
      `UPDATE gallery_photos p SET sort_order = o.ord FROM unnest($3::uuid[]) WITH ORDINALITY AS o(id, ord)
        WHERE p.tenant_id = $1 AND p.gallery_id = $2 AND p.id = o.id`, [tenantId, galleryId, photoIds]);
  },
  async photoIdsIn(db: Db, tenantId: string, galleryId: string, ids: string[]): Promise<number> {
    return (await db.query<{ n: number }>('SELECT count(*) AS n FROM gallery_photos WHERE tenant_id = $1 AND gallery_id = $2 AND id = ANY($3::uuid[])', [tenantId, galleryId, ids])).rows[0].n;
  },
  async setHighlights(db: Db, tenantId: string, galleryId: string, ids: string[]) {
    await db.query('UPDATE gallery_photos SET is_highlight = (id = ANY($3::uuid[])) WHERE tenant_id = $1 AND gallery_id = $2', [tenantId, galleryId, ids]);
    await db.query('UPDATE galleries SET highlights_submitted_at = now(), updated_at = now() WHERE tenant_id = $1 AND id = $2', [tenantId, galleryId]);
  },
  async counts(db: Db, tenantId: string, galleryId: string) {
    const r = (await db.query<{ total: number; highlights: number }>(
      'SELECT count(*) AS total, count(*) FILTER (WHERE is_highlight) AS highlights FROM gallery_photos WHERE tenant_id = $1 AND gallery_id = $2', [tenantId, galleryId])).rows[0];
    return r;
  },
  async publish(db: Db, tenantId: string, galleryId: string, stage: 'highlights' | 'complete') {
    const col = stage === 'highlights' ? 'highlights_published_at' : 'complete_published_at';
    await db.query(`UPDATE galleries SET ${col} = now(), visibility = CASE WHEN visibility = 'private' THEN 'client' ELSE visibility END, updated_at = now() WHERE tenant_id = $1 AND id = $2`, [tenantId, galleryId]);
  },
 
  async portfolio(db: Db, tenantId: string, p: { category?: string; featured?: boolean; search?: string; page: number; pageSize: number }) {
    const q = new Query().where('g.tenant_id = ?', tenantId).raw(`g.deleted_at IS NULL AND g.visibility = 'public'`)
      .raw('g.complete_published_at IS NOT NULL OR (g.highlights_published_at IS NOT NULL AND p.is_highlight)');
    if (p.category) q.where('p.category = ?', p.category);
    if (p.featured !== undefined) q.where('p.featured = ?', p.featured);
    addSearch(q, p.search, ['p.title', 'g.title']);
    const from = 'FROM gallery_photos p JOIN galleries g ON g.tenant_id = p.tenant_id AND g.id = p.gallery_id';
    const total = (await db.query<{ n: number }>(`SELECT count(*) AS n ${from} ${q.whereSql}`, q.params)).rows[0].n;
    const sql = `SELECT ${PHOTO}, g.id AS "galleryId", g.title AS "galleryTitle" ${from} ${q.whereSql}
                  ORDER BY p.featured DESC, g.updated_at DESC, p.sort_order, p.id LIMIT ${q.p(p.pageSize)} OFFSET ${q.p((p.page - 1) * p.pageSize)}`;
    return { items: (await db.query<GalleryPhoto & { galleryId: string; galleryTitle: string }>(sql, q.params)).rows.map(clean), total };
  },
  async sampleLibrary(db: Db) {
    return (await db.query('SELECT url, title, category, width, height FROM sample_photos ORDER BY category, title, id')).rows;
  },
};