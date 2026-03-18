import express from "express";
import { getCommits } from "../controllers/commit.controller.js";
import { githubWebhook } from "../controllers/commit.controller.js";
const router = express.Router();
router.get("/:repoId", getCommits);


router.post("/webhook", githubWebhook);

export default router;