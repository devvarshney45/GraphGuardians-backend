import express from "express";
import {
  register,
  login,
  githubLogin,
  githubCallback,
  saveDeviceToken,
  getMe
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.post("/save-device-token", authMiddleware, saveDeviceToken);
router.get("/me", authMiddleware, getMe);
router.post("/logout", authMiddleware, (req, res) => {
  res.json({ success: true, msg: "Logout successful. Remove token from client." });
});

export default router;
