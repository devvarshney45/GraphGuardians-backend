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
       Expect: Bearer <token>
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

    /* =========================
       👤 GET USER
    ========================= */
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        msg: "User not found"
      });
    }

    /* =========================
       ✅ ATTACH USER
    ========================= */
    req.user = user;

    next();

  } catch (err) {

    /* =========================
       ❌ TOKEN EXPIRED
    ========================= */
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        msg: "Token expired, please login again"
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
      msg: "Unauthorized access"
    });
  }
};