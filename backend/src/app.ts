import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { log } from './lib/logger.js';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { isAllowedOrigin, originGuard } from './middleware/origin.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { blogRouter } from './modules/catalogue/blog.js';
import { clientsRouter } from './modules/catalogue/clients.js';
import { driveLinksRouter } from './modules/catalogue/driveLinks.js';
import { packagesRouter } from './modules/catalogue/packages.js';
import { photographersRouter } from './modules/catalogue/photographers.js';
import { servicesRouter } from './modules/catalogue/services.js';
import { testimonialsRouter } from './modules/catalogue/testimonials.js';
import { videosRouter } from './modules/catalogue/videos.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { galleriesRouter, portfolioRouter } from './modules/galleries/galleries.routes.js';
import { notificationsRouter } from './modules/notifications.js';
import { platformRouter } from './modules/platform/platform.routes.js';
import { tenantsRouter } from './modules/tenants/tenants.routes.js';
 
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
 
  app.use((req, res, next) => {
    const incoming = req.header('x-request-id');
    req.requestId = incoming && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const started = Date.now();
    res.on('finish', () => { if (req.path !== '/api/v1/health') log.info(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode}`, { ms: Date.now() - started, id: req.requestId }); });
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));        // JSON API consumed from other origins
  app.use(cors({
    origin: (origin, cb) => (!origin ? cb(null, true) : isAllowedOrigin(origin).then((ok) => cb(null, ok), () => cb(null, false))),
    credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-Tenant-Id', 'Authorization', 'X-Request-Id'], maxAge: 600,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
 
  const api = Router();
  api.get('/health', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ data: { status: 'ok' } }); } catch { res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'Database is not reachable.' } }); }
  });
  api.use(apiLimiter, originGuard, authenticate);
 
  api.use('/tenants', tenantsRouter);
  api.use('/auth', authRouter);
  api.use('/photographers', photographersRouter);
  api.use('/clients', clientsRouter);
  api.use('/services', servicesRouter);
  api.use('/packages', packagesRouter);
  api.use('/testimonials', testimonialsRouter);
  api.use('/videos', videosRouter);
  api.use('/drive-links', driveLinksRouter);
  api.use('/blog', blogRouter);
  api.use('/bookings', bookingsRouter);
  api.use('/events', eventsRouter);
  api.use('/galleries', galleriesRouter);
  api.use('/portfolio', portfolioRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/analytics', analyticsRouter);
  api.use('/platform', platformRouter);
 
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}