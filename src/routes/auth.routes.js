import express from "express";
import {
  register,
  login,
  getProfile,
  githubLogin,
  githubCallback,
  saveDeviceToken,
  getMe
} from "../controllers/auth.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 📝 Register
router.post("/register", register);

// 🔐 Login
router.post("/login", login);

// 🚀 GitHub OAuth Login
router.get("/github", githubLogin);

// 🔄 GitHub OAuth Callback
router.get("/github/callback", githubCallback);

// 📱 Save Device Token
router.post("/save-device-token", authMiddleware, saveDeviceToken);

// 👤 Get current user
router.get("/me", authMiddleware, getMe);

// 🚪 Logout
router.post("/logout", authMiddleware, (req, res) => {
  res.json({
    success: true,
    msg: "Logout successful. Remove token from client."
  });
});

// ✅ REMOVED: /github/install aur /github/install/callback
// Yeh dono github.routes.js mein hain — duplicate tha

export default router;