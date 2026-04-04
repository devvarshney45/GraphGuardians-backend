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

// ✅ Static routes PEHLE
router.get("/health/check", (req, res) => {
  res.json({
    status: "ok",
    message: "Repo service running 🚀"
  });
});

router.post("/", authMiddleware, addRepo);
router.get("/", authMiddleware, getRepos);

// ✅ Dynamic routes BAAD MEIN
router.get("/:repoId/diff", authMiddleware, getRepoDiff);
router.get("/:repoId", authMiddleware, getRepoById);
router.delete("/:repoId", authMiddleware, deleteRepo);

export default router;