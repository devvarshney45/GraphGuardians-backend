import express from "express";
import { getAlerts } from "../controllers/alert.controller.js";

const router = express.Router();
router.get("/", getAlerts);

export default router;