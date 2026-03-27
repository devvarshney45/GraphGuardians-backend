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
      user: user.toSafeObject()
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
      user: user.toSafeObject()
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
  console.log("🚀 GitHub OAuth started");

  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`;

  res.redirect(redirectUrl);
};

// STEP 2 → callback
export const githubCallback = async (req, res) => {
  try {
    console.log("📥 GitHub Callback HIT");
    console.log("Query:", req.query);

    const { code, state } = req.query; // 🔥 state = JWT

    if (!code) {
      console.log("❌ No code received");
      return res.redirect(`${process.env.FRONTEND_URL}/error`);
    }

    /* =========================
       🔑 GET ACCESS TOKEN
    ========================= */
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

    if (!accessToken) {
      console.log("❌ No access token");
      return res.redirect(`${process.env.FRONTEND_URL}/error`);
    }

    /* =========================
       👤 GET USER DATA
    ========================= */
    const userRes = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });

    const githubUser = userRes.data;
    const githubUsername = githubUser.login.toLowerCase();

    console.log("👤 GitHub User:", githubUsername);

    const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

    /* =========================
       🔥 STEP 1: CHECK EXISTING LOGIN USER (JWT)
    ========================= */
    let existingUser = null;

    if (state) {
      try {
        const decoded = jwt.verify(state, process.env.JWT_SECRET);
        existingUser = await User.findById(decoded.id);
      } catch (err) {
        console.log("❌ Invalid JWT in state");
      }
    }

    /* =========================
       🔥 STEP 2: LINK WITH EXISTING USER
    ========================= */
    if (existingUser) {
      existingUser.githubId = githubUser.id;
      existingUser.githubUsername = githubUsername;
      existingUser.githubAccessToken = accessToken;
      existingUser.avatar = githubUser.avatar_url;

      await existingUser.save();

      console.log("✅ GitHub linked to existing user");

      const token = generateToken(existingUser._id);

      return res.redirect(`${FRONTEND}/auth/success?token=${token}`);
    }

    /* =========================
       🆕 FALLBACK (NO LOGIN → CREATE USER)
    ========================= */
    let user = await User.findOne({ githubId: githubUser.id });

    if (!user) {
      user = await User.create({
        name: githubUser.name || githubUser.login,
        email: githubUser.email || `${githubUser.id}@github.com`,
        githubId: githubUser.id,
        githubUsername,
        githubAccessToken: accessToken,
        avatar: githubUser.avatar_url
      });

      console.log("🆕 New GitHub user created");
    } else {
      user.githubAccessToken = accessToken;
      user.githubUsername = githubUsername;
      user.avatar = githubUser.avatar_url;
      await user.save();

      console.log("🔄 Existing GitHub user updated");
    }

    /* =========================
       🔐 TOKEN + REDIRECT
    ========================= */
    const token = generateToken(user._id);

    const redirectUrl = `${FRONTEND}/auth/success?token=${token}`;

    console.log("🔁 Redirecting to:", redirectUrl);

    return res.redirect(redirectUrl);

  } catch (err) {
    console.log("❌ GitHub OAuth Error:", err.message);

    const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

    return res.redirect(`${FRONTEND}/error`);
  }
};

/* =========================
   🔔 SAVE DEVICE TOKEN
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

    if (!user.fcmTokens) {
      user.fcmTokens = [];
    }

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
   👤 GET PROFILE
========================= */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found"
      });
    }

    res.json({
      user: user.toSafeObject()
    });

  } catch (err) {
    console.log("❌ getProfile error:", err.message);
    res.status(500).json({
      error: err.message
    });
  }
};

/* =========================
   🔥 GET ME
========================= */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json({
      user: user.toSafeObject()
    });

  } catch (err) {
    console.log("❌ getMe error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
