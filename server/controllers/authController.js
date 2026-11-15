import { User } from "../models/User.js";
import jwt from 'jsonwebtoken'
import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name must be 50 characters or less"),
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be 100 characters or less"),
});

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  password: z.string().min(1, "Password is required").max(100),
});

export const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length === 0) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
};

// helper to set cookies

const setSessionCookie = (res, payload)=>{
    const token = jwt.sign(payload, getJwtSecret(), {expiresIn: "30d"})
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, //30 days 
        path: "/",
    })
}

export async function register(req, res) {
    const parsed = RegisterSchema.safeParse(req.body || {});
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }

    const { name, email, password } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
        res.status(400).json({ error: "An account with this email already exists" });
        return;
    }
    const user = await User.create({
        name,
        email,
        password,
    });
    setSessionCookie(res, { userID: user._id.toString(), email: user.email });

    res.status(201).json({
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
        },
    });
}

export async function login(req, res) {
    const parsed = LoginSchema.safeParse(req.body || {});
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
        return;
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    const isValid = await user.comparePassword(password);
    if (!isValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    setSessionCookie(res, { userID: user._id.toString(), email: user.email });

    res.status(201).json({
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
        },
    });
}

export async function logout(_req, res) {
    res.cookie("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    })
    res.json({success: true})
}

export async function me(req, res) {
    if (!req.user) {
        res.status(401).json({error: "Not authenticated"})
        return;
    }
    const userId = req.user.userID || req.user.userId;
    const user = await User.findById(userId).select("-password");
    if(!user){
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({user})
}