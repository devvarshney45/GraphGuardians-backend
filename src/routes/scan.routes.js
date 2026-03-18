import express from "express";
import { getScanHistory } from "../controllers/scan.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================
   📈 SCAN HISTORY ROUTES
========================= */

// 📊 Get scan history (chart + compare ready)
router.get("/:repoId", authMiddleware, getScanHistory);

export default router;