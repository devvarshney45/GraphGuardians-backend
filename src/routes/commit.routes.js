import express from "express";
import { getCommits } from "../controllers/commit.controller.js";

const router = express.Router();
router.get("/:repoId", getCommits);

export default router;