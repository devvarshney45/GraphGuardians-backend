import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

import {
  validateRepo,
  getRepoFiles,
  getBranches,
  getPackageJson
} from "../controllers/github.controller.js";

import { githubWebhook } from "../controllers/webhook.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

// 🔥 NEW IMPORT
import { getInstallationRepos } from "../controllers/github.install.controller.js";

const router = express.Router();

/* ================================
   📦 REPO UTIL ROUTES
================================ */
router.post("/validate", validateRepo);
router.get("/files", getRepoFiles);
router.get("/branches", getBranches);
router.get("/package", getPackageJson);

/* ================================
   📡 GET USER INSTALLATION REPOS 🔥
================================ */
router.get("/repos", authMiddleware, getInstallationRepos);

/* ================================
   🔔 GITHUB WEBHOOK (EVENTS ONLY)
================================ */
router.post("/webhook", githubWebhook);

/* ================================
   🔗 GET INSTALL URL (SECURE)
================================ */
router.get("/install-url", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const state = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new?state=${state}`;

    console.log("🔗 Install URL generated for user:", userId);

    res.json({ url: installUrl });

  } catch (err) {
    console.log("❌ INSTALL URL ERROR:", err.message);
    res.status(500).json({ error: "Failed to generate install URL" });
  }
});

/* ================================
   🔥 INSTALL CALLBACK (FINAL FIX 🔥🔥)
================================ */
router.get("/install/callback", async (req, res) => {
  try {
    const { installation_id, state, token } = req.query;

    console.log("\n📥 ===============================");
    console.log("📥 INSTALL CALLBACK HIT");
    console.log("Query:", req.query);
    console.log("==================================");

    if (!installation_id) {
      return res.status(400).send("Missing installation_id");
    }

    let user = null;

    /* =========================
       🔐 PRIORITY 1 → STATE (WEB FLOW)
    ========================= */
    if (state) {
      try {
        const decoded = jwt.verify(state, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);

        console.log("✅ User from state:", user?._id);

      } catch (err) {
        console.log("❌ Invalid state");
      }
    }

    /* =========================
       🔐 PRIORITY 2 → TOKEN (APP FLOW)
    ========================= */
    if (!user && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);

        console.log("✅ User from token:", user?._id);

      } catch (err) {
        console.log("❌ Invalid token");
      }
    }

    /* =========================
       ❌ USER NOT FOUND
    ========================= */
    if (!user) {
      console.log("❌ User not found");
      return res.redirect(`${process.env.FRONTEND_URL}/login`);
    }

    /* =========================
       ✅ SAVE INSTALLATION
    ========================= */
    user.installationId = Number(installation_id);
    await user.save();

    console.log("✅ Installation linked:", installation_id);

    /* =========================
       🔁 REDIRECT FRONTEND (IMPORTANT)
    ========================= */
    const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

    // 🔥 VERY IMPORTANT: query param send karo
    return res.redirect(
      `${FRONTEND}/dashboard?installation_id=${installation_id}`
    );

  } catch (err) {
    console.log("❌ CALLBACK ERROR:", err.message);
    return res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
});

export default router;
