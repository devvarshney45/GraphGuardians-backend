import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    /* =========================
       ❌ NO TOKEN
    ========================= */
    if (!authHeader) {
      return res.status(401).json({
        msg: "Access denied. No token provided"
      });
    }

    /* =========================
       ❌ INVALID FORMAT
    ========================= */
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        msg: "Invalid token format"
      });
    }

    /* =========================
       🔑 EXTRACT TOKEN
    ========================= */
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        msg: "Token missing"
      });
    }

    /* =========================
       🔓 VERIFY TOKEN
    ========================= */
    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    console.log("🔍 DECODED TOKEN:", decoded); // DEBUG

    /* =========================
       🧠 HANDLE ALL CASES
    ========================= */
    const userId =
      decoded.id ||
      decoded._id ||
      decoded.userId;

    if (!userId) {
      return res.status(401).json({
        msg: "Invalid token payload"
      });
    }

    /* =========================
       👤 GET USER
    ========================= */
    const user = await User.findById(userId).select("_id role");

    if (!user) {
      return res.status(401).json({
        msg: "User not found"
      });
    }

    /* =========================
       ✅ ATTACH USER
    ========================= */
    req.user = {
      id: user._id.toString(),
      role: user.role
    };

    next();

  } catch (err) {

    console.log("❌ AUTH ERROR:", err.message);

    /* =========================
       ❌ TOKEN EXPIRED
    ========================= */
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        msg: "Token expired"
      });
    }

    /* =========================
       ❌ INVALID TOKEN
    ========================= */
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        msg: "Invalid token"
      });
    }

    return res.status(401).json({
      msg: "Unauthorized"
    });
  }
};