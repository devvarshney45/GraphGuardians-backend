import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import User from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ❌ No token
    if (!authHeader) {
      return res.status(401).json({ msg: "No token provided" });
    }

    // ✅ Bearer token extract
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ msg: "Invalid token format" });
    }

    // 🔓 Verify token
    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    // 👤 Fetch user
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    // attach user
    req.user = user;

    next();

  } catch (err) {
    return res.status(401).json({ msg: "Unauthorized", error: err.message });
  }
};
