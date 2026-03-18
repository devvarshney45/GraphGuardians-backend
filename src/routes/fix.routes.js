import express from "express";
import { suggestFix } from "../controllers/fix.controller.js";

const router = express.Router();

router.post("/suggest", suggestFix);

export default router;
