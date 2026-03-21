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
   🔥 INSTALL CALLBACK (FINAL FIX)
================================ */
router.get("/install/callback", async (req, res) => {
  try {
    const { installation_id, state } = req.query;

    console.log("\n📥 ===============================");
    console.log("📥 INSTALL CALLBACK HIT");
    console.log("Query:", req.query);
    console.log("==================================");

    // ❌ safety check
    if (!installation_id || !state) {
      return res.status(400).send("Missing installation_id or state");
    }

    // 🔐 decode user
    let decoded;
    try {
      decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch (err) {
      console.log("❌ Invalid state token");
      return res.status(401).send("Invalid state");
    }

    const userId = decoded.id;

    console.log("👤 User ID:", userId);
    console.log("🆔 Installation ID:", installation_id);

    // 💾 SAVE IN DB (MAIN FIX)
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

    // 🔁 redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

  } catch (err) {
    console.log("❌ INSTALL CALLBACK ERROR:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
