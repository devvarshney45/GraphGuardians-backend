import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    /* ❌ NO TOKEN */
    if (!authHeader) {
      return res.status(401).json({
        msg: "Access denied. No token provided"
      });
    }

    /* ❌ INVALID FORMAT */
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        msg: "Invalid token format"
      });
    }

    /* 🔑 EXTRACT TOKEN */
    const token = authHeader.split(" ")[1];

    /* 🔓 VERIFY TOKEN */
    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    /* 👤 OPTIONAL: DB CHECK */
    const user = await User.findById(decoded.id).select("_id role");

    if (!user) {
      return res.status(401).json({
        msg: "User not found"
      });
    }

    /* ✅ ATTACH LIGHT USER */
    req.user = {
      id: user._id,
      role: user.role
    };

    next();

  } catch (err) {

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        msg: "Token expired"
      });
    }

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