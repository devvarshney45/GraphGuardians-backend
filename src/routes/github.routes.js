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
import { authMiddleware } from "../middleware/auth.middleware.js"; // ✅ IMPORTANT

const router = express.Router();

/* ================================
   📦 REPO UTIL ROUTES
================================ */
router.post("/validate", validateRepo);
router.get("/files", getRepoFiles);
router.get("/branches", getBranches);
router.get("/package", getPackageJson);

/* ================================
   🔔 GITHUB WEBHOOK (AUTO TRIGGER)
================================ */
router.post("/webhook", githubWebhook);

/* ================================
   🔗 GET INSTALL URL (SECURE 🔥)
================================ */
router.get("/install-url", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // ✅ now guaranteed

    // 🔐 short-lived state token
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
   🔥 INSTALL CALLBACK (FINAL FIX)
================================ */
router.get("/install/callback", async (req, res) => {
  try {
    const { installation_id, state } = req.query;

    console.log("\n📥 ===============================");
    console.log("📥 INSTALL CALLBACK HIT");
    console.log("Query:", req.query);
    console.log("==================================");

    /* =========================
       ❌ VALIDATION
    ========================= */
    if (!installation_id || !state) {
      console.log("❌ Missing params");
      return res.status(400).send("Missing installation_id or state");
    }

    /* =========================
       🔐 VERIFY STATE
    ========================= */
    let decoded;
    try {
      decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch (err) {
      console.log("❌ Invalid or expired state token");
      return res.status(401).send("Invalid or expired state");
    }

    const userId = decoded.id;

    console.log("👤 User ID:", userId);
    console.log("🆔 Installation ID:", installation_id);

    /* =========================
       💾 SAVE IN DB
    ========================= */
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        installationId: Number(installation_id),
        githubConnected: true
      },
      { new: true }
    );

    if (!updatedUser) {
      console.log("❌ User not found");
      return res.status(404).send("User not found");
    }

    console.log("✅ Installation saved successfully");

    /* =========================
       🔁 REDIRECT FRONTEND
    ========================= */
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

  } catch (err) {
    console.log("❌ INSTALL CALLBACK ERROR:", err.message);
    return res.status(500).send("Internal Server Error");
  }
});

export default router;
