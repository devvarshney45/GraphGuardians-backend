import express from "express";
import {
  addRepo,
  getRepos,
  getRepoById,
  deleteRepo
} from "../controllers/repo.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// ➕ Add repo
router.post("/", authMiddleware, addRepo);

// 📂 Get all repos (user specific)
router.get("/", authMiddleware, getRepos);

// 📄 Get single repo
router.get("/:repoId", authMiddleware, getRepoById);

// 🗑️ Delete repo
router.delete("/:repoId", authMiddleware, deleteRepo);

export default router;
