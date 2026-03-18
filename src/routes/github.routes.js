import express from "express";
import {
  validateRepo,
  getRepoFiles,
  getBranches,
  getPackageJson
} from "../controllers/github.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// 🔍 Validate repo (protected)
router.post("/validate", authMiddleware, validateRepo);

// 📂 Get repo files
router.get("/files", authMiddleware, getRepoFiles);

// 🌿 Get branches
router.get("/branches", authMiddleware, getBranches);

// 📦 Get package.json
router.get("/package", authMiddleware, getPackageJson);

export default router;
