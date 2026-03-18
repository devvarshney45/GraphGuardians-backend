import express from "express";
import {
  getAlerts,
  markAsRead,
  markAllAsRead,
  clearAlerts
} from "../controllers/alert.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

/* =========================
   📄 GET ALERTS
========================= */
// GET /api/alerts?repoId=...&page=1&limit=20
router.get("/", authMiddleware, getAlerts);

/* =========================
   🔔 MARK SINGLE ALERT AS READ
========================= */
// PUT /api/alerts/:id/read
router.put("/:id/read", authMiddleware, markAsRead);

/* =========================
   🔔 MARK ALL ALERTS AS READ
========================= */
// PUT /api/alerts/read-all?repoId=...
router.put("/read-all", authMiddleware, markAllAsRead);

/* =========================
   🗑️ CLEAR ALERTS
========================= */
// DELETE /api/alerts?repoId=...
router.delete("/", authMiddleware, clearAlerts);

/* =========================
   ✅ EXPORT
========================= */
export default router;