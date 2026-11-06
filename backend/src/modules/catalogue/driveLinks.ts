import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { assertRefs } from '../../db/refs.js';
import { invalid } from '../../lib/errors.js';
import { isStaff } from '../../lib/handlers.js';
import { parseDrive } from '../../lib/media.js';
import { listQuery, longText, reqText, uuid } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface DriveLink { id: string; tenantId: string; [k: string]: unknown }
 
/**
 * Google Drive folders are shared by LINK. Saving a link here does not grant anyone access — whether a client can open it
 * depends entirely on the folder's Google Drive sharing settings. The API only checks that it is a drive.google.com URL.
 */
const spec: EntitySpec = {
  table: 'drive_links', softDelete: true,
  fields: {
    id: 'id', tenantId: 'tenant_id', title: 'title', url: 'url', folderId: 'folder_id', description: 'description', eventId: 'event_id', clientId: 'client_id',
    visibility: 'visibility', createdAt: 'created_at',
  },
  sort: { fields: { createdAt: 't.created_at', title: 't.title' }, default: 'createdAt', order: 'desc' },
};
const nullableId = z.union([uuid, z.literal(''), z.null()]).transform((v) => v || null);
const body = z.object({ title: reqText(160), url: z.string().trim().min(1).max(1000), description: longText(300), eventId: nullableId, clientId: nullableId, visibility: z.enum(['client', 'private']) });
const query = listQuery.extend({ clientId: uuid.optional(), eventId: uuid.optional(), visibility: z.enum(['client', 'private']).optional() });
 
const service = createCrudService<DriveLink>({
  label: 'Drive link', entity: 'drive_link', repo: createRepository<DriveLink>(spec), query,
  createSchema: body.partial().required({ title: true, url: true }), updateSchema: body.partial(),
  searchColumns: ['t.title', 't.description'],
  // Staff see all; a client sees only links marked visible to them AND assigned to them; everyone else sees nothing.
  scope: (ctx, q) => {
    if (isStaff(ctx.principal)) return;
    if (ctx.principal?.role === 'client' && ctx.principal.clientId) q.where(`t.visibility = 'client' AND t.client_id = ?`, ctx.principal.clientId);
    else q.raw('false');
  },
  filters: (_c, q, p) => {
    if (p.clientId) q.where('t.client_id = ?', p.clientId);
    if (p.eventId) q.where('t.event_id = ?', p.eventId);
    if (p.visibility) q.where('t.visibility = ?', p.visibility);
  },
  prepare: async (ctx, input) => {
    const out: Record<string, unknown> = { ...input };
    if (input.url !== undefined) {
      const info = parseDrive(input.url);
      if (!info) throw invalid('Enter a valid Google Drive folder or file link (https://drive.google.com/…).', { url: 'Unsupported Drive URL' });
      out.folderId = info.id; out.url = info.url;
    }
    await assertRefs(ctx.db, ctx.tenantId, 'events', [input.eventId], 'Event not found in this studio.');
    await assertRefs(ctx.db, ctx.tenantId, 'clients', [input.clientId], 'Client not found in this studio.');
    return out;
  },
});
export const driveLinksRouter: Router = crudRouter(createCrudController(service));