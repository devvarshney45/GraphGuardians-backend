import express from "express";
import { askAI } from "../controllers/chat.controller.js";

const router = express.Router();

// 🔥 AI CHAT ROUTE
router.post("/ai-chat", askAI);

export default router;
