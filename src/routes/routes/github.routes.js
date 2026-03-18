import express from "express";
import {
  validateRepo,
  getRepoFiles,
  getBranches,
  getPackageJson
} from "../controllers/github.controller.js";

const router = express.Router();

router.post("/validate", validateRepo);
router.get("/files", getRepoFiles);
router.get("/branches", getBranches);
router.get("/package", getPackageJson);

export default router;
