import express from "express";
import {
  addRepo,
  getRepos,
  getRepoById,
  deleteRepo,
  getRepoDiff
} from "../controllers/repo.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, addRepo);

router.get("/", authMiddleware, getRepos);

// ✅ FIXED ORDER
router.get("/:repoId/diff", authMiddleware, getRepoDiff);
router.get("/:repoId", authMiddleware, getRepoById);

router.delete("/:repoId", authMiddleware, deleteRepo);

router.get("/health/check", (req, res) => {
  res.json({
    status: "ok",
    message: "Repo service running 🚀"
  });
});

export default router;
