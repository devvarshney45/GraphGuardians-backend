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
   🔥 INSTALL CALLBACK (SAFE LINKING)
================================ */
router.get("/install/callback", async (req, res) => {
  try {
    const { installation_id, state } = req.query;

    console.log("\n📥 ===============================");
    console.log("📥 INSTALL CALLBACK HIT");
    console.log("Query:", req.query);
    console.log("==================================");

    if (!installation_id || !state) {
      return res.status(400).send("Missing installation_id or state");
    }

    let decoded;
    try {
      decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch (err) {
      console.log("❌ Invalid state");
      return res.status(401).send("Invalid state");
    }

    const userId = decoded.id;

    console.log("👤 User ID:", userId);
    console.log("🆔 Installation ID:", installation_id);

    const user = await User.findById(userId);

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).send("User not found");
    }

    // ✅ SAVE INSTALLATION
    user.installationId = Number(installation_id);
    await user.save();

    console.log("✅ Installation linked to user:", user._id);

    /* =========================
       🔁 REDIRECT FRONTEND
    ========================= */
    const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

    return res.redirect(`${FRONTEND}/dashboard`);

  } catch (err) {
    console.log("❌ CALLBACK ERROR:", err.message);
    return res.status(500).send("Internal Server Error");
  }
});

export default router;
