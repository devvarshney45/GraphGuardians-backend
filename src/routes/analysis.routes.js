import express from "express";
import { analyzeRepo } from "../controllers/analysis.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 🔍 Analyze Repo
router.post("/", authMiddleware, analyzeRepo);

export default router;
