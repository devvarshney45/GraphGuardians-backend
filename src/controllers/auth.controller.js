import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/* =========================
   🔐 REGISTER
========================= */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // validation
    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        msg: "Password must be at least 6 characters"
      });
    }

    // check existing
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed
    });

    // 🔥 TOKEN
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      msg: "User registered successfully",
      token,
      user: {
        id: user._id,
        name,
        email
      }
    });

  } catch (err) {
    console.log("❌ REGISTER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   🔐 LOGIN
========================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        msg: "Email and password required"
      });
    }

    // 🔥 FIX: password explicitly select karo
    const user = await User.findOne({ email }).select("+password");

    console.log("USER:", user);

    if (!user || !user.password) {
      return res.status(401).json({
        msg: "Invalid credentials"
      });
    }

    const match = await bcrypt.compare(password, user.password);

    console.log("MATCH:", match);

    if (!match) {
      return res.status(401).json({
        msg: "Invalid credentials"
      });
    }

    console.log("JWT_SECRET:", process.env.JWT_SECRET);

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      msg: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.log("❌ LOGIN ERROR FULL:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   👤 PROFILE
========================= */
export const getProfile = async (req, res) => {
  res.json({
    user: req.user
  });
};