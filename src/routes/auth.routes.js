import express from "express";
import {
  register,
  login,
  getProfile,
  githubLogin,
  githubCallback,
  saveDeviceToken // 🔥 NEW
} from "../controllers/auth.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================
   📝 AUTH ROUTES
========================= */

// 📝 Register
router.post("/register", register);

// 🔐 Login
router.post("/login", login);

/* =========================
   🔗 GITHUB OAUTH
========================= */

// 🚀 Start GitHub Login
router.get("/github", githubLogin);

// 🔄 GitHub Callback
router.get("/github/callback", githubCallback);

/* =========================
   🔔 FIREBASE (NEW 🔥)
========================= */

// 📱 Save Device Token
router.post(
  "/save-device-token",
  authMiddleware,
  saveDeviceToken
);

/* =========================
   👤 USER ROUTES (PROTECTED)
========================= */

// 👤 Profile
router.get("/me", authMiddleware, getProfile);

/* =========================
   🚪 LOGOUT
========================= */

// 🔥 Logout
router.post("/logout", authMiddleware, (req, res) => {
  res.json({
    success: true,
    msg: "Logout successful. Remove token from client."
  });
});

export default router;