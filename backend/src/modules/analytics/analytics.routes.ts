import { Router } from 'express';
import { tenantRoute } from '../../lib/handlers.js';
import { analyticsService } from './analytics.service.js';
 
export const analyticsRouter = Router();
analyticsRouter.get('/dashboard', tenantRoute((ctx) => analyticsService.dashboard(ctx)));