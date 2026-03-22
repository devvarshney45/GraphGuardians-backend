import Repo from "../models/repo.model.js";
import axios from "axios";
import { analyzeRepo } from "./analysis.controller.js";
import { getInstallationToken } from "../services/githubApp.service.js";

/* ========================= HELPERS ========================= */
const normalizeUrl = (url) => url.replace(".git", "").trim();

const parseRepo = (url) => {
  const cleanUrl = normalizeUrl(url);
  const parts = cleanUrl.split("github.com/")[1]?.split("/");

  if (!parts || parts.length < 2) {
    throw new Error("Invalid GitHub URL");
  }

  return {
    owner: parts[0],
    repo: parts[1],
    cleanUrl
  };
};

const getHeaders = (token, isAppToken = false) => ({
  Accept: "application/vnd.github+json",
  Authorization: isAppToken
    ? `Bearer ${token}`
    : `token ${token}`
});

/* ========================= WEBHOOK ========================= */
const createWebhook = async (owner, repo, token, isAppToken) => {
  try {
    const webhookUrl = `${process.env.BASE_URL}/api/github/webhook`;

    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: webhookUrl,
          content_type: "json"
        }
      },
      { headers: getHeaders(token, isAppToken) }
    );

    console.log("✅ Webhook created");

  } catch (err) {
    if (err.response?.status === 422) {
      console.log("⚠️ Webhook already exists");
      return;
    }

    console.log("❌ Webhook error:", err.response?.data || err.message);
  }
};

/* ========================= ADD REPO ========================= */
export const addRepo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const user = req.user;
    const userId = user?._id?.toString();

    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const { owner, repo, cleanUrl } = parseRepo(url);

    /* ========================= TOKEN ========================= */
    let token = null;
    let isAppToken = false;

    if (user.installationId) {
      try {
        token = await getInstallationToken(user.installationId);
        isAppToken = true;
        console.log("🔐 Using App token");
      } catch {}
    }

    if (!token && user.githubAccessToken) {
      token = user.githubAccessToken;
      console.log("🔐 Using OAuth token");
    }

    if (!token) {
      return res.status(401).json({
        msg: "GitHub not connected"
      });
    }

    /* ========================= VALIDATE REPO ========================= */
    let repoData;

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: getHeaders(token, isAppToken) }
      );

      repoData = response.data;
    } catch {
      return res.status(404).json({
        msg: "Repository not found or access denied"
      });
    }

    /* ========================= DUPLICATE ========================= */
    const existing = await Repo.findOne({ url: cleanUrl, userId });

    if (existing) {
      return res.status(400).json({
        msg: "Repo already added"
      });
    }

    /* ========================= CREATE REPO ========================= */
    const newRepo = await Repo.create({
      userId,
      name: repoData.full_name,
      url: cleanUrl,
      isPrivate: repoData.private,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      language: repoData.language,
      riskScore: 0,
      status: "scanning"
    });

    console.log(`📦 Repo added: ${repoData.full_name}`);

    /* ========================= WEBHOOK ========================= */
    await createWebhook(owner, repo, token, isAppToken);

    /* ========================= 🔥 RESPONSE FIRST ========================= */
    res.status(201).json({
      success: true,
      repo: newRepo
    });

    /* ========================= 🚀 BACKGROUND SCAN (FINAL FIX) ========================= */
    setImmediate(async () => {
      try {
        await analyzeRepo(
          {
            body: {
              url: cleanUrl,
              repoId: newRepo._id,
              token,
              isAppToken
            },
            user: { id: userId },
            app: req.app // 🔥 VERY IMPORTANT
          },
          { json: () => {} }
        );
      } catch (err) {
        console.log("❌ Background scan failed:", err.message);

        await Repo.findByIdAndUpdate(newRepo._id, {
          status: "error"
        });
      }
    });

  } catch (err) {
    console.log("❌ Add repo error:", err.message);

    return res.status(500).json({
      error: "Failed to add repo"
    });
  }
};
