import express from "express";
import { register, login, getProfile } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 📝 Register
router.post("/register", register);

// 🔐 Login
router.post("/login", login);

// 👤 Get Profile (protected)
router.get("/me", authMiddleware, getProfile);

export default router;
