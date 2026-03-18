import express from "express";
import { analyzeRepo } from "../controllers/analysis.controller.js";

const router = express.Router();
router.post("/", analyzeRepo);

export default router;