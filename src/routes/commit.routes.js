import express from "express";
import { getCommits } from "../controllers/commit.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 📥 Get commits (protected)
router.get("/:repoId", authMiddleware, getCommits);

// ✅ REMOVED: duplicate webhook — already in github.routes.js

export default router;