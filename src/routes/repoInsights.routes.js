import express from "express";
import {
  getRepoHistory,
  getLatestScan,
  getRepoDiff
} from "../controllers/repoInsights.controller.js";

const router = express.Router();

router.get("/:repoId/history", getRepoHistory);
router.get("/:repoId/latest", getLatestScan);
router.get("/:repoId/diff/:version", getRepoDiff);

export default router;