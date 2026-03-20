import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
/* =========================
   🔐 JWT GENERATOR
========================= */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* =========================
   🔐 REGISTER
========================= */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        msg: "Password must be at least 6 characters"
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed
    });

    const token = generateToken(user._id);

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

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password) {
      return res.status(401).json({
        msg: "Invalid credentials"
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        msg: "Invalid credentials"
      });
    }

    const token = generateToken(user._id);

    res.json({
      msg: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });

  } catch (err) {
    console.log("❌ LOGIN ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   🔗 GITHUB OAUTH LOGIN
========================= */

// STEP 1 → redirect
export const githubLogin = (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`;

  res.redirect(redirectUrl);
};

// STEP 2 → callback
export const githubCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ msg: "No code provided" });
    }

    // 🔑 access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: { Accept: "application/json" }
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 👤 user data
    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });

    const githubUser = userRes.data;

    let user = await User.findOne({ githubId: githubUser.id });

    if (!user) {
      user = await User.create({
        name: githubUser.name || githubUser.login,
        email: githubUser.email || `${githubUser.login}@github.com`,
        githubId: githubUser.id,
        githubUsername: githubUser.login,
        githubAccessToken: accessToken,
        avatar: githubUser.avatar_url
      });
    } else {
      user.githubAccessToken = accessToken;
      await user.save();
    }

    const token = generateToken(user._id);

    res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${token}`
    );

  } catch (err) {
    console.log("❌ GitHub OAuth Error:", err.message);
    res.status(500).json({
      error: "GitHub authentication failed"
    });
  }
};

/* =========================
   🔔 SAVE DEVICE TOKEN (FCM)
========================= */
export const saveDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        msg: "Device token required"
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found"
      });
    }

    // ensure array
    if (!user.fcmTokens) {
      user.fcmTokens = [];
    }

    // avoid duplicate
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save();
    }

    res.json({
      msg: "Device token saved successfully"
    });

  } catch (err) {
    console.log("❌ Save device token error:", err.message);
    res.status(500).json({
      error: err.message
    });
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



// controllers/auth.controller.js


export const getMe = async (req, res) => {
  try {
    const userId = req.user.id; // JWT middleware se

    const user = await User.findById(userId).select(
      "_id name email installationId"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        installationId: user.installationId || null,
        githubConnected: !!user.installationId
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};