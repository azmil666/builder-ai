import { Router } from "express";
import { login, logout, me, register } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";

const authRouter = Router();

authRouter.post('/register', authRateLimiter, register)
authRouter.post('/login', authRateLimiter, login)
authRouter.post('/logout', logout)
authRouter.get('/me', authMiddleware, me)
authRouter.post('/me', authMiddleware, me)

export default authRouter;