import express from "express";
import { getGraph } from "../controllers/graph.controller.js";

const router = express.Router();

router.get("/:repoId", getGraph);

export default router;