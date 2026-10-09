import { Router } from "express";
import { login, logout, me, register } from "../contollers/authController";
import { authMiddleware } from "../middleware/authMiddleware";

const authRouter = Router();

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post('/logut', logout)
authRouter.post('/me', authMiddleware, me)

export default authRouter;