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
import User from "../models/user.model.js"; // 🔥 IMPORTANT

const router = express.Router();

/* =========================
   📝 AUTH ROUTES
========================= */

// 📝 Register
router.post("/register", register);

// 🔐 Login
router.post("/login", login);

/* =========================
   🔗 GITHUB OAUTH (LOGIN)
========================= */

// 🚀 Start GitHub Login
router.get("/github", githubLogin);

// 🔄 GitHub Callback
router.get("/github/callback", githubCallback);

/* =========================
   🔥 GITHUB APP INSTALL (FIXED 💀)
========================= */

// 🚀 Start Install (Frontend will call this)
router.get("/github/install", authMiddleware, (req, res) => {
  const url = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new`;
  res.redirect(url);
});

// 🔄 Install Callback (GitHub will hit this)
router.get("/github/install/callback", authMiddleware, async (req, res) => {
  try {
    const { installation_id } = req.query;

    if (!installation_id) {
      return res.status(400).json({
        msg: "No installation_id found"
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found"
      });
    }

    // 🔥 SAVE INSTALLATION ID
    user.installationId = installation_id;
    await user.save();

    console.log("🔥 Installation ID saved:", installation_id);

    // redirect to frontend dashboard
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

  } catch (err) {
    console.log("❌ Install callback error:", err.message);
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   🔔 FIREBASE
========================= */

// 📱 Save Device Token
router.post(
  "/save-device-token",
  authMiddleware,
  saveDeviceToken
);

/* =========================
   👤 USER ROUTES
========================= */

// 🔥 Single source of truth
router.get("/me", authMiddleware, getMe);

/* =========================
   🚪 LOGOUT
========================= */

router.post("/logout", authMiddleware, (req, res) => {
  res.json({
    success: true,
    msg: "Logout successful. Remove token from client."
  });
});

export default router;
