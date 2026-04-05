import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
const APP_SLUG  = process.env.GITHUB_APP_SLUG || "GraphGuardians";

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
   🔑 GET INSTALLATION TOKEN
   (GitHub App → Installation access token)
========================= */
const getInstallationToken = async (installationId) => {
  const appId      = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID or GITHUB_PRIVATE_KEY missing");
  }

  // JWT for GitHub App auth
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 600, iss: appId };

  const appJwt = jwt.sign(payload, privateKey, { algorithm: "RS256" });

  const res = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return res.data.token;
};

/* =========================
   🔐 REGISTER
========================= */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ msg: "All fields are required" });

    if (password.length < 6)
      return res.status(400).json({ msg: "Password must be at least 6 characters" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ msg: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, password: hashed });
    const token  = generateToken(user._id);

    res.status(201).json({ msg: "User registered successfully", token, user: user.toSafeObject() });

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

    if (!email || !password)
      return res.status(400).json({ msg: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password)
      return res.status(401).json({ msg: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ msg: "Invalid credentials" });

    const token = generateToken(user._id);

    res.json({ msg: "Login successful", token, user: user.toSafeObject() });

  } catch (err) {
    console.log("❌ LOGIN ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   🔗 GITHUB OAUTH — STEP 1
   Redirect to GitHub login
========================= */
export const githubLogin = (req, res) => {
  console.log("🚀 GitHub OAuth started");

  // state = "web" | "app"  (mobile app sends state=app)
  const state = req.query.state || "web";

  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&scope=repo,read:org,read:user` +
    `&state=${state}` +
    `&prompt=select_account`;

  res.redirect(url);
};

/* =========================
   🔗 GITHUB OAUTH — STEP 2
   Callback after GitHub login
========================= */
export const githubCallback = async (req, res) => {
  try {
    console.log("📥 GitHub Callback HIT");

    const { code, state } = req.query;
    const isMobileApp = state === "app";

    if (!code) {
      return isMobileApp
        ? res.redirect(`myapp://auth?error=no_code`)
        : res.redirect(`${FRONTEND}/login?error=no_code`);
    }

    /* ── Exchange code for access token ── */
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenRes.data.access_token;

    if (!accessToken) {
      return isMobileApp
        ? res.redirect(`myapp://auth?error=token_failed`)
        : res.redirect(`${FRONTEND}/login?error=token_failed`);
    }

    /* ── Get GitHub user info ── */
    const githubRes  = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `token ${accessToken}` },
    });
    const githubUser = githubRes.data;

    /* ── Find or create user ── */
    let user = await User.findOne({ githubId: githubUser.id });

    if (!user && githubUser.email) {
      user = await User.findOne({ email: githubUser.email });
    }

    if (!user) {
      user = await User.create({
        name:              githubUser.name || githubUser.login,
        email:             githubUser.email || `${githubUser.id}@github.com`,
        githubId:          githubUser.id,
        githubUsername:    githubUser.login.toLowerCase(),
        githubAccessToken: accessToken,
        avatar:            githubUser.avatar_url,
      });
    } else {
      user.githubId          = githubUser.id;
      user.githubAccessToken = accessToken;
      user.githubUsername    = githubUser.login.toLowerCase();
      user.avatar            = githubUser.avatar_url;
      await user.save();
    }

    const token = generateToken(user._id);

    /* ════════════════════════════════════════
       🔍 CHECK GITHUB APP INSTALLATION
       Method 1: DB mein installationId saved hai?
       Method 2: GitHub API se live check
    ════════════════════════════════════════ */

    let isInstalled = false;

    // Method 1: DB check
    if (user.installationId) {
      try {
        await getInstallationToken(user.installationId);
        isInstalled = true;
        console.log("✅ Installation valid (from DB):", user.installationId);
      } catch (err) {
        console.log("⚠️ Saved installationId invalid, resetting...");
        user.installationId = null;
        await user.save();
      }
    }

    // Method 2: Live API check (agar DB mein nahi tha)
    if (!isInstalled) {
      try {
        const installRes = await axios.get(
          "https://api.github.com/user/installations",
          {
            headers: {
              Authorization: `token ${accessToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );

        const installations = installRes.data?.installations || [];
        const found = installations.find(i => i.app_slug === APP_SLUG);

        if (found) {
          isInstalled = true;
          // Save to DB for future use
          user.installationId = found.id;
          await user.save();
          console.log("✅ Installation found via API:", found.id);
        }
      } catch (err) {
        console.log("⚠️ Could not check installations:", err.message);
      }
    }

    /* ════════════════════════════════════════
       🚀 REDIRECT BASED ON INSTALLATION STATUS
    ════════════════════════════════════════ */

    if (isInstalled) {
      // ✅ App installed → go to dashboard
      console.log("✅ App installed → Dashboard");

      if (isMobileApp) {
        return res.redirect(`myapp://auth?token=${token}`);
      }
      return res.redirect(`${FRONTEND}/auth/success?token=${token}`);

    } else {
      // ❌ App not installed → install page
      console.log("⚠️ App NOT installed → Install page");

      const installUrl =
        `https://github.com/apps/${APP_SLUG}/installations/new` +
        `?state=${token}`;  // state mein token pass karo

      if (isMobileApp) {
        // Mobile: deep link se install page open
        return res.redirect(
          `myapp://install?url=${encodeURIComponent(installUrl)}&token=${token}`
        );
      }

      // Web: install page pe redirect
      return res.redirect(
        `${FRONTEND}/install?url=${encodeURIComponent(installUrl)}&token=${token}`
      );
    }

  } catch (err) {
    console.log("❌ GitHub OAuth Error:", err.message);
    return res.redirect(`${FRONTEND}/login?error=oauth_failed`);
  }
};

/* =========================
   🔗 GITHUB APP INSTALL CALLBACK
   GitHub app install hone ke baad yahan aata hai
========================= */
export const githubInstallCallback = async (req, res) => {
  try {
    console.log("📥 Install Callback HIT", req.query);

    const { installation_id, setup_action, state } = req.query;

    // state mein JWT token pass kiya tha
    const token = state;

    if (setup_action === "install" && installation_id && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          await User.findByIdAndUpdate(decoded.id, {
            installationId: installation_id,
          });
          console.log("✅ installationId saved:", installation_id);
        }
      } catch (err) {
        console.log("⚠️ Token verify failed in install callback:", err.message);
      }
    }

    // After install → dashboard
    return res.redirect(`${FRONTEND}/auth/success?token=${token}&installed=true`);

  } catch (err) {
    console.log("❌ Install callback error:", err.message);
    return res.redirect(`${FRONTEND}/dashboard`);
  }
};

/* =========================
   👤 GET PROFILE
========================= */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   🔥 GET ME
========================= */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    return res.json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   🔔 SAVE DEVICE TOKEN
========================= */
export const saveDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ msg: "Device token required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (!user.fcmTokens) user.fcmTokens = [];

    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await user.save();
    }

    res.json({ msg: "Device token saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
