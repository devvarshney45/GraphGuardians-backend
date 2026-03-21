import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

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

// 🚀 Start Install (NO authMiddleware ❌)
router.get("/github/install", async (req, res) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(401).json({
        msg: "Token missing"
      });
    }

    // 🔥 VERIFY JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found"
      });
    }

    // 🔥 PASS TOKEN IN STATE
    const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new?state=${token}`;

    return res.redirect(installUrl);

  } catch (err) {
    console.log("❌ Install route error:", err.message);
    return res.status(401).json({
      error: "Invalid token"
    });
  }
});

// 🔄 Install Callback (NO authMiddleware ❌)
router.get("/github/install/callback", async (req, res) => {
  try {
    const { installation_id, state } = req.query;

    if (!installation_id || !state) {
      return res.status(400).json({
        msg: "Missing installation_id or state"
      });
    }

    // 🔥 VERIFY TOKEN FROM STATE
    const decoded = jwt.verify(state, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found"
      });
    }

    // 🔥 SAVE INSTALLATION ID
    user.installationId = installation_id;
    await user.save();

    console.log("🔥 Installation ID saved:", installation_id);

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

  } catch (err) {
    console.log("❌ Install callback error:", err.message);
    return res.status(500).json({
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
