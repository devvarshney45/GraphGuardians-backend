import express from "express";
import {
  addRepo,
  getRepos,
  getRepoById,
  deleteRepo,
  getRepoDiff   // ✅ ADD THIS
} from "../controllers/repo.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================
   🧪 DEBUG MIDDLEWARE (optional)
========================= */
// router.use((req, res, next) => {
//   console.log(`📡 ${req.method} ${req.originalUrl}`);
//   next();
// });

/* =========================
   ➕ ADD REPO
========================= */
router.post("/", authMiddleware, addRepo);

/* =========================
   📂 GET ALL USER REPOS
========================= */
router.get("/", authMiddleware, getRepos);

/* =========================
   📄 GET SINGLE REPO
========================= */
router.get("/:repoId", authMiddleware, getRepoById);

/* =========================
   🔥 GET REPO DIFF (FIX)
========================= */
router.get("/:repoId/diff", authMiddleware, getRepoDiff);

/* =========================
   🗑️ DELETE REPO
========================= */
router.delete("/:repoId", authMiddleware, deleteRepo);

/* =========================
   ❤️ HEALTH CHECK (NEW 🔥)
========================= */
router.get("/health/check", (req, res) => {
  res.json({
    status: "ok",
    message: "Repo service running 🚀"
  });
});

export default router;
