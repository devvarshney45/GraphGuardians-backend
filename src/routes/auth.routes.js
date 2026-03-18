import express from "express";
import {
  register,
  login,
  getProfile
} from "../controllers/auth.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================
   📝 AUTH ROUTES
========================= */

// 📝 Register
router.post("/register", async (req, res, next) => {
  try {
    await register(req, res);
  } catch (err) {
    next(err);
  }
});

// 🔐 Login
router.post("/login", async (req, res, next) => {
  try {
    await login(req, res);
  } catch (err) {
    next(err);
  }
});

/* =========================
   👤 USER ROUTES (PROTECTED)
========================= */

// 👤 Profile
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    await getProfile(req, res);
  } catch (err) {
    next(err);
  }
});

/* =========================
   🚪 LOGOUT
========================= */

// 🔥 Logout (JWT → frontend handles)
router.post("/logout", authMiddleware, (req, res) => {
  res.json({
    success: true,
    msg: "Logout successful. Remove token from client."
  });
});

export default router;