import express from "express";
import {
  getCommits,
  githubWebhook
} from "../controllers/commit.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 📥 Get commits (protected)
router.get("/:repoId", authMiddleware, getCommits);

// 🔁 GitHub Webhook (public but secured via secret later)
router.post("/webhook", githubWebhook);

export default router;
