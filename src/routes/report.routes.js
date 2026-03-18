import express from "express";
import { downloadReport } from "../controllers/report.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:repoId", authMiddleware, downloadReport);

export default router;
