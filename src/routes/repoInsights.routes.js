import express from "express";
import {
  getRepoHistory,
  getLatestScan,
  getRepoDiff
} from "../controllers/repoInsights.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// ✅ Auth added on all routes
router.get("/:repoId/history", authMiddleware, getRepoHistory);
router.get("/:repoId/latest", authMiddleware, getLatestScan);
router.get("/:repoId/diff/:version", authMiddleware, getRepoDiff);

export default router;