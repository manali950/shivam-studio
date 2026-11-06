import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimit.js';
import { authController as c } from './auth.controller.js';
 
export const authRouter = Router();
authRouter.post('/login', authLimiter, c.login);
authRouter.post('/register', authLimiter, c.register);
authRouter.post('/logout', c.logout);
authRouter.get('/me', c.me);
authRouter.patch('/me', c.updateProfile);
authRouter.post('/change-password', authLimiter, c.changePassword);