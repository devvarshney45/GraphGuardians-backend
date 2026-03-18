import express from "express";
import { getScanHistory } from "../controllers/scan.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:repoId", authMiddleware, getScanHistory);

export default router;
