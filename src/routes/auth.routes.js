import express from "express";
import {
  register,
  login,
  getProfile,
  githubLogin,
  githubCallback,
  githubInstallCallback,
  saveDeviceToken,
  getMe
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 📝 Register
router.post("/register", register);

// 🔐 Login
router.post("/login", login);

// 🚀 GitHub OAuth — Step 1 (redirect to GitHub)
router.get("/github", githubLogin);

// 🔄 GitHub OAuth — Step 2 (callback after login)
router.get("/github/callback", githubCallback);

// ✅ GitHub App Install Callback
// GitHub App settings mein redirect URL set karo:
// https://yourdomain.com/api/auth/github/install/callback
router.get("/github/install/callback", githubInstallCallback);

// 📱 Save Device Token (FCM)
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

export default router;
