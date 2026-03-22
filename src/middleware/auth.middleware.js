import jwt from "jsonwebtoken";
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("🔍 DECODED TOKEN:", decoded);

    /* =========================
       🧠 GET USER ID
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
       👤 FETCH FULL USER (CRITICAL FIX)
    ========================= */
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        msg: "User not found"
      });
    }

    /* =========================
       ✅ ATTACH FULL USER
    ========================= */
    req.user = user; // 🔥 FULL USER OBJECT

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
